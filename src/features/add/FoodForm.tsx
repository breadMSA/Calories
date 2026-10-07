// Editable food definition: name, serving size and per-serving nutrients.

import { Field, NumberInput, TextInput, parseNum } from '../../components/ui';
import { NUTRIENT_KEYS, NUTRIENT_META, emptyNutrients, type NutrientKey } from '../../../shared/nutrients';
import type { FoodData } from '../../../shared/types';

export interface FoodDraft {
  name: string;
  brand: string;
  servingAmount: string;
  servingUnit: string;
  nutrients: Record<NutrientKey, string>;
}

export const SERVING_UNITS = ['g', 'ml', '份', '個', '碗', '杯', '片', '包', '匙'];

export function draftFromFood(food?: Partial<FoodData> | null): FoodDraft {
  const nutrients = {} as Record<NutrientKey, string>;
  for (const k of NUTRIENT_KEYS) {
    const v = food?.nutrients?.[k];
    nutrients[k] = v ? String(v) : '';
  }
  return {
    name: food?.name ?? '',
    brand: food?.brand ?? '',
    servingAmount: food?.servingAmount ? String(food.servingAmount) : '1',
    servingUnit: food?.servingUnit ?? '份',
    nutrients,
  };
}

export function foodFromDraft(d: FoodDraft): { food: FoodData | null; error: string | null } {
  const name = d.name.trim();
  if (!name) return { food: null, error: '請輸入名稱' };
  const servingAmount = parseNum(d.servingAmount);
  if (!(servingAmount > 0)) return { food: null, error: '請輸入有效的份量' };
  const nutrients = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const v = d.nutrients[k].trim() === '' ? 0 : Number(d.nutrients[k]);
    if (!Number.isFinite(v) || v < 0) return { food: null, error: `${NUTRIENT_META[k].label}數值無效` };
    nutrients[k] = v;
  }
  return {
    food: { name, brand: d.brand.trim(), servingAmount, servingUnit: d.servingUnit || '份', nutrients },
    error: null,
  };
}

export function FoodForm({ draft, onChange }: { draft: FoodDraft; onChange: (d: FoodDraft) => void }) {
  const set = <K extends keyof FoodDraft>(key: K, value: FoodDraft[K]) => onChange({ ...draft, [key]: value });
  const setNutrient = (k: NutrientKey, v: string) => onChange({ ...draft, nutrients: { ...draft.nutrients, [k]: v } });
  const unitOptions = SERVING_UNITS.includes(draft.servingUnit) ? SERVING_UNITS : [...SERVING_UNITS, draft.servingUnit];

  return (
    <>
      <Field label="名稱" htmlFor="food-name">
        <TextInput id="food-name" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="例如：雞胸肉便當" />
      </Field>
      <Field label="品牌（選填）" htmlFor="food-brand">
        <TextInput id="food-brand" value={draft.brand} onChange={(e) => set('brand', e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="每份份量" htmlFor="food-amount">
          <NumberInput id="food-amount" value={draft.servingAmount} onChange={(v) => set('servingAmount', v)} />
        </Field>
        <Field label="單位" htmlFor="food-unit">
          <select
            id="food-unit"
            className="select"
            value={draft.servingUnit}
            onChange={(e) => set('servingUnit', e.target.value)}
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <h3 className="section-label">每份營養素</h3>
      <div className="nutrient-form">
        {NUTRIENT_KEYS.map((k) => (
          <Field key={k} label={NUTRIENT_META[k].label} htmlFor={`n-${k}`}>
            <NumberInput
              id={`n-${k}`}
              value={draft.nutrients[k]}
              onChange={(v) => setNutrient(k, v)}
              suffix={NUTRIENT_META[k].unit}
              placeholder="0"
            />
          </Field>
        ))}
      </div>
      <p className="field-hint">「水分」只填飲料或湯的液體量，會計入每日飲水。</p>
    </>
  );
}
