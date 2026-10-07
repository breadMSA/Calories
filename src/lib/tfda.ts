// Client-side search over the Taiwan FDA food composition database (public/data/tfda.json).
// Built by scripts/build-tfda.mjs; values are per 100 g.

import type { FoodData } from '../../shared/types';

type Row = [string, string, string, string, number, number, number, number, number, number, number, number];

export interface TfdaFood extends FoodData {
  id: string;
  category: string;
  alias: string;
}

let cache: Promise<TfdaFood[]> | null = null;

export function loadTfda(): Promise<TfdaFood[]> {
  if (!cache) {
    cache = fetch('/data/tfda.json')
      .then((res) => {
        if (!res.ok) throw new Error('無法載入食品資料庫');
        return res.json() as Promise<Row[]>;
      })
      .then((rows) =>
        rows.map(([id, name, alias, category, calories, protein, carbs, fat, fiber, sugar, sodium]) => ({
          id,
          name,
          alias,
          category,
          brand: '',
          servingAmount: 100,
          servingUnit: 'g',
          // Water content of solid foods is not drinking water, so it is not counted towards hydration.
          nutrients: { calories, protein, carbs, fat, fiber, sugar, sodium, water: 0 },
        })),
      )
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s()（）,，、]/g, '');
}

/** Ranks by match quality: exact name, name prefix, name substring, then alias match. */
export function searchTfda(foods: TfdaFood[], term: string, limit = 30): TfdaFood[] {
  const t = normalize(term);
  if (!t) return [];
  const scored: { food: TfdaFood; score: number }[] = [];
  for (const food of foods) {
    const name = normalize(food.name);
    let score = 0;
    if (name === t) score = 100;
    else if (name.startsWith(t)) score = 80;
    else if (name.includes(t)) score = 60;
    else if (normalize(food.alias).includes(t)) score = 40;
    if (score) scored.push({ food, score: score - name.length * 0.1 });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.food);
}
