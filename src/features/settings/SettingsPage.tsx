import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useToast } from '../../components/Toast';
import { Button, ErrorNote, Field, NumberInput, Segmented, TextInput, parseNum } from '../../components/ui';
import { api } from '../../lib/api';
import { entriesToCsv, downloadFile } from '../../lib/csv';
import { addDays, today } from '../../lib/dates';
import { keys, useProfile, useSaveProfile, useSession } from '../../lib/queries';
import { LIMIT_NUTRIENTS, NUTRIENT_KEYS, NUTRIENT_META, type NutrientKey } from '../../../shared/nutrients';
import { recommendTargets } from '../../../shared/targets';
import type { Profile } from '../../../shared/types';
import { BodyForm, TargetBreakdownView, draftFromProfile, validateBody } from '../profile/BodyForm';

function ProfileSection() {
  const toast = useToast();
  const profile = useProfile();
  const save = useSaveProfile();
  const [draft, setDraft] = useState(() => draftFromProfile(profile));
  const [mode, setMode] = useState<Profile['targetMode']>(profile.targetMode);
  const [custom, setCustom] = useState<Record<NutrientKey, string>>(() => {
    const out = {} as Record<NutrientKey, string>;
    for (const k of NUTRIENT_KEYS) out[k] = String(profile.targets[k]);
    return out;
  });
  const [submitted, setSubmitted] = useState(false);
  const { stats } = validateBody(draft);

  const fillRecommended = () => {
    if (!stats) return;
    const t = recommendTargets(stats).targets;
    const out = {} as Record<NutrientKey, string>;
    for (const k of NUTRIENT_KEYS) out[k] = String(t[k]);
    setCustom(out);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!stats) return;
    const targets = recommendTargets(stats).targets;
    if (mode === 'custom') {
      for (const k of NUTRIENT_KEYS) {
        const v = parseNum(custom[k]);
        targets[k] = Number.isFinite(v) && v >= 0 ? v : targets[k];
      }
    }
    save.mutate({ ...stats, targetMode: mode, targets }, { onSuccess: () => toast('已儲存') });
  };

  return (
    <form onSubmit={onSubmit}>
      <h2 className="section-label">身體資料與目標</h2>
      <section className="card card-pad">
        <BodyForm draft={draft} onChange={setDraft} showErrors={submitted} />
      </section>

      <h2 className="section-label">每日營養目標</h2>
      <section className="card card-pad">
        <Segmented
          label="目標設定方式"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'auto', label: '自動計算' },
            { value: 'custom', label: '自訂' },
          ]}
        />
        <div style={{ marginTop: 16 }}>
          {mode === 'auto' ? (
            stats ? (
              <>
                <TargetBreakdownView stats={stats} />
                <p className="field-hint">依 Mifflin-St Jeor 公式計算，記錄新體重時會自動更新。</p>
              </>
            ) : (
              <p className="subtle">請先填寫完整的身體資料。</p>
            )
          ) : (
            <>
              <div className="nutrient-form">
                {NUTRIENT_KEYS.map((k) => (
                  <Field key={k} label={`${NUTRIENT_META[k].label}${LIMIT_NUTRIENTS.has(k) ? '上限' : ''}`} htmlFor={`t-${k}`}>
                    <NumberInput
                      id={`t-${k}`}
                      value={custom[k]}
                      onChange={(v) => setCustom({ ...custom, [k]: v })}
                      suffix={NUTRIENT_META[k].unit}
                    />
                  </Field>
                ))}
              </div>
              <Button size="sm" variant="ghost" style={{ marginTop: 12 }} onClick={fillRecommended} disabled={!stats}>
                填入建議值
              </Button>
            </>
          )}
        </div>
      </section>

      <div className="stack" style={{ marginTop: 16 }}>
        <ErrorNote error={save.error} />
        <Button type="submit" variant="primary" block loading={save.isPending}>
          儲存變更
        </Button>
      </div>
    </form>
  );
}

function ExportSection() {
  const toast = useToast();
  const [from, setFrom] = useState(() => addDays(today(), -29));
  const [to, setTo] = useState(today);
  const exportCsv = useMutation({
    mutationFn: () => api.entriesRange(from, to),
    onSuccess: ({ entries }) => {
      if (!entries.length) return toast('這段期間沒有紀錄');
      downloadFile(`飲食紀錄_${from}_${to}.csv`, entriesToCsv(entries));
    },
  });

  return (
    <>
      <h2 className="section-label">匯出資料</h2>
      <section className="card card-pad">
        <div className="field-row">
          <Field label="開始" htmlFor="ex-from">
            <TextInput id="ex-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="結束" htmlFor="ex-to">
            <TextInput id="ex-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="stack" style={{ marginTop: 16 }}>
          <ErrorNote error={exportCsv.error} />
          <Button block onClick={() => exportCsv.mutate()} loading={exportCsv.isPending} disabled={!from || !to || from > to}>
            下載 CSV
          </Button>
        </div>
      </section>
    </>
  );
}

function AccountSection() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const changePassword = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setShowPassword(false);
      toast('密碼已更新，其他裝置已登出');
    },
  });

  const signOut = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      qc.clear();
      qc.setQueryData(keys.session, null);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (password: string) => api.deleteAccount(password),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(keys.session, null);
    },
  });

  const onDelete = () => {
    const password = window.prompt('刪除帳號會永久移除所有紀錄，無法復原。\n請輸入密碼確認：');
    if (password) deleteAccount.mutate(password);
  };

  return (
    <>
      <h2 className="section-label">帳號</h2>
      <section className="card card-pad">
        <dl style={{ margin: 0 }}>
          <div className="kv">
            <dt>名稱</dt>
            <dd>{data?.user.name}</dd>
          </div>
          <div className="kv">
            <dt>Email</dt>
            <dd>{data?.user.email}</dd>
          </div>
        </dl>

        {showPassword ? (
          <form
            style={{ marginTop: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              changePassword.mutate();
            }}
          >
            <Field label="目前密碼" htmlFor="pw-current">
              <TextInput id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="新密碼" htmlFor="pw-next" hint="至少 8 個字元">
              <TextInput id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <div className="stack" style={{ marginTop: 16 }}>
              <ErrorNote error={changePassword.error} />
              <div className="button-row">
                <Button variant="ghost" onClick={() => setShowPassword(false)}>
                  取消
                </Button>
                <Button type="submit" variant="primary" loading={changePassword.isPending} disabled={!current || next.length < 8}>
                  更新密碼
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="button-row" style={{ marginTop: 16 }}>
            <Button size="sm" onClick={() => setShowPassword(true)}>
              變更密碼
            </Button>
            <Button size="sm" onClick={() => signOut.mutate()} loading={signOut.isPending}>
              登出
            </Button>
          </div>
        )}
      </section>

      <section className="card card-pad" style={{ marginTop: 12 }}>
        <p style={{ fontWeight: 550, fontSize: 14 }}>刪除帳號</p>
        <p className="subtle" style={{ fontSize: 13, margin: '4px 0 12px' }}>
          永久刪除帳號與所有飲食、體重紀錄。建議先匯出資料。
        </p>
        <ErrorNote error={deleteAccount.error} />
        <Button size="sm" variant="danger" onClick={onDelete} loading={deleteAccount.isPending}>
          刪除帳號
        </Button>
      </section>
    </>
  );
}

export function SettingsPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">設定</h1>
      </header>
      <ProfileSection />
      <ExportSection />
      <AccountSection />
      <p className="subtle" style={{ fontSize: 12, marginTop: 32, textAlign: 'center' }}>
        食品資料來源：衛生福利部食品藥物管理署「食品營養成分資料庫」、Open Food Facts
      </p>
    </>
  );
}
