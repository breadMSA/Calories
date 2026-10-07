// PUT    /api/weights { date, kg } -> WeightPoint
// DELETE /api/weights?date=YYYY-MM-DD
// Logging a weight that is the most recent one also updates the profile, so automatic
// targets follow the user's current body weight.

import { requireUser } from './_lib/auth.js';
import { query, queryOne } from './_lib/db.js';
import { json, readJson, requireDate, requireNumber, route } from './_lib/http.js';
import { loadProfile, saveProfile } from './_lib/rows.js';

async function syncProfileWeight(userId: string): Promise<void> {
  const [latest, profile] = await Promise.all([
    queryOne<{ kg: number }>(`SELECT kg FROM weights WHERE user_id = $1 ORDER BY date DESC LIMIT 1`, [userId]),
    loadProfile(userId),
  ]);
  if (latest && profile && Number(latest.kg) !== profile.weightKg) {
    await saveProfile(userId, { ...profile, weightKg: Number(latest.kg) });
  }
}

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const date = requireDate(body.date);
  const kg = Math.round(requireNumber(body.kg, '體重', 25, 350) * 100) / 100;
  await query(
    `INSERT INTO weights (user_id, date, kg) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date) DO UPDATE SET kg = EXCLUDED.kg`,
    [user.id, date, kg],
  );
  await syncProfileWeight(user.id);
  return json({ date, kg });
});

export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  const date = requireDate(new URL(req.url).searchParams.get('date'));
  await query(`DELETE FROM weights WHERE user_id = $1 AND date = $2`, [user.id, date]);
  await syncProfileWeight(user.id);
  return json({ ok: true });
});
