// GET /api/barcode?code=... -> BarcodeResult
// Checks the user's own saved foods first (covers local products missing from public
// databases), then falls back to Open Food Facts.

import { requireUser } from './_lib/auth.js';
import { queryOne } from './_lib/db.js';
import { HttpError, json, route } from './_lib/http.js';
import { FOOD_COLUMNS, foodFromRow } from './_lib/rows.js';
import { emptyNutrients, round1, type Nutrients } from '../shared/nutrients.js';
import type { BarcodeResult } from '../shared/types.js';

type OffNutriments = Record<string, number | string | undefined>;

function pick(n: OffNutriments, key: string, suffix: '_100g' | '_serving'): number | null {
  const v = Number(n[`${key}${suffix}`]);
  return Number.isFinite(v) ? v : null;
}

function readNutrients(n: OffNutriments, suffix: '_100g' | '_serving'): Nutrients | null {
  let kcal = pick(n, 'energy-kcal', suffix);
  if (kcal == null) {
    const kj = pick(n, 'energy', suffix);
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal == null) return null;
  const out = emptyNutrients();
  out.calories = round1(kcal);
  out.protein = round1(pick(n, 'proteins', suffix) ?? 0);
  out.carbs = round1(pick(n, 'carbohydrates', suffix) ?? 0);
  out.fat = round1(pick(n, 'fat', suffix) ?? 0);
  out.fiber = round1(pick(n, 'fiber', suffix) ?? 0);
  out.sugar = round1(pick(n, 'sugars', suffix) ?? 0);
  // OFF stores sodium in grams.
  out.sodium = round1((pick(n, 'sodium', suffix) ?? 0) * 1000);
  return out;
}

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const code = (new URL(req.url).searchParams.get('code') ?? '').trim();
  if (!/^\d{6,14}$/.test(code)) throw new HttpError(400, '條碼格式不正確');

  const own = await queryOne(`SELECT ${FOOD_COLUMNS} FROM foods WHERE user_id = $1 AND barcode = $2 LIMIT 1`, [
    user.id,
    code,
  ]);
  if (own) {
    const food = foodFromRow(own);
    const result: BarcodeResult = { ...food, barcode: code, per100: null, servingGrams: null };
    return json(result);
  }

  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_zh,product_name_zh-tw,brands,serving_quantity,serving_quantity_unit,nutriments`,
    { headers: { 'User-Agent': 'NutritionTracker/2.0 (personal use)' }, signal: AbortSignal.timeout(8000) },
  ).catch(() => null);
  if (!res) throw new HttpError(502, '無法連線到食品資料庫');
  if (res.status === 404) throw new HttpError(404, '資料庫中找不到這個條碼');
  if (!res.ok) throw new HttpError(502, '食品資料庫暫時無法使用');

  const data = (await res.json()) as { status?: number; product?: Record<string, any> };
  const p = data.product;
  if (data.status !== 1 || !p) throw new HttpError(404, '資料庫中找不到這個條碼');

  const n: OffNutriments = p.nutriments ?? {};
  const per100 = readNutrients(n, '_100g');
  const perServing = readNutrients(n, '_serving');
  if (!per100 && !perServing) throw new HttpError(404, '這項產品沒有營養資料');

  const name = String(p['product_name_zh-tw'] || p.product_name_zh || p.product_name || '').trim() || `條碼 ${code}`;
  const brand = String(p.brands ?? '').split(',')[0].trim();
  const unit = p.serving_quantity_unit === 'ml' ? 'ml' : 'g';
  const servingGrams = Number(p.serving_quantity) > 0 ? Number(p.serving_quantity) : null;

  const base = { name, brand, barcode: code, per100, servingGrams };
  let result: BarcodeResult;
  if (perServing && servingGrams) {
    result = { ...base, servingAmount: servingGrams, servingUnit: unit, nutrients: perServing };
  } else if (per100) {
    result = { ...base, servingAmount: 100, servingUnit: unit, nutrients: per100 };
  } else {
    result = { ...base, servingAmount: 1, servingUnit: '份', nutrients: perServing! };
  }
  return json(result);
});
