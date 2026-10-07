// GET /api/profile -> Profile | null
// PUT /api/profile Profile -> Profile (targets recalculated when targetMode is 'auto')

import { requireUser } from './_lib/auth.js';
import { HttpError, json, readJson, requireNumber, route } from './_lib/http.js';
import { loadProfile, saveProfile } from './_lib/rows.js';
import { sanitizeNutrients } from '../shared/nutrients.js';
import { ACTIVITY_LEVELS, GOALS, type ActivityLevel, type Goal } from '../shared/targets.js';
import type { Profile } from '../shared/types.js';

function oneOf<T extends string>(value: unknown, options: readonly T[], field: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) throw new HttpError(400, `無效的${field}`);
  return value as T;
}

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return json(await loadProfile(user.id));
});

export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const year = new Date().getFullYear();

  const profile: Profile = {
    sex: oneOf(body.sex, ['male', 'female'] as const, '性別'),
    birthYear: Math.round(requireNumber(body.birthYear, '出生年', year - 110, year - 10)),
    heightCm: requireNumber(body.heightCm, '身高', 100, 250),
    weightKg: requireNumber(body.weightKg, '體重', 25, 350),
    activity: oneOf(body.activity, Object.keys(ACTIVITY_LEVELS) as ActivityLevel[], '活動量'),
    goal: oneOf(body.goal, Object.keys(GOALS) as Goal[], '目標'),
    weeklyRateKg: requireNumber(body.weeklyRateKg ?? 0.5, '每週變化', 0, 1.5),
    targetMode: body.targetMode === 'custom' ? 'custom' : 'auto',
    targets: sanitizeNutrients(body.targets),
  };

  if (profile.targetMode === 'custom' && profile.targets.calories < 800) {
    throw new HttpError(400, '每日熱量目標過低');
  }

  return json(await saveProfile(user.id, profile));
});
