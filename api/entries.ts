// GET    /api/entries?date=YYYY-MM-DD        -> DayLog (entries, water, weight)
// GET    /api/entries?from=...&to=...        -> { entries } (export)
// POST   /api/entries { entries: NewEntry[], foodId? }  -> { entries }
// POST   /api/entries { action: 'copy', fromDate, toDate, meal? } -> { entries }
// PUT    /api/entries { id, ...NewEntry }    -> Entry
// DELETE /api/entries?id=...

import { requireUser } from './_lib/auth.js';
import { query, queryOne } from './_lib/db.js';
import { HttpError, json, readJson, requireDate, requireId, requireNumber, route } from './_lib/http.js';
import {
  ENTRY_COLUMNS,
  NUTRIENT_SQL_COLUMNS,
  assertFound,
  entryFromRow,
  nutrientParams,
  parseFoodData,
} from './_lib/rows.js';
import { MEALS, type Meal } from '../shared/nutrients.js';
import type { DayLog, EntrySource, NewEntry } from '../shared/types.js';

const SOURCES: EntrySource[] = ['manual', 'ai', 'barcode', 'database', 'library'];

function parseEntry(body: Record<string, unknown>): NewEntry {
  if (!MEALS.includes(body.meal as Meal)) throw new HttpError(400, '無效的餐別');
  return {
    ...parseFoodData(body),
    date: requireDate(body.date),
    meal: body.meal as Meal,
    quantity: requireNumber(body.quantity ?? 1, '數量', 0.01, 10_000),
    source: SOURCES.includes(body.source as EntrySource) ? (body.source as EntrySource) : 'manual',
  };
}

const INSERT_SQL = `INSERT INTO entries (user_id, date, meal, name, brand, serving_amount, serving_unit, quantity, source, ${NUTRIENT_SQL_COLUMNS})
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  RETURNING ${ENTRY_COLUMNS}`;

function insertParams(userId: string, e: NewEntry): unknown[] {
  return [userId, e.date, e.meal, e.name, e.brand, e.servingAmount, e.servingUnit, e.quantity, e.source, ...nutrientParams(e.nutrients)];
}

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const params = new URL(req.url).searchParams;

  if (params.has('from')) {
    const from = requireDate(params.get('from'), 'from');
    const to = requireDate(params.get('to'), 'to');
    const rows = await query(
      `SELECT ${ENTRY_COLUMNS} FROM entries WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date, created_at`,
      [user.id, from, to],
    );
    return json({ entries: rows.map(entryFromRow) });
  }

  const date = requireDate(params.get('date'));
  const [rows, water, weight] = await Promise.all([
    query(`SELECT ${ENTRY_COLUMNS} FROM entries WHERE user_id = $1 AND date = $2 ORDER BY created_at`, [user.id, date]),
    queryOne<{ ml: number }>(`SELECT ml FROM water_logs WHERE user_id = $1 AND date = $2`, [user.id, date]),
    queryOne<{ kg: number }>(`SELECT kg FROM weights WHERE user_id = $1 AND date = $2`, [user.id, date]),
  ]);
  const log: DayLog = {
    date,
    entries: rows.map(entryFromRow),
    waterMl: Number(water?.ml ?? 0),
    weightKg: weight ? Number(weight.kg) : null,
  };
  return json(log);
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);

  if (body.action === 'copy') {
    const fromDate = requireDate(body.fromDate, 'fromDate');
    const toDate = requireDate(body.toDate, 'toDate');
    const meal = body.meal == null ? null : (body.meal as Meal);
    if (meal && !MEALS.includes(meal)) throw new HttpError(400, '無效的餐別');
    const rows = await query(
      `INSERT INTO entries (user_id, date, meal, name, brand, serving_amount, serving_unit, quantity, source, ${NUTRIENT_SQL_COLUMNS})
       SELECT user_id, $3::date, meal, name, brand, serving_amount, serving_unit, quantity, source, ${NUTRIENT_SQL_COLUMNS}
       FROM entries WHERE user_id = $1 AND date = $2 AND ($4::text IS NULL OR meal = $4)
       ORDER BY created_at
       RETURNING ${ENTRY_COLUMNS}`,
      [user.id, fromDate, toDate, meal],
    );
    return json({ entries: rows.map(entryFromRow) });
  }

  const list = Array.isArray(body.entries) ? body.entries : [];
  if (list.length === 0 || list.length > 30) throw new HttpError(400, '請提供 1–30 筆紀錄');
  const parsed = list.map((e) => parseEntry(e as Record<string, unknown>));

  const created = [];
  for (const e of parsed) {
    const rows = await query(INSERT_SQL, insertParams(user.id, e));
    created.push(entryFromRow(rows[0]));
  }

  if (typeof body.foodId === 'string') {
    await query(`UPDATE foods SET use_count = use_count + 1 WHERE id = $1 AND user_id = $2`, [
      requireId(body.foodId),
      user.id,
    ]);
  }
  return json({ entries: created });
});

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const id = requireId(body.id);
  const e = parseEntry(body);
  const row = await queryOne(
    `UPDATE entries SET date = $3, meal = $4, name = $5, brand = $6, serving_amount = $7, serving_unit = $8,
       quantity = $9, source = $10, calories = $11, protein = $12, carbs = $13, fat = $14, fiber = $15,
       sugar = $16, sodium = $17, water = $18
     WHERE id = $1 AND user_id = $2 RETURNING ${ENTRY_COLUMNS}`,
    [id, user.id, e.date, e.meal, e.name, e.brand, e.servingAmount, e.servingUnit, e.quantity, e.source, ...nutrientParams(e.nutrients)],
  );
  return json(entryFromRow(assertFound(row, '找不到這筆紀錄')));
});

export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  const id = requireId(new URL(req.url).searchParams.get('id'));
  const row = await queryOne(`DELETE FROM entries WHERE id = $1 AND user_id = $2 RETURNING id`, [id, user.id]);
  assertFound(row, '找不到這筆紀錄');
  return json({ ok: true });
});
