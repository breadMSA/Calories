import { Plus, Search, Star } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { Button, EmptyState, ErrorNote, Field, IconButton, Spinner, TextInput } from '../../components/ui';
import { fmt, fmtPortion } from '../../lib/format';
import { useDeleteFood, useFoods, useSaveFood } from '../../lib/queries';
import type { SavedFood } from '../../../shared/types';
import { FoodForm, draftFromFood, foodFromDraft } from '../add/FoodForm';

function FoodEditor({ food, onClose }: { food: SavedFood | null; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveFood();
  const remove = useDeleteFood();
  const [draft, setDraft] = useState(() => draftFromFood(food));
  const [barcode, setBarcode] = useState(food?.barcode ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const { food: data, error: err } = foodFromDraft(draft);
    setError(err);
    if (!data) return;
    const payload = { ...data, barcode: barcode.trim() || null, favorite: food?.favorite ?? false };
    save.mutate(food ? { ...food, ...payload } : payload, {
      onSuccess: () => {
        toast(food ? '已更新' : '已建立');
        onClose();
      },
    });
  };

  const onDelete = () => {
    if (!food || !window.confirm(`刪除「${food.name}」？已記錄的飲食不受影響。`)) return;
    remove.mutate(food.id, {
      onSuccess: () => {
        toast('已刪除');
        onClose();
      },
    });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={food ? '編輯食物' : '建立食物'}
      footer={
        <>
          {food && (
            <Button variant="danger" onClick={onDelete} loading={remove.isPending}>
              刪除
            </Button>
          )}
          <Button variant="primary" onClick={submit} loading={save.isPending} style={{ flex: 2 }}>
            儲存
          </Button>
        </>
      }
    >
      <FoodForm draft={draft} onChange={setDraft} />
      <div style={{ marginTop: 16 }}>
        <Field label="條碼（選填）" htmlFor="food-barcode" hint="填入後，掃描此條碼會直接帶出這個食物">
          <TextInput
            id="food-barcode"
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
      </div>
      <div style={{ marginTop: 12 }}>
        {error && <p className="field-error">{error}</p>}
        <ErrorNote error={save.error ?? remove.error} />
      </div>
    </Sheet>
  );
}

export function FoodsPage() {
  const foods = useFoods();
  const save = useSaveFood();
  const [term, setTerm] = useState('');
  const [editing, setEditing] = useState<SavedFood | 'new' | null>(null);

  const saved = foods.data?.saved ?? [];
  const t = term.trim().toLowerCase();
  const filtered = t ? saved.filter((f) => f.name.toLowerCase().includes(t) || f.brand.toLowerCase().includes(t)) : saved;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">我的食物</h1>
        <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
          <Plus size={16} /> 建立
        </Button>
      </header>

      <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
        常吃的料理、自己的食譜或包裝食品，建立一次之後即可快速記錄。加上星號的會排在最前面。
      </p>

      {saved.length > 5 && (
        <div className="search" style={{ marginBottom: 12 }}>
          <Search size={18} />
          <input
            className="input"
            type="search"
            placeholder="搜尋我的食物"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="搜尋我的食物"
          />
        </div>
      )}

      {foods.isPending && (
        <div className="center">
          <Spinner />
        </div>
      )}
      <ErrorNote error={foods.error ?? save.error} />

      {foods.data && (
        <section className="card">
          {filtered.length === 0 ? (
            <EmptyState title={t ? '找不到符合的食物' : '還沒有建立任何食物'}>
              {!t && '也可以在記錄飲食時勾選「儲存到我的食物」。'}
            </EmptyState>
          ) : (
            <ul className="list">
              {filtered.map((f) => (
                <li key={f.id} className="row" style={{ paddingRight: 8 }}>
                  <button
                    type="button"
                    className="row-main"
                    style={{ border: 0, background: 'none', padding: 0, textAlign: 'left' }}
                    onClick={() => setEditing(f)}
                  >
                    <div className="row-title">{f.name}</div>
                    <div className="row-meta">
                      {[f.brand, fmtPortion(f), f.useCount ? `記錄 ${f.useCount} 次` : null].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                  <div className="row-value">
                    {fmt(f.nutrients.calories)}
                    <small>kcal</small>
                  </div>
                  <IconButton
                    label={f.favorite ? '取消星號' : '加上星號'}
                    aria-pressed={f.favorite}
                    onClick={() => save.mutate({ ...f, favorite: !f.favorite })}
                  >
                    <Star size={18} fill={f.favorite ? 'currentColor' : 'none'} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editing && <FoodEditor food={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
