// Amount picker for a food. Mass/volume foods are entered as an absolute amount (150 g);
// portion foods as a serving count (1.5 份). Either way the stored value is a serving multiplier.

import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NumberInput, parseNum } from '../../components/ui';
import { fmt, fmtNutrient } from '../../lib/format';
import { isMassUnit, scaleNutrients } from '../../../shared/nutrients';
import type { FoodData } from '../../../shared/types';

const MASS_CHIPS = [50, 100, 150, 200, 250, 300];
const SERVING_CHIPS = [0.5, 1, 1.5, 2, 3];

function round(n: number, step: number) {
  return Math.round(n / step) * step;
}

export function PortionEditor({
  food,
  quantity,
  onChange,
}: {
  food: FoodData;
  quantity: number;
  /** Receives the serving multiplier, or NaN when the input is not a valid amount. */
  onChange: (quantity: number) => void;
}) {
  const mass = isMassUnit(food.servingUnit);
  const toDisplay = (q: number) => (mass ? round(q * food.servingAmount, 1) : round(q, 0.01));
  const [draft, setDraft] = useState(() => (Number.isFinite(quantity) ? String(toDisplay(quantity)) : ''));

  // Keep the field in sync when the food changes underneath (e.g. another item selected).
  useEffect(() => {
    if (Number.isFinite(quantity) && parseNum(draft) !== toDisplay(quantity)) setDraft(String(toDisplay(quantity)));
  }, [food, quantity]);

  const commit = (displayValue: string) => {
    setDraft(displayValue);
    const n = parseNum(displayValue);
    if (!(n > 0)) return onChange(NaN);
    onChange(mass ? n / food.servingAmount : n);
  };

  const stepBy = (dir: 1 | -1) => {
    const current = parseNum(draft) || 0;
    const step = mass ? (current >= 100 ? 25 : 10) : 0.5;
    const next = Math.max(step, round(current + dir * step, step));
    commit(String(round(next, mass ? 1 : 0.01)));
  };

  const n = scaleNutrients(food.nutrients, Number.isFinite(quantity) ? quantity : 0);
  const chips = mass ? MASS_CHIPS : SERVING_CHIPS;

  return (
    <div>
      <div className="portion-amount">
        <button type="button" className="stepper" aria-label="減少" onClick={() => stepBy(-1)}>
          <Minus size={18} />
        </button>
        <NumberInput
          aria-label={mass ? `份量 (${food.servingUnit})` : '份數'}
          value={draft}
          onChange={commit}
          suffix={mass ? food.servingUnit : '份'}
          data-autofocus
        />
        <button type="button" className="stepper" aria-label="增加" onClick={() => stepBy(1)}>
          <Plus size={18} />
        </button>
      </div>
      <div className="chips" style={{ marginTop: 10, justifyContent: 'center' }}>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip${parseNum(draft) === c ? ' is-active' : ''}`}
            onClick={() => commit(String(c))}
          >
            {mass ? `${c} ${food.servingUnit}` : `${c} 份`}
          </button>
        ))}
      </div>
      {!mass && (
        <p className="field-hint" style={{ textAlign: 'center' }}>
          1 份 = {fmt(food.servingAmount, 1)} {food.servingUnit}
        </p>
      )}

      <div className="nutrient-preview">
        <div>
          <strong>{fmt(n.calories)}</strong>
          <span>kcal</span>
        </div>
        <div>
          <strong>{fmt(n.protein, 1)}</strong>
          <span>蛋白質 g</span>
        </div>
        <div>
          <strong>{fmt(n.carbs, 1)}</strong>
          <span>碳水 g</span>
        </div>
        <div>
          <strong>{fmt(n.fat, 1)}</strong>
          <span>脂肪 g</span>
        </div>
      </div>
      <div className="nutrient-preview-secondary">
        <span>纖維 {fmtNutrient('fiber', n.fiber)}</span>
        <span>糖 {fmtNutrient('sugar', n.sugar)}</span>
        <span>鈉 {fmtNutrient('sodium', n.sodium)}</span>
        {n.water > 0 && <span>水分 {fmtNutrient('water', n.water)}</span>}
      </div>
    </div>
  );
}
