// Converts the TFDA 食品營養成分資料庫 CSV (data.fda.gov.tw InfoId=20) into the
// compact per-100 g dataset served at public/data/tfda.json.
//
// Usage: node scripts/build-tfda.mjs path/to/20_2.csv
// Source: https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=20&logType=2

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/build-tfda.mjs <20_2.csv>');
  process.exit(1);
}

// Analysis item -> output field. 修正熱量 (fibre-corrected energy) wins over 熱量 when present.
const FIELDS = {
  修正熱量: 'kcalCorrected',
  熱量: 'calories',
  粗蛋白: 'protein',
  總碳水化合物: 'carbs',
  粗脂肪: 'fat',
  膳食纖維: 'fiber',
  糖質總量: 'sugar',
  鈉: 'sodium',
  水分: 'water',
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const [header, ...rows] = parseCsv(readFileSync(input, 'utf8').replace(/^﻿/, ''));
const col = Object.fromEntries(header.map((h, i) => [h, i]));

const foods = new Map();
for (const r of rows) {
  const code = r[col['整合編號']];
  if (!code) continue;
  let food = foods.get(code);
  if (!food) {
    food = {
      id: code,
      name: r[col['樣品名稱']].trim(),
      alias: r[col['俗名']].trim(),
      category: r[col['食品分類']].trim(),
      values: {},
    };
    foods.set(code, food);
  }
  const key = FIELDS[r[col['分析項']]];
  const value = parseFloat(r[col['每100克含量']]);
  if (key && Number.isFinite(value)) food.values[key] = value;
}

const round = (n) => Math.round((n ?? 0) * 10) / 10;
// Compact tuple form keeps the file small: [id, name, alias, category, kcal, P, C, F, fibre, sugar, Na, water]
const out = [...foods.values()]
  .filter((f) => f.values.calories != null || f.values.kcalCorrected != null)
  .map((f) => {
    const v = f.values;
    return [
      f.id, f.name, f.alias, f.category,
      round(v.kcalCorrected ?? v.calories),
      round(v.protein), round(v.carbs), round(v.fat), round(v.fiber),
      round(v.sugar), round(v.sodium), round(v.water),
    ];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/tfda.json', JSON.stringify(out));
console.log(`Wrote ${out.length} foods to public/data/tfda.json`);
