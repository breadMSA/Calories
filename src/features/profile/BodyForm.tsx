// Body stats & goal form, shared by onboarding and settings.

import { Field, NumberInput, Segmented, parseNum } from '../../components/ui';
import { fmt } from '../../lib/format';
import {
  ACTIVITY_LEVELS,
  GOALS,
  KCAL_PER_KG,
  recommendTargets,
  type ActivityLevel,
  type BodyStats,
  type Goal,
  type Sex,
} from '../../../shared/targets';
import type { Profile } from '../../../shared/types';

export interface BodyDraft {
  sex: Sex;
  birthYear: string;
  heightCm: string;
  weightKg: string;
  activity: ActivityLevel;
  goal: Goal;
  weeklyRateKg: string;
}

export function draftFromProfile(p: Profile | null): BodyDraft {
  return {
    sex: p?.sex ?? 'female',
    birthYear: p ? String(p.birthYear) : '',
    heightCm: p ? String(p.heightCm) : '',
    weightKg: p ? String(p.weightKg) : '',
    activity: p?.activity ?? 'light',
    goal: p?.goal ?? 'maintain',
    weeklyRateKg: p ? String(p.weeklyRateKg) : '0.5',
  };
}

/** Returns validated stats, or a map of field errors. */
export function validateBody(d: BodyDraft): { stats: BodyStats | null; errors: Partial<Record<keyof BodyDraft, string>> } {
  const errors: Partial<Record<keyof BodyDraft, string>> = {};
  const year = new Date().getFullYear();
  const birthYear = parseNum(d.birthYear);
  const heightCm = parseNum(d.heightCm);
  const weightKg = parseNum(d.weightKg);
  const weeklyRateKg = d.goal === 'maintain' ? 0 : parseNum(d.weeklyRateKg);

  if (!(birthYear >= year - 110 && birthYear <= year - 10)) errors.birthYear = '請輸入西元出生年，例如 1995';
  if (!(heightCm >= 100 && heightCm <= 250)) errors.heightCm = '請輸入 100–250 cm';
  if (!(weightKg >= 25 && weightKg <= 350)) errors.weightKg = '請輸入 25–350 kg';
  if (!(weeklyRateKg >= 0 && weeklyRateKg <= 1.5)) errors.weeklyRateKg = '請輸入 0–1.5 kg';

  if (Object.keys(errors).length) return { stats: null, errors };
  return {
    stats: { sex: d.sex, birthYear, heightCm, weightKg, activity: d.activity, goal: d.goal, weeklyRateKg },
    errors,
  };
}

const RATE_OPTIONS = ['0.25', '0.5', '0.75', '1'];

export function BodyForm({
  draft,
  onChange,
  showErrors,
}: {
  draft: BodyDraft;
  onChange: (d: BodyDraft) => void;
  showErrors: boolean;
}) {
  const set = <K extends keyof BodyDraft>(key: K, value: BodyDraft[K]) => onChange({ ...draft, [key]: value });
  const { errors } = validateBody(draft);
  const err = (k: keyof BodyDraft) => (showErrors ? errors[k] : undefined);

  return (
    <>
      <Field label="生理性別" hint="用於計算基礎代謝率">
        <Segmented
          label="生理性別"
          value={draft.sex}
          onChange={(v) => set('sex', v)}
          options={[
            { value: 'female', label: '女' },
            { value: 'male', label: '男' },
          ]}
        />
      </Field>

      <div className="field-row field-row-3">
        <Field label="出生年" htmlFor="birthYear" error={err('birthYear')}>
          <NumberInput id="birthYear" inputMode="numeric" placeholder="1995" value={draft.birthYear} suffix="年" onChange={(v) => set('birthYear', v)} />
        </Field>
        <Field label="身高" htmlFor="heightCm" error={err('heightCm')}>
          <NumberInput id="heightCm" value={draft.heightCm} suffix="cm" onChange={(v) => set('heightCm', v)} />
        </Field>
        <Field label="體重" htmlFor="weightKg" error={err('weightKg')}>
          <NumberInput id="weightKg" value={draft.weightKg} suffix="kg" onChange={(v) => set('weightKg', v)} />
        </Field>
      </div>

      <Field label="日常活動量">
        <div className="option-list" role="radiogroup" aria-label="日常活動量">
          {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((level) => (
            <label key={level} className="option">
              <input
                type="radio"
                name="activity"
                checked={draft.activity === level}
                onChange={() => set('activity', level)}
              />
              <span>
                <span className="option-title">{ACTIVITY_LEVELS[level].label}</span>
                <span className="option-hint">{ACTIVITY_LEVELS[level].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="目標">
        <Segmented
          label="目標"
          value={draft.goal}
          onChange={(v) => set('goal', v)}
          options={(Object.keys(GOALS) as Goal[]).map((g) => ({ value: g, label: GOALS[g].label }))}
        />
      </Field>

      {draft.goal !== 'maintain' && (
        <Field
          label={`每週${draft.goal === 'lose' ? '減少' : '增加'}`}
          error={err('weeklyRateKg')}
          hint={
            Number(draft.weeklyRateKg) > 0
              ? `約每日 ${draft.goal === 'lose' ? '−' : '+'}${fmt((Number(draft.weeklyRateKg) * KCAL_PER_KG) / 7)} kcal`
              : undefined
          }
        >
          <div className="chips">
            {RATE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`chip${draft.weeklyRateKg === r ? ' is-active' : ''}`}
                onClick={() => set('weeklyRateKg', r)}
              >
                {r} kg
              </button>
            ))}
          </div>
        </Field>
      )}
    </>
  );
}

export function TargetBreakdownView({ stats }: { stats: BodyStats }) {
  const b = recommendTargets(stats);
  return (
    <dl style={{ margin: 0 }}>
      <div className="kv">
        <dt>基礎代謝 (BMR)</dt>
        <dd>{fmt(b.bmr)} kcal</dd>
      </div>
      <div className="kv">
        <dt>每日總消耗 (TDEE)</dt>
        <dd>{fmt(b.tdee)} kcal</dd>
      </div>
      {b.adjustment !== 0 && (
        <div className="kv">
          <dt>目標調整</dt>
          <dd>
            {b.adjustment > 0 ? '+' : '−'}
            {fmt(Math.abs(b.adjustment))} kcal
          </dd>
        </div>
      )}
      <div className="kv">
        <dt>每日熱量目標</dt>
        <dd>{fmt(b.targets.calories)} kcal</dd>
      </div>
      <div className="kv">
        <dt>蛋白質 / 碳水 / 脂肪</dt>
        <dd>
          {b.targets.protein} / {b.targets.carbs} / {b.targets.fat} g
        </dd>
      </div>
      {b.floorApplied && (
        <p className="notice notice-warning" style={{ marginTop: 8 }}>
          計算結果低於安全下限，已調整為 {fmt(b.targets.calories)} kcal。建議降低每週減重速度。
        </p>
      )}
    </dl>
  );
}
