// React Query hooks. Every mutation invalidates exactly the data it can change.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Meal } from '../../shared/nutrients';
import type { DayLog, Entry, FoodData, NewEntry, Profile, SavedFood, Session } from '../../shared/types';
import { api, ApiError } from './api';

export const keys = {
  session: ['session'] as const,
  day: (date: string) => ['day', date] as const,
  summary: (from: string, to: string) => ['summary', from, to] as const,
  foods: ['foods'] as const,
};

function invalidateDays(qc: QueryClient, dates: string[]) {
  for (const d of new Set(dates)) qc.invalidateQueries({ queryKey: keys.day(d) });
  qc.invalidateQueries({ queryKey: ['summary'] });
}

export function useSession() {
  return useQuery({
    queryKey: keys.session,
    queryFn: async (): Promise<Session | null> => {
      try {
        return await api.session();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

export function useProfile(): Profile {
  const { data } = useSession();
  if (!data?.profile) throw new Error('Profile not loaded');
  return data.profile;
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.saveProfile,
    onSuccess: (profile) => {
      qc.setQueryData<Session | null>(keys.session, (s) => (s ? { ...s, profile } : s));
    },
  });
}

export function useDay(date: string) {
  return useQuery({ queryKey: keys.day(date), queryFn: () => api.day(date) });
}

export function useSummary(from: string, to: string) {
  return useQuery({ queryKey: keys.summary(from, to), queryFn: () => api.summary(from, to) });
}

export function useFoods() {
  return useQuery({ queryKey: keys.foods, queryFn: api.foods, staleTime: 60_000 });
}

export function useAddEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entries, foodId }: { entries: NewEntry[]; foodId?: string }) => api.addEntries(entries, foodId),
    onSuccess: (_res, { entries }) => {
      invalidateDays(qc, entries.map((e) => e.date));
      qc.invalidateQueries({ queryKey: keys.foods });
    },
  });
}

export function useCopyEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromDate, toDate, meal }: { fromDate: string; toDate: string; meal?: Meal }) =>
      api.copyEntries(fromDate, toDate, meal),
    onSuccess: (_res, { toDate }) => invalidateDays(qc, [toDate]),
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entry }: { entry: Entry; previousDate: string }) => api.updateEntry(entry),
    onSuccess: (_res, { entry, previousDate }) => invalidateDays(qc, [entry.date, previousDate]),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: Entry) => api.deleteEntry(entry.id),
    onMutate: async (entry) => {
      // Remove immediately so the list feels instant; the refetch confirms it.
      await qc.cancelQueries({ queryKey: keys.day(entry.date) });
      qc.setQueryData<DayLog>(keys.day(entry.date), (d) =>
        d ? { ...d, entries: d.entries.filter((e) => e.id !== entry.id) } : d,
      );
    },
    onSettled: (_res, _err, entry) => invalidateDays(qc, [entry.date]),
  });
}

export function useSetWater(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ml: number) => api.setWater(date, ml),
    onMutate: async (ml) => {
      await qc.cancelQueries({ queryKey: keys.day(date) });
      const previous = qc.getQueryData<DayLog>(keys.day(date));
      qc.setQueryData<DayLog>(keys.day(date), (d) => (d ? { ...d, waterMl: ml } : d));
      return { previous };
    },
    onError: (_err, _ml, ctx) => {
      if (ctx?.previous) qc.setQueryData(keys.day(date), ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['summary'] }),
  });
}

export function useSetWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, kg }: { date: string; kg: number }) => api.setWeight(date, kg),
    onSuccess: (_res, { date }) => {
      invalidateDays(qc, [date]);
      // Profile weight (and auto targets) may have changed.
      qc.invalidateQueries({ queryKey: keys.session });
    },
  });
}

export function useDeleteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.deleteWeight(date),
    onSuccess: (_res, date) => {
      invalidateDays(qc, [date]);
      qc.invalidateQueries({ queryKey: keys.session });
    },
  });
}

export function useSaveFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (food: (FoodData & { barcode?: string | null; favorite?: boolean }) | SavedFood) =>
      'id' in food ? api.updateFood(food) : api.createFood(food),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foods }),
  });
}

export function useDeleteFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFood(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.foods }),
  });
}
