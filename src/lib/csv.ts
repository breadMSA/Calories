import { MEAL_LABELS, NUTRIENT_KEYS, NUTRIENT_META } from '../../shared/nutrients';
import type { Entry } from '../../shared/types';

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesToCsv(entries: Entry[]): string {
  const header = [
    '日期',
    '餐別',
    '名稱',
    '品牌',
    '份量',
    '單位',
    '份數',
    ...NUTRIENT_KEYS.map((k) => `${NUTRIENT_META[k].label} (${NUTRIENT_META[k].unit})`),
  ];
  const rows = entries.map((e) => [
    e.date,
    MEAL_LABELS[e.meal],
    e.name,
    e.brand,
    e.servingAmount,
    e.servingUnit,
    e.quantity,
    ...NUTRIENT_KEYS.map((k) => Math.round(e.nutrients[k] * e.quantity * 10) / 10),
  ]);
  // BOM so Excel opens UTF-8 correctly.
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
