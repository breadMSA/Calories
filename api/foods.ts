// GET    /api/foods            -> { saved: SavedFood[], recent: FoodData[] }
// POST   /api/foods FoodData   -> SavedFood
// PUT    /api/foods { id, ...FoodData, favorite } -> SavedFood
// DELETE /api/foods?id=...

import { requireUser } from './_lib/auth.js';
import { query, queryOne } from './_lib/db.js';
import { json, optionalString, readJson, requireId, route } from './_lib/http.js';
import {
  FOOD_COLUMNS,
  NUTRIENT_SQL_COLUMNS,
  assertFound,
  foodFromRow,
  nutrientParams,
  nutrientsFromRow,
  parseFoodData,
} from './_lib/rows.js';
import type { FoodData } from '../shared/types.js';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const [saved, recent] = await Promise.all([
    query(`SELECT ${FOOD_COLUMNS} FROM foods WHERE user_id = $1 ORDER BY favorite DESC, use_count DESC, name`, [user.id]),
    // Most recently logged distinct foods, for one-tap re-logging.
    query(
      `SELECT * FROM (
         SELECT DISTINCT ON (lower(name), serving_unit, serving_amount)
           name, brand, serving_amount, serving_unit, created_at, ${NUTRIENT_SQL_COLUMNS}
         FROM entries WHERE user_id = $1 AND created_at > now() - interval '90 days'
         ORDER BY lower(name), serving_unit, serving_amount, created_at DESC
       ) t ORDER BY created_at DESC LIMIT 40`,
      [user.id],
    ),
  ]);
  return json({
    saved: saved.map(foodFromRow),
    recent: recent.map(
      (r): FoodData => ({
        name: r.name,
        brand: r.brand,
        servingAmount: Number(r.serving_amount),
        servingUnit: r.serving_unit,
        nutrients: nutrientsFromRow(r),
      }),
    ),
  });
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const f = parseFoodData(body);
  const row = await queryOne(
    `INSERT INTO foods (user_id, name, brand, serving_amount, serving_unit, barcode, favorite, ${NUTRIENT_SQL_COLUMNS})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING ${FOOD_COLUMNS}`,
    [user.id, f.name, f.brand, f.servingAmount, f.servingUnit, optionalString(body.barcode, 32) || null, Boolean(body.favorite), ...nutrientParams(f.nutrients)],
  );
  return json(foodFromRow(row!));
});

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const id = requireId(body.id);
  const f = parseFoodData(body);
  const row = await queryOne(
    `UPDATE foods SET name = $3, brand = $4, serving_amount = $5, serving_unit = $6, barcode = $7, favorite = $8,
       calories = $9, protein = $10, carbs = $11, fat = $12, fiber = $13, sugar = $14, sodium = $15, water = $16,
       updated_at = now()
     WHERE id = $1 AND user_id = $2 RETURNING ${FOOD_COLUMNS}`,
    [id, user.id, f.name, f.brand, f.servingAmount, f.servingUnit, optionalString(body.barcode, 32) || null, Boolean(body.favorite), ...nutrientParams(f.nutrients)],
  );
  return json(foodFromRow(assertFound(row, '找不到這個食物')));
});

export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  const id = requireId(new URL(req.url).searchParams.get('id'));
  const row = await queryOne(`DELETE FROM foods WHERE id = $1 AND user_id = $2 RETURNING id`, [id, user.id]);
  assertFound(row, '找不到這個食物');
  return json({ ok: true });
});
