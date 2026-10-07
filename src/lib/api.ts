// Typed client for the /api endpoints.

import type { Meal } from '../../shared/nutrients';
import type {
  AnalyzeResult,
  BarcodeResult,
  DayLog,
  Entry,
  FoodData,
  NewEntry,
  Profile,
  SavedFood,
  Session,
  SummaryRange,
  User,
  WeightPoint,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        'x-requested-with': 'fetch',
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, '無法連線，請檢查網路');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data && typeof data.error === 'string' && data.error) || `請求失敗 (${res.status})`);
  }
  return data as T;
}

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const api = {
  session: () => request<Session>('auth'),
  login: (email: string, password: string) =>
    request<Session>('auth', { method: 'POST', body: { action: 'login', email, password } }),
  register: (body: { email: string; password: string; name: string; inviteCode: string }) =>
    request<Session>('auth', { method: 'POST', body: { action: 'register', ...body } }),
  logout: () => request<{ ok: true }>('auth', { method: 'POST', body: { action: 'logout' } }),
  changePassword: (current: string, next: string) =>
    request<{ ok: true }>('auth', { method: 'POST', body: { action: 'password', current, next } }),
  deleteAccount: (password: string) =>
    request<{ ok: true }>('auth', { method: 'POST', body: { action: 'delete', password } }),

  saveProfile: (profile: Profile) => request<Profile>('profile', { method: 'PUT', body: profile }),

  day: (date: string) => request<DayLog>(`entries?${q({ date })}`),
  entriesRange: (from: string, to: string) => request<{ entries: Entry[] }>(`entries?${q({ from, to })}`),
  addEntries: (entries: NewEntry[], foodId?: string) =>
    request<{ entries: Entry[] }>('entries', { method: 'POST', body: { entries, foodId } }),
  copyEntries: (fromDate: string, toDate: string, meal?: Meal) =>
    request<{ entries: Entry[] }>('entries', { method: 'POST', body: { action: 'copy', fromDate, toDate, meal } }),
  updateEntry: (entry: Entry) => request<Entry>('entries', { method: 'PUT', body: entry }),
  deleteEntry: (id: string) => request<{ ok: true }>(`entries?${q({ id })}`, { method: 'DELETE' }),

  setWater: (date: string, ml: number) =>
    request<{ date: string; waterMl: number }>('water', { method: 'PUT', body: { date, ml } }),

  summary: (from: string, to: string) => request<SummaryRange>(`summary?${q({ from, to })}`),
  setWeight: (date: string, kg: number) => request<WeightPoint>('weights', { method: 'PUT', body: { date, kg } }),
  deleteWeight: (date: string) => request<{ ok: true }>(`weights?${q({ date })}`, { method: 'DELETE' }),

  foods: () => request<{ saved: SavedFood[]; recent: FoodData[] }>('foods'),
  createFood: (food: FoodData & { barcode?: string | null; favorite?: boolean }) =>
    request<SavedFood>('foods', { method: 'POST', body: food }),
  updateFood: (food: SavedFood) => request<SavedFood>('foods', { method: 'PUT', body: food }),
  deleteFood: (id: string) => request<{ ok: true }>(`foods?${q({ id })}`, { method: 'DELETE' }),

  analyze: (body: { image?: string; mimeType?: string; text?: string }) =>
    request<AnalyzeResult>('analyze', { method: 'POST', body }),
  barcode: (code: string) => request<BarcodeResult>(`barcode?${q({ code })}`),
};

export type { User };
