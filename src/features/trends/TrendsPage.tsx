import { Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useToast } from '../../components/Toast';
import { Button, EmptyState, ErrorNote, Field, IconButton, NumberInput, Segmented, Spinner, TextInput, parseNum } from '../../components/ui';
import { addDays, dateRange, daysBetween, longDate, today } from '../../lib/dates';
import { fmt, fmtNutrient } from '../../lib/format';
import { useDeleteWeight, useProfile, useSetWeight, useSummary } from '../../lib/queries';
import { LIMIT_NUTRIENTS, NUTRIENT_KEYS, NUTRIENT_META, emptyNutrients } from '../../../shared/nutrients';
import { estimateTdee, weightTrend } from '../../../shared/targets';
import { CalorieBars, WeightChart } from './charts';

type Range = '7' | '30' | '90';

/** Weights before the visible range warm up the smoothed trend. */
const TREND_WARMUP_DAYS = 30;

function WeightLog({ weights }: { weights: { date: string; kg: number }[] }) {
  const toast = useToast();
  const setWeight = useSetWeight();
  const deleteWeight = useDeleteWeight();
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  const [showAll, setShowAll] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = parseNum(kg);
    if (!(value >= 25 && value <= 350) || !date) return;
    setWeight.mutate({ date, kg: value }, { onSuccess: () => { setKg(''); toast('已記錄體重'); } });
  };

  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
  const visible = showAll ? sorted : sorted.slice(0, 7);

  return (
    <section className="card">
      <form className="card-pad" onSubmit={submit} style={{ paddingBottom: 12 }}>
        <div className="field-row" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'end' }}>
          <Field label="日期" htmlFor="w-date">
            <TextInput id="w-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="體重" htmlFor="w-kg">
            <NumberInput id="w-kg" value={kg} onChange={setKg} suffix="kg" />
          </Field>
          <Button type="submit" variant="primary" loading={setWeight.isPending} disabled={!(parseNum(kg) >= 25)}>
            記錄
          </Button>
        </div>
        <ErrorNote error={setWeight.error ?? deleteWeight.error} />
      </form>
      {visible.length > 0 && (
        <ul className="list" style={{ borderTop: '1px solid var(--border)' }}>
          {visible.map((w) => (
            <li key={w.date} className="row" style={{ minHeight: 48 }}>
              <div className="row-main">{longDate(w.date)}</div>
              <div className="row-value">{fmt(w.kg, 1)} kg</div>
              <IconButton label={`刪除 ${longDate(w.date)} 的體重`} onClick={() => deleteWeight.mutate(w.date)}>
                <Trash2 size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > 7 && (
        <button type="button" className="meal-add" style={{ color: 'var(--text-2)' }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? '收合' : `顯示全部 ${sorted.length} 筆`}
        </button>
      )}
    </section>
  );
}

export function TrendsPage() {
  const profile = useProfile();
  const [range, setRange] = useState<Range>('30');
  const to = today();
  const from = addDays(to, -(Number(range) - 1));
  const summary = useSummary(addDays(from, -TREND_WARMUP_DAYS), to);

  const data = useMemo(() => {
    if (!summary.data) return null;
    const byDate = new Map(summary.data.days.map((d) => [d.date, d]));
    const days = dateRange(from, to).map((date) => {
      const d = byDate.get(date);
      return {
        date,
        totals: d?.totals ?? emptyNutrients(),
        waterMl: d?.waterMl ?? 0,
        logged: (d?.entryCount ?? 0) > 0,
        calories: d?.totals.calories ?? 0,
      };
    });
    const logged = days.filter((d) => d.logged);
    const avg = emptyNutrients();
    for (const k of NUTRIENT_KEYS) {
      avg[k] = logged.length ? logged.reduce((s, d) => s + d.totals[k], 0) / logged.length : 0;
    }
    const water = days.filter((d) => d.waterMl > 0 || d.logged);
    avg.water = water.length ? water.reduce((s, d) => s + d.waterMl + d.totals.water, 0) / water.length : 0;

    const trendAll = weightTrend(summary.data.weights);
    const trend = trendAll.filter((p) => p.date >= from);
    const change = trend.length >= 2 ? trend[trend.length - 1].trend - trend[0].trend : null;
    const spanDays = trend.length >= 2 ? Math.max(1, daysBetween(trend[0].date, trend[trend.length - 1].date)) : 1;
    const tdee = estimateTdee(days, trend);
    return { days, logged, avg, trend, change, weeklyChange: change == null ? null : (change / spanDays) * 7, tdee };
  }, [summary.data, from, to]);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">趨勢</h1>
        <div style={{ width: 180 }}>
          <Segmented
            label="期間"
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 天' },
              { value: '30', label: '30 天' },
              { value: '90', label: '90 天' },
            ]}
          />
        </div>
      </header>

      {summary.isPending && (
        <div className="center">
          <Spinner />
        </div>
      )}
      <ErrorNote error={summary.error} />

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">平均攝取</div>
              <div className="stat-value">
                {data.logged.length ? fmt(data.avg.calories) : '—'} <small>kcal</small>
              </div>
              <div className="stat-sub">目標 {fmt(profile.targets.calories)} kcal</div>
            </div>
            <div className="stat">
              <div className="stat-label">記錄天數</div>
              <div className="stat-value">
                {data.logged.length} <small>/ {data.days.length} 天</small>
              </div>
              <div className="stat-sub">只計入有紀錄的日子</div>
            </div>
            <div className="stat">
              <div className="stat-label">體重變化（趨勢）</div>
              <div className="stat-value">
                {data.change == null ? '—' : `${data.change > 0 ? '+' : data.change < 0 ? '−' : ''}${fmt(Math.abs(data.change), 1)}`}{' '}
                <small>kg</small>
              </div>
              <div className="stat-sub">
                {data.change == null
                  ? '至少需要兩筆體重'
                  : `約每週 ${data.weeklyChange! > 0 ? '+' : ''}${fmt(data.weeklyChange!, 2)} kg`}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">估計實際消耗</div>
              <div className="stat-value">
                {data.tdee ? fmt(data.tdee.kcal) : '—'} <small>kcal</small>
              </div>
              <div className="stat-sub">{data.tdee ? `依 ${data.tdee.days} 天紀錄推算` : '需 14 天以上的飲食與體重紀錄'}</div>
            </div>
          </div>

          <h2 className="section-label">每日熱量</h2>
          <section className="card card-pad">
            {data.logged.length === 0 ? (
              <EmptyState title="這段期間沒有飲食紀錄" />
            ) : (
              <CalorieBars days={data.days} target={profile.targets.calories} ceiling={profile.goal !== 'gain'} />
            )}
          </section>

          <h2 className="section-label">每日平均營養素</h2>
          <section className="card card-pad">
            <table className="nutrient-table">
              <thead>
                <tr>
                  <th>營養素</th>
                  <th>平均</th>
                  <th>目標</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {NUTRIENT_KEYS.map((k) => {
                  const target = profile.targets[k];
                  const limit = LIMIT_NUTRIENTS.has(k);
                  return (
                    <tr key={k}>
                      <td>{NUTRIENT_META[k].label}</td>
                      <td className={limit && data.avg[k] > target ? 'is-over' : undefined}>
                        {data.logged.length ? fmtNutrient(k, data.avg[k]) : '—'}
                      </td>
                      <td className="subtle">
                        {limit ? '≤ ' : ''}
                        {fmtNutrient(k, target)}
                      </td>
                      <td className="subtle">{data.logged.length && target ? `${Math.round((data.avg[k] / target) * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <h2 className="section-label">體重</h2>
          {data.trend.length > 0 && (
            <section className="card card-pad" style={{ marginBottom: 12 }}>
              <WeightChart points={data.trend} />
              <p className="field-hint">趨勢線經過平滑處理，可過濾水分與飲食造成的每日波動。</p>
            </section>
          )}
          <WeightLog weights={summary.data!.weights.filter((w) => w.date >= from)} />
        </>
      )}
    </>
  );
}
