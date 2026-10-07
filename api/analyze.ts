// POST /api/analyze { image?: base64, mimeType?, text? } -> AnalyzeResult
// Estimates the foods in a photo and/or a free-text description with Gemini.

import { GoogleGenAI } from '@google/genai';
import { requireUser } from './_lib/auth.js';
import { query, queryOne } from './_lib/db.js';
import { HttpError, json, optionalString, readJson, route } from './_lib/http.js';
import { NUTRIENT_KEYS, sanitizeNutrients } from '../shared/nutrients.js';
import type { AnalyzedItem } from '../shared/types.js';

// Free-tier quotas are tracked per model, so when one model's quota is used up we fall back to
// the next. Flash-Lite models have the most generous free quota, so they go first.
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash-lite'];
const MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const MODEL_CHAIN = MODELS.length ? MODELS : DEFAULT_MODELS;

/** Errors worth retrying on another model: quota exhausted, overloaded, or model unavailable to this key. */
function shouldFallBack(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  const status = Number(e?.status);
  if ([403, 404, 429, 500, 503].includes(status)) return true;
  return /quota|rate|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|not found|NOT_FOUND|PERMISSION_DENIED/i.test(String(e?.message ?? ''));
}
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PROMPT = `你是台灣的註冊營養師，負責從照片或文字描述估算一餐的營養素。

規則：
- 將畫面或描述拆成個別食物（例如「雞腿便當」拆成雞腿、白飯、配菜），每一項一筆。若是單一包裝食品或飲料則只回一筆。
- 依台灣常見份量與烹調方式估算重量，再依據台灣食品營養成分資料庫的數值推算營養素。
- 若看得到營養標示，以標示為準並精確讀取（保留小數）。
- 所有數值都是「這一份的總量」，不是每 100 克。
- name 用繁體中文的常用名稱；servingAmount/servingUnit 描述估計份量，盡量用 g 或 ml（例如 180 g），無法估重時用「份」「碗」「杯」等。
- water 只計算飲料或湯品的液體量（ml），固體食物填 0。
- sugar 為總糖量，sodium 單位為 mg。
- confidence：清楚可辨識且份量明確為 high；份量或做法不確定為 medium；難以辨識為 low。
- note：一句話說明估算時的主要假設（例如「假設白飯一碗約 200 g」），沒有可留空。
- 照片中若沒有食物，回傳空的 items，並在 note 說明。`;

const nutrientProps = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, { type: 'number', minimum: 0 }]));

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          servingAmount: { type: 'number', minimum: 0 },
          servingUnit: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          ...nutrientProps,
        },
        required: ['name', 'servingAmount', 'servingUnit', 'confidence', ...NUTRIENT_KEYS],
      },
    },
    note: { type: 'string' },
  },
  required: ['items', 'note'],
};

/** Atomically counts this request against the user's daily allowance. */
async function consumeQuota(userId: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `INSERT INTO ai_usage (user_id, date, count) VALUES ($1, current_date, 1)
     ON CONFLICT (user_id, date) DO UPDATE SET count = ai_usage.count + 1
     RETURNING count`,
    [userId],
  );
  const used = Number(row?.count ?? 1);
  if (used > DAILY_LIMIT) throw new HttpError(429, `今日 AI 分析次數已達上限（${DAILY_LIMIT} 次）`);
  return DAILY_LIMIT - used;
}

async function refundQuota(userId: string): Promise<void> {
  await query(`UPDATE ai_usage SET count = greatest(count - 1, 0) WHERE user_id = $1 AND date = current_date`, [userId]);
}

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(503, 'AI 功能尚未設定（缺少 GEMINI_API_KEY）');

  const body = await readJson(req);
  const text = optionalString(body.text, 1000);
  const image = typeof body.image === 'string' ? body.image : '';
  const mimeType = typeof body.mimeType === 'string' && IMAGE_TYPES.has(body.mimeType) ? body.mimeType : 'image/jpeg';
  if (!text && !image) throw new HttpError(400, '請提供照片或文字描述');
  if (image.length * 0.75 > MAX_IMAGE_BYTES) throw new HttpError(413, '照片太大，請重新拍攝');

  const remaining = await consumeQuota(user.id);

  const parts: Array<Record<string, unknown>> = [{ text: PROMPT }];
  if (image) parts.push({ inlineData: { mimeType, data: image } });
  parts.push({ text: text ? `使用者補充說明：${text}` : '請分析這張照片。' });

  const ai = new GoogleGenAI({ apiKey });
  let raw: string | undefined;
  let lastError: unknown;
  for (const model of MODEL_CHAIN) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
        },
      });
      raw = result.text;
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      console.error(`Gemini error (${model})`, err);
      if (!shouldFallBack(err)) break;
    }
  }
  if (lastError !== undefined) {
    await refundQuota(user.id);
    if (shouldFallBack(lastError)) throw new HttpError(429, 'AI 免費額度暫時用完，請稍後再試');
    throw new HttpError(502, 'AI 分析失敗，請稍後再試');
  }

  let parsed: { items?: unknown[]; note?: unknown };
  try {
    parsed = JSON.parse(raw ?? '');
  } catch {
    await refundQuota(user.id);
    throw new HttpError(502, 'AI 回傳格式錯誤，請重試');
  }

  const items: AnalyzedItem[] = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 12).map((it) => {
    const item = (it ?? {}) as Record<string, unknown>;
    const amount = Number(item.servingAmount);
    return {
      name: optionalString(item.name, 120) || '未命名食物',
      brand: '',
      servingAmount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 10) / 10 : 1,
      servingUnit: optionalString(item.servingUnit, 20) || '份',
      nutrients: sanitizeNutrients(item),
      confidence: item.confidence === 'high' || item.confidence === 'low' ? item.confidence : 'medium',
    };
  });

  return json({ items, note: optionalString(parsed.note, 300), remaining });
});
