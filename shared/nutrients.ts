// Nutrient definitions shared by the API and the client.

export const NUTRIENT_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
  'water',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type Nutrients = Record<NutrientKey, number>;

export const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string; decimals: number }> = {
  calories: { label: '熱量', unit: 'kcal', decimals: 0 },
  protein: { label: '蛋白質', unit: 'g', decimals: 1 },
  carbs: { label: '碳水化合物', unit: 'g', decimals: 1 },
  fat: { label: '脂肪', unit: 'g', decimals: 1 },
  fiber: { label: '膳食纖維', unit: 'g', decimals: 1 },
  sugar: { label: '糖', unit: 'g', decimals: 1 },
  sodium: { label: '鈉', unit: 'mg', decimals: 0 },
  water: { label: '水分', unit: 'ml', decimals: 0 },
};

/** Nutrients where the target is a ceiling rather than a goal to reach. */
export const LIMIT_NUTRIENTS: ReadonlySet<NutrientKey> = new Set(['sugar', 'sodium']);

export function emptyNutrients(): Nutrients {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, water: 0 };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = round1(n[k] * factor);
  return out;
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = a[k] + b[k];
  return out;
}

/** Coerces untrusted input into a clean, non-negative nutrient record. */
export function sanitizeNutrients(input: unknown): Nutrients {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const v = Number(src[k]);
    out[k] = Number.isFinite(v) && v > 0 ? round1(Math.min(v, 1_000_000)) : 0;
  }
  return out;
}

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
};

/** Picks a sensible default meal for the current local time. */
export function mealForTime(date = new Date()): Meal {
  const h = date.getHours();
  if (h >= 4 && h < 10) return 'breakfast';
  if (h >= 10 && h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

/** Units where the quantity is entered as an absolute amount (e.g. 150 g) rather than a serving count. */
export function isMassUnit(unit: string): boolean {
  return unit === 'g' || unit === 'ml';
}
