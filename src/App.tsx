import { BookOpen, LineChart, Settings, UtensilsCrossed } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, ErrorNote, Spinner } from './components/ui';
import { AuthScreen } from './features/auth/AuthScreen';
import { DiaryPage } from './features/diary/DiaryPage';
import { FoodsPage } from './features/foods/FoodsPage';
import { Onboarding } from './features/profile/Onboarding';
import { SettingsPage } from './features/settings/SettingsPage';
import { TrendsPage } from './features/trends/TrendsPage';
import { useSession } from './lib/queries';

type Tab = 'diary' | 'trends' | 'foods' | 'settings';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'diary', label: '日記', icon: <BookOpen size={22} strokeWidth={1.75} /> },
  { id: 'trends', label: '趨勢', icon: <LineChart size={22} strokeWidth={1.75} /> },
  { id: 'foods', label: '我的食物', icon: <UtensilsCrossed size={22} strokeWidth={1.75} /> },
  { id: 'settings', label: '設定', icon: <Settings size={22} strokeWidth={1.75} /> },
];

function readTab(): Tab {
  const id = window.location.hash.replace('#/', '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : 'diary';
}

/** Hash-based tab routing keeps the back button working without a router dependency. */
function useTab(): [Tab, (tab: Tab) => void] {
  const [tab, setTab] = useState<Tab>(readTab);
  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return [
    tab,
    (next) => {
      window.location.hash = `/${next}`;
      window.scrollTo(0, 0);
    },
  ];
}

export function App() {
  const session = useSession();
  const [tab, setTab] = useTab();

  if (session.isPending) {
    return (
      <div className="fullscreen-center">
        <Spinner />
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="fullscreen-center">
        <div className="auth stack">
          <ErrorNote error={session.error} />
          <Button onClick={() => session.refetch()}>重試</Button>
        </div>
      </div>
    );
  }

  if (!session.data) return <AuthScreen />;
  if (!session.data.profile) return <Onboarding />;

  return (
    <div className="app">
      <nav className="nav" aria-label="主要導覽">
        <div className="nav-inner">
          <span className="nav-brand">飲食紀錄</span>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="nav-item"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="main">
        {tab === 'diary' && <DiaryPage />}
        {tab === 'trends' && <TrendsPage />}
        {tab === 'foods' && <FoodsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
