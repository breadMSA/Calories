import { ArrowLeft, Camera, MessageSquareText, PencilLine, ScanBarcode, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { Button, ErrorNote, Field, IconButton, TextInput } from '../../components/ui';
import { relativeDay, today } from '../../lib/dates';
import { fmt, fmtPortion } from '../../lib/format';
import { useAddEntries, useSaveFood } from '../../lib/queries';
import { MEALS, MEAL_LABELS, addNutrients, emptyNutrients, scaleNutrients, type Meal } from '../../../shared/nutrients';
import type { AnalyzeResult, AnalyzedItem, EntrySource, FoodData, NewEntry } from '../../../shared/types';
import { AiPanel } from './AiPanel';
import { BarcodePanel } from './BarcodePanel';
import { FoodForm, draftFromFood, foodFromDraft, type FoodDraft } from './FoodForm';
import { PortionEditor } from './PortionEditor';
import { SearchPanel } from './SearchPanel';

type Tab = 'search' | 'photo' | 'text' | 'barcode' | 'manual';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'search', label: '搜尋', icon: <Search size={16} /> },
  { id: 'photo', label: '拍照', icon: <Camera size={16} /> },
  { id: 'text', label: '描述', icon: <MessageSquareText size={16} /> },
  { id: 'barcode', label: '條碼', icon: <ScanBarcode size={16} /> },
  { id: 'manual', label: '自訂', icon: <PencilLine size={16} /> },
];

interface ReviewItem {
  item: AnalyzedItem;
  include: boolean;
  quantity: number;
}

type View =
  | { kind: 'browse' }
  | { kind: 'portion'; food: FoodData; source: EntrySource; foodId?: string; barcode?: string }
  | { kind: 'review'; items: ReviewItem[]; note: string; remaining: number; preview: string | null; editing: number | null };

const CONFIDENCE_LABEL = { high: '', medium: '估計', low: '不確定' } as const;

export function AddFoodSheet({
  open,
  onClose,
  date,
  initialMeal,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  initialMeal: Meal;
}) {
  const toast = useToast();
  const addEntries = useAddEntries();
  const saveFood = useSaveFood();

  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [tab, setTab] = useState<Tab>('search');
  const [view, setView] = useState<View>({ kind: 'browse' });
  const [quantity, setQuantity] = useState(1);
  const [manual, setManual] = useState<FoodDraft>(() => draftFromFood(null));
  const [manualBarcode, setManualBarcode] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Errors surface through the mutation state, so rejected promises are swallowed here.
  const finish = async (entries: NewEntry[], foodId?: string) => {
    try {
      await addEntries.mutateAsync({ entries, foodId });
    } catch {
      return;
    }
    toast(entries.length > 1 ? `已加入 ${entries.length} 項到${MEAL_LABELS[meal]}` : `已加入${MEAL_LABELS[meal]}`);
    onClose();
  };

  const toEntry = (food: FoodData, q: number, source: EntrySource): NewEntry => ({
    name: food.name,
    brand: food.brand,
    servingAmount: food.servingAmount,
    servingUnit: food.servingUnit,
    nutrients: food.nutrients,
    date,
    meal,
    quantity: Math.round(q * 1000) / 1000,
    source,
  });

  const pick = (food: FoodData, source: EntrySource, foodId?: string) => {
    setQuantity(1);
    setView({ kind: 'portion', food, source, foodId });
  };

  const onAiResult = (result: AnalyzeResult, preview: string | null) => {
    setView({
      kind: 'review',
      items: result.items.map((item) => ({ item, include: true, quantity: 1 })),
      note: result.note,
      remaining: result.remaining,
      preview,
      editing: null,
    });
  };

  const submitManual = async () => {
    const { food, error } = foodFromDraft(manual);
    setFormError(error);
    if (!food) return;
    let foodId: string | undefined;
    if (saveToLibrary || manualBarcode) {
      try {
        foodId = (await saveFood.mutateAsync({ ...food, barcode: manualBarcode })).id;
      } catch {
        return;
      }
    }
    await finish([toEntry(food, 1, foodId ? 'library' : 'manual')], foodId);
  };

  const busy = addEntries.isPending || saveFood.isPending;
  const mutationError = addEntries.error ?? saveFood.error;

  // ----- Header -----
  const mealSelect = (
    <select
      className="select add-meal-select"
      value={meal}
      onChange={(e) => setMeal(e.target.value as Meal)}
      aria-label="餐別"
    >
      {MEALS.map((m) => (
        <option key={m} value={m}>
          {MEAL_LABELS[m]}
        </option>
      ))}
    </select>
  );
  const back = (
    <IconButton label="返回" onClick={() => setView({ kind: 'browse' })}>
      <ArrowLeft size={20} />
    </IconButton>
  );
  const dateSuffix = date !== today() ? ` · ${relativeDay(date)}` : '';

  // ----- Portion view -----
  if (view.kind === 'portion') {
    const { food } = view;
    const valid = quantity > 0;
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: -12 }}>{back}份量</span>}
        headerExtra={mealSelect}
        footer={
          <Button
            variant="primary"
            disabled={!valid}
            loading={busy}
            onClick={() => finish([toEntry(food, quantity, view.source)], view.foodId)}
          >
            加入{MEAL_LABELS[meal]}
          </Button>
        }
      >
        <div className="portion-head">
          <div className="portion-name">{food.name}</div>
          <div className="portion-sub">
            {[food.brand, `每 ${fmtPortion(food)} ${fmt(food.nutrients.calories)} kcal`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <PortionEditor food={food} quantity={quantity} onChange={setQuantity} />
        <ErrorNote error={mutationError} />
      </Sheet>
    );
  }

  // ----- AI review view -----
  if (view.kind === 'review') {
    const update = (i: number, patch: Partial<ReviewItem>) =>
      setView({ ...view, items: view.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
    const selected = view.items.filter((it) => it.include && it.quantity > 0);
    const total = selected.reduce((acc, it) => addNutrients(acc, scaleNutrients(it.item.nutrients, it.quantity)), emptyNutrients());

    if (view.editing != null) {
      const current = view.items[view.editing];
      const done = () => setView({ ...view, editing: null });
      return (
        <Sheet
          open={open}
          onClose={onClose}
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: -12 }}>
              <IconButton label="返回" onClick={done}>
                <ArrowLeft size={20} />
              </IconButton>
              調整項目
            </span>
          }
          footer={
            <Button variant="primary" onClick={done} disabled={!(current.quantity > 0)}>
              完成
            </Button>
          }
        >
          <Field label="名稱" htmlFor="review-name">
            <TextInput
              id="review-name"
              value={current.item.name}
              onChange={(e) => update(view.editing!, { item: { ...current.item, name: e.target.value } })}
            />
          </Field>
          <div style={{ marginTop: 20 }}>
            <PortionEditor food={current.item} quantity={current.quantity} onChange={(q) => update(view.editing!, { quantity: q })} />
          </div>
        </Sheet>
      );
    }

    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: -12 }}>{back}分析結果</span>}
        headerExtra={mealSelect}
        footer={
          <Button
            variant="primary"
            disabled={selected.length === 0}
            loading={busy}
            onClick={() => finish(selected.map((it) => toEntry({ ...it.item, name: it.item.name.trim() || '未命名食物' }, it.quantity, 'ai')))}
          >
            加入 {selected.length} 項 · {fmt(total.calories)} kcal
          </Button>
        }
      >
        {view.preview && (
          <div className="photo-preview" style={{ marginBottom: 12 }}>
            <img src={view.preview} alt="分析的照片" style={{ maxHeight: 160 }} />
          </div>
        )}
        {view.items.length === 0 ? (
          <p className="notice">{view.note || '沒有辨識到食物，請換一張照片或改用文字描述。'}</p>
        ) : (
          <>
            <ul className="list">
              {view.items.map((it, i) => {
                const n = scaleNutrients(it.item.nutrients, it.quantity);
                return (
                  <li key={i} className={`review-item${it.include ? '' : ' is-off'}`}>
                    <input
                      type="checkbox"
                      checked={it.include}
                      onChange={(e) => update(i, { include: e.target.checked })}
                      aria-label={`包含 ${it.item.name}`}
                    />
                    <button
                      type="button"
                      className="row-main"
                      style={{ border: 0, background: 'none', padding: 0, textAlign: 'left' }}
                      onClick={() => setView({ ...view, editing: i })}
                    >
                      <div className="row-title">
                        {it.item.name}
                        {CONFIDENCE_LABEL[it.item.confidence] && (
                          <span className={`confidence confidence-${it.item.confidence}`}>
                            {CONFIDENCE_LABEL[it.item.confidence]}
                          </span>
                        )}
                      </div>
                      <div className="row-meta">
                        {fmtPortion(it.item, it.quantity)} · P {fmt(n.protein, 1)} · C {fmt(n.carbs, 1)} · F {fmt(n.fat, 1)}
                      </div>
                    </button>
                    <div className="row-value">
                      {fmt(n.calories)}
                      <small>kcal</small>
                    </div>
                  </li>
                );
              })}
            </ul>
            {view.note && (
              <p className="notice" style={{ marginTop: 12 }}>
                {view.note}
              </p>
            )}
            <p className="field-hint">點選項目可調整名稱與份量。AI 估算僅供參考。今日剩餘 {view.remaining} 次分析。</p>
          </>
        )}
        <ErrorNote error={mutationError} />
      </Sheet>
    );
  }

  // ----- Browse view (tabs) -----
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={`新增食物${dateSuffix}`}
      headerExtra={mealSelect}
      footer={
        tab === 'manual' ? (
          <Button variant="primary" loading={busy} onClick={submitManual}>
            加入{MEAL_LABELS[meal]}
          </Button>
        ) : undefined
      }
    >
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'search' && <SearchPanel onPick={pick} />}
      {tab === 'photo' && <AiPanel key="photo" mode="photo" onResult={onAiResult} />}
      {tab === 'text' && <AiPanel key="text" mode="text" onResult={onAiResult} />}
      {tab === 'barcode' && (
        <BarcodePanel
          onFound={(r) => pick(r, 'barcode', 'id' in r && typeof r.id === 'string' ? r.id : undefined)}
          onNotFound={(code) => {
            setManual(draftFromFood({ servingUnit: 'g', servingAmount: 100 }));
            setManualBarcode(code);
            setSaveToLibrary(true);
            setTab('manual');
          }}
        />
      )}
      {tab === 'manual' && (
        <div className="add-panel">
          {manualBarcode && (
            <p className="notice" style={{ marginBottom: 16 }}>
              條碼 {manualBarcode}：依包裝上的營養標示填寫，儲存後下次掃描會直接帶出。
            </p>
          )}
          <FoodForm draft={manual} onChange={setManual} />
          <label className="check" style={{ marginTop: 16 }}>
            <input
              type="checkbox"
              checked={saveToLibrary || Boolean(manualBarcode)}
              disabled={Boolean(manualBarcode)}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
            />
            儲存到「我的食物」
          </label>
          <div style={{ marginTop: 12 }}>
            {formError && <p className="field-error">{formError}</p>}
            <ErrorNote error={mutationError} />
          </div>
        </div>
      )}
    </Sheet>
  );
}
