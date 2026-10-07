// PUT /api/water { date, ml } -> { date, waterMl }  (sets the day's logged water total)

import { requireUser } from './_lib/auth.js';
import { query } from './_lib/db.js';
import { json, readJson, requireDate, requireNumber, route } from './_lib/http.js';

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const date = requireDate(body.date);
  const ml = Math.round(requireNumber(body.ml, '水量', 0, 20_000));
  await query(
    `INSERT INTO water_logs (user_id, date, ml) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date) DO UPDATE SET ml = EXCLUDED.ml`,
    [user.id, date, ml],
  );
  return json({ date, waterMl: ml });
});
