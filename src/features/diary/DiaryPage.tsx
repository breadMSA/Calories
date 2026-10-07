import { ChevronLeft, ChevronRight, Copy, Minus, Plus } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Menu } from '../../components/Menu';
import { useToast } from '../../components/Toast';
import { Button, ErrorNote, IconButton, NumberInput, ProgressBar, Spinner, parseNum } from '../../components/ui';
import { addDays, relativeDay, shortDate, today, weekday } from '../../lib/dates';
import { fmt, fmtPortion } from '../../lib/format';
import { useCopyEntries, useDay, useProfile, useSetWater, useSetWeight } from '../../lib/queries';
import {
  MEALS,
  MEAL_LABELS,
  addNutrients,
  emptyNutrients,
  scaleNutrients,
  type Meal,
  type Nutrients,
} from '../../../shared/nutrients';
import type { Entry } from '../../../shared/types';
import { AddFoodSheet } from '../add/AddFoodSheet';
import { DaySummary } from './DaySummary';
import { EntryEditor } from './EntryEditor';

function totalsOf(entries: Entry[]): Nutrients {
  return entries.reduce((acc, e) => addNutrients(acc, scaleNutrients(e.nutrients, e.quantity)), emptyNutrients());
}

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isToday = date === today();
  return (
    <header className="page-header date-nav">
      <IconButton label="前一天" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft size={22} />
      </IconButton>
      <button
        type="button"
        className="date-nav-label"
        onClick={() => {
          try {
            inputRef.current?.showPicker();
          } catch {
            inputRef.current?.focus();
          }
        }}
      >
        <span className="page-title">{relativeDay(date)}</span>
        <span className="date-nav-sub">
          {/^\d/.test(relativeDay(date)) ? weekday(date) : `${shortDate(date)} ${weekday(date)}`}
        </span>
      </button>
      <input
        ref={inputRef}
        className="date-input"
        type="date"
        value={date}
        max={addDays(today(), 7)}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
      />
      {!isToday && (
        <Button size="sm" variant="ghost" onClick={() => onChange(today())}>
          回到今天
        </Button>
      )}
      <IconButton label="後一天" onClick={() => onChange(addDays(date, 1))}>
        <ChevronRight size={22} />
      </IconButton>
    </header>
  );
}

function MealSection({
  meal,
  entries,
  date,
  onAdd,
  onEdit,
}: {
  meal: Meal;
  entries: Entry[];
  date: string;
  onAdd: () => void;
  onEdit: (e: Entry) => void;
}) {
  const toast = useToast();
  const copy = useCopyEntries();
  const totals = totalsOf(entries);

  const copyFrom = (fromDate: string) =>
    copy.mutate(
      { fromDate, toDate: date, meal },
      {
        onSuccess: ({ entries: copied }) =>
          toast(copied.length ? `已複製 ${copied.length} 項` : `${relativeDay(fromDate)}的${MEAL_LABELS[meal]}沒有紀錄`),
        onError: (err) => toast(err.message, { tone: 'error' }),
      },
    );

  return (
    <section className="card" aria-label={MEAL_LABELS[meal]}>
      <div className="meal-header">
        <span className="meal-name">{MEAL_LABELS[meal]}</span>
        <span className="meal-kcal">{entries.length > 0 && `${fmt(totals.calories)} kcal`}</span>
        <Menu
          label={`${MEAL_LABELS[meal]}選項`}
          items={[
            { label: `複製昨天的${MEAL_LABELS[meal]}`, icon: <Copy size={16} />, onSelect: () => copyFrom(addDays(date, -1)) },
          ]}
        />
      </div>
      {entries.length > 0 && (
        <>
          <p className="meal-macros">
            蛋白質 {fmt(totals.protein)} g · 碳水 {fmt(totals.carbs)} g · 脂肪 {fmt(totals.fat)} g
          </p>
          <ul className="list" style={{ borderTop: '1px solid var(--border)' }}>
            {entries.map((e) => (
              <li key={e.id}>
                <button type="button" className="row" onClick={() => onEdit(e)}>
                  <div className="row-main">
                    <div className="row-title">{e.name}</div>
                    <div className="row-meta">{[e.brand, fmtPortion(e, e.quantity)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="row-value">{fmt(e.nutrients.calories * e.quantity)}</div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="meal-add" onClick={onAdd}>
        <Plus size={18} /> 新增食物
      </button>
    </section>
  );
}

const WATER_PRESETS = [100, 250, 350, 500];

function WaterCard({ date, logged, fromFood, target }: { date: string; logged: number; fromFood: number; target: number }) {
  const setWater = useSetWater(date);
  const total = logged + fromFood;
  // Amounts added in this session, so the last one can be undone exactly.
  const [history, setHistory] = useState<number[]>([]);
  const [custom, setCustom] = useState<string | null>(null);

  const add = (ml: number) => {
    if (!(ml > 0)) return;
    setWater.mutate(Math.min(20_000, logged + ml));
    setHistory((h) => [...h, ml]);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (last == null) return;
    setWater.mutate(Math.max(0, logged - last));
    setHistory((h) => h.slice(0, -1));
  };

  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const ml = Math.round(parseNum(custom ?? ''));
    if (!(ml > 0 && ml <= 5000)) return;
    add(ml);
    setCustom(null);
  };

  const last = history[history.length - 1];

  return (
    <section className="card card-pad" aria-label="飲水">
      <div className="water-row">
        <div className="water-amount">
          <div className="energy-label">飲水</div>
          <strong>{fmt(total)}</strong> <span className="subtle">/ {fmt(target)} ml</span>
        </div>
        {last != null && (
          <Button size="sm" variant="ghost" onClick={undo}>
            <Minus size={14} /> 撤銷 {fmt(last)} ml
          </Button>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <ProgressBar label="飲水進度" value={total} max={target} tone="water" />
      </div>

      {custom == null ? (
        <div className="water-chips">
          {WATER_PRESETS.map((ml) => (
            <button key={ml} type="button" className="chip" onClick={() => add(ml)}>
              +{ml} ml
            </button>
          ))}
          <button type="button" className="chip" onClick={() => setCustom('')}>
            自訂
          </button>
        </div>
      ) : (
        <form className="weight-inline" style={{ marginTop: 14 }} onSubmit={submitCustom}>
          <NumberInput aria-label="飲水量" value={custom} onChange={setCustom} placeholder="例如 600" suffix="ml" autoFocus />
          <Button type="submit" variant="primary" disabled={!(parseNum(custom) > 0)}>
            加入
          </Button>
          <Button variant="ghost" onClick={() => setCustom(null)}>
            取消
          </Button>
        </form>
      )}

      {fromFood > 0 && <p className="field-hint">含飲料與湯品 {fmt(fromFood)} ml（記錄食物時自動計入）</p>}
      <ErrorNote error={setWater.error} />
    </section>
  );
}

function WeightCard({ date, weightKg, fallback }: { date: string; weightKg: number | null; fallback: number }) {
  const toast = useToast();
  const setWeight = useSetWeight();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kg = parseNum(draft);
    if (!(kg >= 25 && kg <= 350)) return;
    setWeight.mutate(
      { date, kg },
      {
        onSuccess: () => {
          setEditing(false);
          toast('已記錄體重');
        },
      },
    );
  };

  if (weightKg != null && !editing) {
    return (
      <section className="card card-pad" aria-label="體重">
        <div className="water-row">
          <div className="water-amount">
            <div className="energy-label">體重</div>
            <strong>{fmt(weightKg, 1)}</strong> <span className="subtle">kg</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(String(weightKg));
              setEditing(true);
            }}
          >
            修改
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="card card-pad" aria-label="體重">
      <form onSubmit={submit}>
        <label className="energy-label" htmlFor="weight-input" style={{ display: 'block', marginBottom: 6 }}>
          記錄體重
        </label>
        <div className="weight-inline">
          <NumberInput id="weight-input" value={draft} onChange={setDraft} placeholder={fmt(fallback, 1)} suffix="kg" />
          <Button type="submit" variant="primary" loading={setWeight.isPending} disabled={!(parseNum(draft) >= 25)}>
            記錄
          </Button>
        </div>
        <p className="field-hint">建議每天早上起床、如廁後量測，趨勢會比單日數字準確。</p>
        <ErrorNote error={setWeight.error} />
      </form>
    </section>
  );
}

export function DiaryPage() {
  const profile = useProfile();
  const [date, setDate] = useState(today);
  const day = useDay(date);
  const [addMeal, setAddMeal] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  const entries = day.data?.entries ?? [];
  const totals = useMemo(() => totalsOf(entries), [entries]);
  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map((m) => [m, [] as Entry[]])) as Record<Meal, Entry[]>;
    for (const e of entries) map[e.meal].push(e);
    return map;
  }, [entries]);

  return (
    <>
      <DateNav date={date} onChange={setDate} />

      {day.isPending ? (
        <div className="center">
          <Spinner />
        </div>
      ) : day.isError ? (
        <div className="stack">
          <ErrorNote error={day.error} />
          <Button onClick={() => day.refetch()}>重試</Button>
        </div>
      ) : (
        <div className="stack">
          <DaySummary totals={totals} targets={profile.targets} calorieCeiling={profile.goal !== 'gain'} />
          {MEALS.map((m) => (
            <MealSection
              key={m}
              meal={m}
              date={date}
              entries={byMeal[m]}
              onAdd={() => setAddMeal(m)}
              onEdit={setEditing}
            />
          ))}
          <WaterCard key={date} date={date} logged={day.data.waterMl} fromFood={totals.water} target={profile.targets.water} />
          <WeightCard key={date} date={date} weightKg={day.data.weightKg} fallback={profile.weightKg} />
        </div>
      )}

      {addMeal && (
        <AddFoodSheet open date={date} initialMeal={addMeal} onClose={() => setAddMeal(null)} />
      )}
      {editing && <EntryEditor key={editing.id} entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
