import { useState, type FormEvent } from 'react';
import { Button, ErrorNote } from '../../components/ui';
import { useSaveProfile, useSession } from '../../lib/queries';
import { recommendTargets } from '../../../shared/targets';
import { BodyForm, TargetBreakdownView, draftFromProfile, validateBody } from './BodyForm';

export function Onboarding() {
  const { data } = useSession();
  const save = useSaveProfile();
  const [draft, setDraft] = useState(() => draftFromProfile(null));
  const [submitted, setSubmitted] = useState(false);
  const { stats } = validateBody(draft);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!stats) return;
    save.mutate({ ...stats, targetMode: 'auto', targets: recommendTargets(stats).targets });
  };

  return (
    <form className="onboarding" onSubmit={onSubmit} noValidate>
      <p className="onboarding-step">嗨，{data?.user.name}</p>
      <h1 className="page-title" style={{ marginBottom: 6 }}>
        設定你的基本資料
      </h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        用來計算每日熱量與營養素目標，之後可以在設定中修改。
      </p>

      <BodyForm draft={draft} onChange={setDraft} showErrors={submitted} />

      {stats && (
        <>
          <h2 className="section-label">建議目標</h2>
          <div className="card card-pad">
            <TargetBreakdownView stats={stats} />
          </div>
        </>
      )}

      <div className="stack" style={{ marginTop: 24 }}>
        <ErrorNote error={save.error} />
        <Button type="submit" variant="primary" block loading={save.isPending}>
          開始使用
        </Button>
      </div>
    </form>
  );
}
