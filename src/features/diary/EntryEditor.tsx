// Edit a logged entry: portion, meal, date, nutrients; delete; save to library.

import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { Button, ErrorNote, Field, Segmented, TextInput } from '../../components/ui';
import { useAddEntries, useDeleteEntry, useSaveFood, useUpdateEntry } from '../../lib/queries';
import { MEALS, MEAL_LABELS, type Meal } from '../../../shared/nutrients';
import type { Entry } from '../../../shared/types';
import { FoodForm, draftFromFood, foodFromDraft } from '../add/FoodForm';
import { PortionEditor } from '../add/PortionEditor';

const SOURCE_LABELS: Record<Entry['source'], string> = {
  manual: '自訂',
  ai: 'AI 估算',
  barcode: '條碼',
  database: '衛福部資料庫',
  library: '我的食物',
};

export function EntryEditor({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const restore = useAddEntries();
  const saveFood = useSaveFood();

  const [mode, setMode] = useState<'portion' | 'details'>('portion');
  const [quantity, setQuantity] = useState(entry.quantity);
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [date, setDate] = useState(entry.date);
  const [draft, setDraft] = useState(() => draftFromFood(entry));
  const [formError, setFormError] = useState<string | null>(null);

  const save = () => {
    const { food, error } = foodFromDraft(draft);
    setFormError(error);
    if (!food || !(quantity > 0) || !date) return;
    update.mutate(
      { entry: { ...entry, ...food, quantity, meal, date }, previousDate: entry.date },
      {
        onSuccess: () => {
          toast('已更新');
          onClose();
        },
      },
    );
  };

  const onDelete = () => {
    remove.mutate(entry, {
      onSuccess: () => {
        onClose();
        const { id: _id, createdAt: _createdAt, ...rest } = entry;
        toast(`已刪除「${entry.name}」`, {
          action: { label: '復原', run: () => restore.mutate({ entries: [rest] }) },
        });
      },
    });
  };

  const onSaveToLibrary = () => {
    const { food, error } = foodFromDraft(draft);
    setFormError(error);
    if (!food) return;
    saveFood.mutate(food, { onSuccess: () => toast('已儲存到我的食物') });
  };

  const portionFood = foodFromDraft(draft).food ?? entry;

  return (
    <Sheet
      open
      onClose={onClose}
      title="編輯紀錄"
      footer={
        <>
          <Button variant="danger" onClick={onDelete} loading={remove.isPending}>
            刪除
          </Button>
          <Button variant="primary" onClick={save} loading={update.isPending} style={{ flex: 2 }}>
            儲存
          </Button>
        </>
      }
    >
      <div className="portion-head">
        <div className="portion-name">{entry.name}</div>
        <div className="portion-sub">
          <span className="source-tag">{SOURCE_LABELS[entry.source]}</span>
          {entry.brand}
        </div>
      </div>

      <Segmented
        label="編輯模式"
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'portion', label: '份量' },
          { value: 'details', label: '名稱與營養素' },
        ]}
      />

      <div style={{ marginTop: 20 }}>
        {mode === 'portion' ? (
          <PortionEditor food={portionFood} quantity={quantity} onChange={setQuantity} />
        ) : (
          <FoodForm draft={draft} onChange={setDraft} />
        )}
      </div>

      <div className="field-row" style={{ marginTop: 20 }}>
        <Field label="餐別" htmlFor="entry-meal">
          <select id="entry-meal" className="select" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="日期" htmlFor="entry-date">
          <TextInput id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        {formError && <p className="field-error">{formError}</p>}
        <ErrorNote error={update.error ?? remove.error ?? saveFood.error} />
        {entry.source !== 'library' && (
          <Button variant="ghost" size="sm" onClick={onSaveToLibrary} loading={saveFood.isPending}>
            儲存到我的食物
          </Button>
        )}
      </div>
    </Sheet>
  );
}
