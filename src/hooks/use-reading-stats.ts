import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  seconds: number;
  pages?: number;
}

export interface ReadingStatsState {
  daily: DailyEntry[];
  goalMinutesPerDay: number;
  longestStreak: number;
}

const STORAGE_KEY = "reading_stats_v1";

function todayKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function dayDiff(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00Z");
  const b = new Date(bISO + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function load(): ReadingStatsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { daily: [], goalMinutesPerDay: 20, longestStreak: 0 };
    const parsed = JSON.parse(raw) as ReadingStatsState;
    if (!Array.isArray(parsed.daily)) parsed.daily = [];
    if (typeof parsed.goalMinutesPerDay !== "number") parsed.goalMinutesPerDay = 20;
    if (typeof parsed.longestStreak !== "number") parsed.longestStreak = 0;
    return parsed;
  } catch {
    return { daily: [], goalMinutesPerDay: 20, longestStreak: 0 };
  }
}

function save(state: ReadingStatsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// One store shared by every subscriber (reader, header widget, Streaks and Progress tabs), so
// seconds logged in the reader show up everywhere immediately. Persisted with a debounce and
// kept in sync across tabs via the `storage` event.
let store: ReadingStatsState | null = null;
const listeners = new Set<() => void>();
let saveTimer: number | null = null;

function getStore(): ReadingStatsState {
  if (!store) store = load();
  return store;
}

function setStore(next: ReadingStatsState) {
  store = next;
  listeners.forEach((l) => l());
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => save(next), 250);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  store = load();
  listeners.forEach((l) => l());
}

function longestStreakOf(daily: DailyEntry[]): number {
  let streak = 0, best = 0;
  let last: string | null = null;
  for (const d of daily) {
    if (d.seconds <= 0) continue;
    if (!last) streak = 1;
    else {
      const diff = dayDiff(last, d.date);
      if (diff === 1) streak += 1; else if (diff > 1) streak = 1;
    }
    best = Math.max(best, streak);
    last = d.date;
  }
  return best;
}

export function useReadingStats() {
  const state = useSyncExternalStore(subscribe, getStore, getStore);

  // Re-derive "today" when the date rolls over while the app stays open
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const tick = () => setToday((prev) => { const k = todayKey(); return k === prev ? prev : k; });
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const addSeconds = useCallback((sec: number) => {
    if (sec <= 0) return;
    const prev = getStore();
    const key = todayKey();
    const daily = [...prev.daily];
    const idx = daily.findIndex(d => d.date === key);
    if (idx >= 0) daily[idx] = { ...daily[idx], seconds: daily[idx].seconds + sec };
    else daily.push({ date: key, seconds: sec });
    daily.sort((a, b) => a.date.localeCompare(b.date));
    setStore({ ...prev, daily, longestStreak: Math.max(prev.longestStreak, longestStreakOf(daily)) });
  }, []);

  const setGoalMinutes = useCallback((m: number) => {
    const prev = getStore();
    setStore({ ...prev, goalMinutesPerDay: Math.max(1, Math.min(240, Math.round(m))) });
  }, []);

  const current = useMemo(() => {
    const entry = state.daily.find(d => d.date === today);
    const seconds = entry?.seconds || 0;
    const minutes = Math.floor(seconds / 60);
    const todayProgress = Math.min(100, Math.round((seconds / 60) / state.goalMinutesPerDay * 100));

    // Compute current streak based on consecutive days with any reading
    const sorted = [...state.daily].filter(d => d.seconds > 0).sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    let last: string | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const d = sorted[i].date;
      if (!last) {
        // Ensure streak anchors at today or yesterday; if last read was earlier, streak is 0/1 accordingly
        const gap = dayDiff(d, today);
        if (gap > 1) { streak = 0; break; }
        streak = 1;
        last = d;
      } else {
        const diff = dayDiff(d, last);
        if (diff === 1) { streak += 1; last = d; } else if (diff === 0) { last = d; } else { break; }
      }
    }

    return { seconds, minutes, todayProgress, currentStreak: streak };
  }, [state.daily, state.goalMinutesPerDay, today]);

  // Last 7 days summary
  const weekly = useMemo(() => {
    const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const out: { day: string; read: boolean; minutes: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const found = state.daily.find(e => e.date === key);
      out.push({ day: labels[d.getDay()], read: !!(found && found.seconds > 0), minutes: found ? Math.floor(found.seconds/60) : 0 });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `today` forces a refresh at midnight
  }, [state.daily, today]);

  return {
    state,
    current,
    weekly,
    setGoalMinutes,
    addSeconds,
  };
}


