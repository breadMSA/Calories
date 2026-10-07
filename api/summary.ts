// GET /api/summary?from=YYYY-MM-DD&to=YYYY-MM-DD -> SummaryRange
// Daily nutrient totals, water and weights over a date range (max ~1 year).

import { requireUser } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { HttpError, json, requireDate, route } from './_lib/http.js';
import { NUTRIENT_KEYS, sanitizeNutrients } from '../shared/nutrients.js';
import type { DaySummary } from '../shared/types.js';

const TOTALS_SQL = NUTRIENT_KEYS.map((k) => `sum(${k} * quantity) AS ${k}`).join(', ');

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const params = new URL(req.url).searchParams;
  const from = requireDate(params.get('from'), 'from');
  const to = requireDate(params.get('to'), 'to');
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > 400) throw new HttpError(400, '日期範圍過大');

  const [totals, water, weights] = await Promise.all([
    query(
      `SELECT date::text AS date, count(*)::int AS entry_count, ${TOTALS_SQL}
       FROM entries WHERE user_id = $1 AND date BETWEEN $2 AND $3 GROUP BY date`,
      [user.id, from, to],
    ),
    query(`SELECT date::text AS date, ml FROM water_logs WHERE user_id = $1 AND date BETWEEN $2 AND $3`, [user.id, from, to]),
    query(`SELECT date::text AS date, kg FROM weights WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date`, [
      user.id,
      from,
      to,
    ]),
  ]);

  const byDate = new Map<string, DaySummary>();
  for (const r of totals) {
    byDate.set(r.date, { date: r.date, totals: sanitizeNutrients(r), entryCount: r.entry_count, waterMl: 0 });
  }
  for (const r of water) {
    const day = byDate.get(r.date) ?? { date: r.date, totals: sanitizeNutrients({}), entryCount: 0, waterMl: 0 };
    day.waterMl = Number(r.ml);
    byDate.set(r.date, day);
  }

  return json({
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    weights: weights.map((w) => ({ date: w.date, kg: Number(w.kg) })),
  });
});
