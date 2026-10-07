import { NUTRIENT_META, isMassUnit, type NutrientKey } from '../../shared/nutrients';
import type { FoodData } from '../../shared/types';

const formatters = new Map<number, Intl.NumberFormat>();

export function fmt(n: number, decimals = 0): string {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
    formatters.set(decimals, f);
  }
  return f.format(n);
}

export function fmtNutrient(key: NutrientKey, value: number, withUnit = true): string {
  const meta = NUTRIENT_META[key];
  // Show one decimal only for small gram values, where it carries information.
  const decimals = meta.decimals && Math.abs(value) < 100 ? meta.decimals : 0;
  return withUnit ? `${fmt(value, decimals)} ${meta.unit}` : fmt(value, decimals);
}

/** Human-readable amount eaten, e.g. "150 g" or "1.5 份". */
export function fmtPortion(food: Pick<FoodData, 'servingAmount' | 'servingUnit'>, quantity = 1): string {
  if (isMassUnit(food.servingUnit)) return `${fmt(food.servingAmount * quantity, 0)} ${food.servingUnit}`;
  const servings = fmt(quantity, 2);
  const size = food.servingAmount !== 1 ? ` × ${fmt(food.servingAmount, 1)}` : '';
  return `${servings}${size} ${food.servingUnit}`;
}
