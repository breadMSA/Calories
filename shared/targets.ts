// Energy and nutrient target calculations.
// BMR: Mifflin-St Jeor. Sodium follows the Taiwan HPA daily guideline (2,400 mg).

import type { Nutrients } from './nutrients.js';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; hint: string; factor: number }> = {
  sedentary: { label: '久坐', hint: '辦公室工作，幾乎不運動', factor: 1.2 },
  light: { label: '輕度活動', hint: '每週運動 1–3 天', factor: 1.375 },
  moderate: { label: '中度活動', hint: '每週運動 3–5 天', factor: 1.55 },
  active: { label: '高度活動', hint: '每週運動 6–7 天', factor: 1.725 },
  very_active: { label: '非常高度活動', hint: '體力勞動或一天兩練', factor: 1.9 },
};

export const GOALS: Record<Goal, { label: string }> = {
  lose: { label: '減重' },
  maintain: { label: '維持' },
  gain: { label: '增重' },
};

/** Approximate energy content of 1 kg of body mass change. */
export const KCAL_PER_KG = 7700;

export interface BodyStats {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  /** Target weekly change in kg (always positive; direction comes from `goal`). */
  weeklyRateKg: number;
}

export function ageFromBirthYear(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

export function bmr({ sex, birthYear, heightCm, weightKg }: BodyStats): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageFromBirthYear(birthYear);
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(stats: BodyStats): number {
  return bmr(stats) * ACTIVITY_LEVELS[stats.activity].factor;
}

export function dailyAdjustment(stats: BodyStats): number {
  if (stats.goal === 'maintain') return 0;
  const delta = (stats.weeklyRateKg * KCAL_PER_KG) / 7;
  return stats.goal === 'lose' ? -delta : delta;
}

export interface TargetBreakdown {
  bmr: number;
  tdee: number;
  adjustment: number;
  floorApplied: boolean;
  targets: Nutrients;
}

export function recommendTargets(stats: BodyStats): TargetBreakdown {
  const b = bmr(stats);
  const t = tdee(stats);
  const adjustment = dailyAdjustment(stats);
  const floor = stats.sex === 'male' ? 1500 : 1200;
  const raw = t + adjustment;
  const calories = Math.round(Math.max(raw, floor) / 10) * 10;

  // Protein scales with body weight; higher when cutting or bulking to preserve/build lean mass.
  const proteinPerKg = stats.goal === 'maintain' ? 1.2 : 1.6;
  const protein = Math.round(stats.weightKg * proteinPerKg);
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    adjustment: Math.round(adjustment),
    floorApplied: raw < floor,
    targets: {
      calories,
      protein,
      carbs,
      fat,
      fiber: Math.round((calories / 1000) * 14),
      sugar: Math.round((calories * 0.1) / 4),
      sodium: 2400,
      water: Math.round(stats.weightKg * 30),
    },
  };
}

/**
 * Exponentially smoothed weight trend (Hacker's Diet style). Smooths day-to-day water
 * fluctuations so the trend reflects actual tissue change.
 */
export function weightTrend(points: { date: string; kg: number }[], alpha = 0.1): { date: string; kg: number; trend: number }[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let trend: number | null = null;
  return sorted.map((p) => {
    trend = trend == null ? p.kg : trend + alpha * (p.kg - trend);
    return { ...p, trend: Math.round(trend * 100) / 100 };
  });
}

/**
 * Estimates actual maintenance energy from logged intake and weight trend change.
 * Returns null when there is not enough data to say anything meaningful.
 */
export function estimateTdee(
  days: { date: string; calories: number; logged: boolean }[],
  trend: { date: string; trend: number }[],
): { kcal: number; days: number } | null {
  const logged = days.filter((d) => d.logged);
  if (logged.length < 14 || trend.length < 2) return null;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const spanDays = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (spanDays < 14) return null;
  const avgIntake = logged.reduce((s, d) => s + d.calories, 0) / logged.length;
  const dailyChange = ((last.trend - first.trend) * KCAL_PER_KG) / spanDays;
  return { kcal: Math.round((avgIntake - dailyChange) / 10) * 10, days: logged.length };
}
