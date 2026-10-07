// API contract shared by server handlers and the client.

import type { Meal, Nutrients } from './nutrients.js';
import type { ActivityLevel, Goal, Sex } from './targets.js';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Profile {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  weeklyRateKg: number;
  /** 'auto' recalculates targets from body stats; 'custom' keeps user-entered values. */
  targetMode: 'auto' | 'custom';
  targets: Nutrients;
}

export interface Session {
  user: User;
  profile: Profile | null;
}

export type EntrySource = 'manual' | 'ai' | 'barcode' | 'database' | 'library';

/** A food definition: nutrients are for one serving of `servingAmount` `servingUnit`. */
export interface FoodData {
  name: string;
  brand: string;
  servingAmount: number;
  servingUnit: string;
  nutrients: Nutrients;
}

export interface Entry extends FoodData {
  id: string;
  date: string;
  meal: Meal;
  /** Number of servings eaten. */
  quantity: number;
  source: EntrySource;
  createdAt: string;
}

export type NewEntry = Omit<Entry, 'id' | 'createdAt'>;

export interface SavedFood extends FoodData {
  id: string;
  barcode: string | null;
  favorite: boolean;
  useCount: number;
}

export interface DayLog {
  date: string;
  entries: Entry[];
  waterMl: number;
  weightKg: number | null;
}

export interface DaySummary {
  date: string;
  totals: Nutrients;
  entryCount: number;
  waterMl: number;
}

export interface SummaryRange {
  days: DaySummary[];
  weights: WeightPoint[];
}

export interface WeightPoint {
  date: string;
  kg: number;
}

export interface AnalyzedItem extends FoodData {
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalyzeResult {
  items: AnalyzedItem[];
  note: string;
  remaining: number;
}

export interface BarcodeResult extends FoodData {
  barcode: string;
  /** Per-100 g/ml values when the product only lists those. */
  per100: Nutrients | null;
  servingGrams: number | null;
}
