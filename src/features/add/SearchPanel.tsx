import { Search, Star } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorNote, Spinner } from '../../components/ui';
import { fmt, fmtPortion } from '../../lib/format';
import { useFoods } from '../../lib/queries';
import { loadTfda, searchTfda, type TfdaFood } from '../../lib/tfda';
import type { EntrySource, FoodData, SavedFood } from '../../../shared/types';

export type PickHandler = (food: FoodData, source: EntrySource, foodId?: string) => void;

function matches(food: FoodData, term: string) {
  const t = term.toLowerCase();
  return food.name.toLowerCase().includes(t) || food.brand.toLowerCase().includes(t);
}

function FoodRow({ food, meta, onClick, favorite }: { food: FoodData; meta?: string; onClick: () => void; favorite?: boolean }) {
  return (
    <li>
      <button type="button" className="row" onClick={onClick}>
        <div className="row-main">
          <div className="row-title">
            {favorite && <Star size={13} className="subtle" style={{ marginRight: 4, verticalAlign: -1 }} fill="currentColor" />}
            {food.name}
          </div>
          <div className="row-meta">{meta ?? [food.brand, fmtPortion(food)].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="row-value">
          {fmt(food.nutrients.calories)}
          <small>kcal</small>
        </div>
      </button>
    </li>
  );
}

export function SearchPanel({ onPick }: { onPick: PickHandler }) {
  const [term, setTerm] = useState('');
  const deferred = useDeferredValue(term.trim());
  const foods = useFoods();
  const [tfda, setTfda] = useState<TfdaFood[] | null>(null);
  const [tfdaError, setTfdaError] = useState<unknown>(null);

  useEffect(() => {
    loadTfda().then(setTfda, setTfdaError);
  }, []);

  const saved = foods.data?.saved ?? [];
  const recent = foods.data?.recent ?? [];

  const results = useMemo(() => {
    if (!deferred) return null;
    return {
      saved: saved.filter((f) => matches(f, deferred)).slice(0, 10),
      recent: recent.filter((f) => matches(f, deferred)).slice(0, 10),
      tfda: tfda ? searchTfda(tfda, deferred) : [],
    };
  }, [deferred, saved, recent, tfda]);

  const pickSaved = (f: SavedFood) => onPick(f, 'library', f.id);

  return (
    <div className="add-panel">
      <div className="search">
        <Search size={18} />
        <input
          className="input"
          type="search"
          placeholder="搜尋食物，例如：白飯、茶葉蛋"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="搜尋食物"
          enterKeyHint="search"
        />
      </div>

      <div style={{ marginTop: 16 }}>
        {foods.isPending && (
          <div className="center">
            <Spinner />
          </div>
        )}
        <ErrorNote error={foods.error} />

        {!results && foods.data && (
          <>
            {saved.length > 0 && (
              <section className="result-group">
                <h3 className="result-group-title">我的食物</h3>
                <ul className="list">
                  {saved.slice(0, 8).map((f) => (
                    <FoodRow key={f.id} food={f} favorite={f.favorite} onClick={() => pickSaved(f)} />
                  ))}
                </ul>
              </section>
            )}
            {recent.length > 0 && (
              <section className="result-group">
                <h3 className="result-group-title">最近吃過</h3>
                <ul className="list">
                  {recent.slice(0, 15).map((f, i) => (
                    <FoodRow key={`${f.name}-${i}`} food={f} onClick={() => onPick(f, 'library')} />
                  ))}
                </ul>
              </section>
            )}
            {saved.length === 0 && recent.length === 0 && (
              <EmptyState title="搜尋食品營養成分資料庫">
                收錄衛福部 2,000 多項台灣常見食材與料理，數值以每 100 克計。
              </EmptyState>
            )}
          </>
        )}

        {results && (
          <>
            {results.saved.length > 0 && (
              <section className="result-group">
                <h3 className="result-group-title">我的食物</h3>
                <ul className="list">
                  {results.saved.map((f) => (
                    <FoodRow key={f.id} food={f} favorite={f.favorite} onClick={() => pickSaved(f)} />
                  ))}
                </ul>
              </section>
            )}
            {results.recent.length > 0 && (
              <section className="result-group">
                <h3 className="result-group-title">最近吃過</h3>
                <ul className="list">
                  {results.recent.map((f, i) => (
                    <FoodRow key={`${f.name}-${i}`} food={f} onClick={() => onPick(f, 'library')} />
                  ))}
                </ul>
              </section>
            )}
            <section className="result-group">
              <h3 className="result-group-title">食品營養成分資料庫 · 每 100 g</h3>
              {!tfda && !tfdaError && <Spinner small />}
              <ErrorNote error={tfdaError} />
              {tfda && results.tfda.length === 0 && (
                <p className="subtle" style={{ fontSize: 13, padding: '8px 0' }}>
                  找不到「{deferred}」。可以試試較短的關鍵字，或用拍照 / 描述讓 AI 估算。
                </p>
              )}
              <ul className="list">
                {results.tfda.map((f) => (
                  <FoodRow key={f.id} food={f} meta={f.category} onClick={() => onPick(f, 'database')} />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
