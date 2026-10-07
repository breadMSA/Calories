import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { ProgressBar } from '../../components/ui';
import { fmt, fmtNutrient } from '../../lib/format';
import { LIMIT_NUTRIENTS, NUTRIENT_KEYS, NUTRIENT_META, type Nutrients } from '../../../shared/nutrients';

const MACROS = [
  { key: 'protein', label: '蛋白質', tone: 'protein' },
  { key: 'carbs', label: '碳水', tone: 'carbs' },
  { key: 'fat', label: '脂肪', tone: 'fat' },
] as const;

export function DaySummary({
  totals,
  targets,
  calorieCeiling,
}: {
  totals: Nutrients;
  targets: Nutrients;
  /** When gaining weight, going over the calorie target is not a problem. */
  calorieCeiling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const remaining = targets.calories - totals.calories;
  const over = remaining < 0;
  const overWarn = over && calorieCeiling;

  return (
    <section className="card card-pad" aria-label="今日攝取摘要">
      <div className="summary-energy">
        <div>
          <div className="energy-label">熱量</div>
          <div className="energy-value">
            {fmt(totals.calories)} <small>/ {fmt(targets.calories)} kcal</small>
          </div>
        </div>
        <div className={`energy-remaining${overWarn ? ' is-over' : ''}`}>
          <strong>{fmt(Math.abs(remaining))}</strong>
          <span>{over ? '超過' : '剩餘'} kcal</span>
        </div>
      </div>
      <ProgressBar label="熱量進度" value={totals.calories} max={targets.calories} limit={calorieCeiling} />

      <div className="macro-grid">
        {MACROS.map((m) => (
          <div key={m.key}>
            <div className="macro-name">
              <span className={`dot dot-${m.tone}`} />
              {m.label}
            </div>
            <div className="macro-value">
              {fmt(totals[m.key], 0)}
              <small> / {fmt(targets[m.key])} g</small>
            </div>
            <ProgressBar label={`${m.label}進度`} value={totals[m.key]} max={targets[m.key]} tone={m.tone} />
          </div>
        ))}
      </div>

      <button type="button" className="details-toggle" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
        {expanded ? '收合' : '所有營養素'}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <table className="nutrient-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>營養素</th>
              <th>攝取</th>
              <th>目標</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {NUTRIENT_KEYS.filter((k) => k !== 'water').map((k) => {
              const limit = LIMIT_NUTRIENTS.has(k);
              const pct = targets[k] > 0 ? Math.round((totals[k] / targets[k]) * 100) : 0;
              return (
                <tr key={k}>
                  <td>{NUTRIENT_META[k].label}</td>
                  <td className={limit && totals[k] > targets[k] ? 'is-over' : undefined}>{fmtNutrient(k, totals[k])}</td>
                  <td className="subtle">
                    {limit ? '≤ ' : ''}
                    {fmtNutrient(k, targets[k])}
                  </td>
                  <td className="subtle">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
