// Row <-> API object mapping shared by the handlers.

import { NUTRIENT_KEYS, sanitizeNutrients, type Nutrients } from '../../shared/nutrients.js';
import type { Entry, FoodData, Profile, SavedFood } from '../../shared/types.js';
import { recommendTargets } from '../../shared/targets.js';
import { queryOne } from './db.js';
import { HttpError, optionalString, requireNumber, requireString } from './http.js';

export const NUTRIENT_SQL_COLUMNS = NUTRIENT_KEYS.join(', ');

export function nutrientsFromRow(row: Record<string, any>): Nutrients {
  return sanitizeNutrients(row);
}

export function nutrientParams(n: Nutrients): number[] {
  return NUTRIENT_KEYS.map((k) => n[k]);
}

const ENTRY_COLUMNS = `id, date::text AS date, meal, name, brand, serving_amount, serving_unit, quantity, source, created_at, ${NUTRIENT_SQL_COLUMNS}`;
export { ENTRY_COLUMNS };

export function entryFromRow(row: Record<string, any>): Entry {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    name: row.name,
    brand: row.brand,
    servingAmount: Number(row.serving_amount),
    servingUnit: row.serving_unit,
    quantity: Number(row.quantity),
    source: row.source,
    nutrients: nutrientsFromRow(row),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export const FOOD_COLUMNS = `id, name, brand, serving_amount, serving_unit, barcode, favorite, use_count, ${NUTRIENT_SQL_COLUMNS}`;

export function foodFromRow(row: Record<string, any>): SavedFood {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    servingAmount: Number(row.serving_amount),
    servingUnit: row.serving_unit,
    barcode: row.barcode,
    favorite: Boolean(row.favorite),
    useCount: Number(row.use_count),
    nutrients: nutrientsFromRow(row),
  };
}

/** Validates the food fields common to entries and saved foods. */
export function parseFoodData(body: Record<string, unknown>): FoodData {
  return {
    name: requireString(body.name, '名稱', 120),
    brand: optionalString(body.brand, 80),
    servingAmount: requireNumber(body.servingAmount ?? 1, '份量', 0.01, 100_000),
    servingUnit: optionalString(body.servingUnit, 20) || '份',
    nutrients: sanitizeNutrients(body.nutrients),
  };
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const row = await queryOne<{ data: Profile }>(`SELECT data FROM profiles WHERE user_id = $1`, [userId]);
  if (!row) return null;
  return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
}

export async function saveProfile(userId: string, profile: Profile): Promise<Profile> {
  const stored = profile.targetMode === 'auto' ? { ...profile, targets: recommendTargets(profile).targets } : profile;
  await queryOne(
    `INSERT INTO profiles (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [userId, JSON.stringify(stored)],
  );
  return stored;
}

export function assertFound<T>(value: T | null | undefined, message = '找不到資料'): T {
  if (value == null) throw new HttpError(404, message);
  return value;
}
