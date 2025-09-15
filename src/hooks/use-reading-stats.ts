import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export function useReadingStats() {
  const [state, setState] = useState<ReadingStatsState>(() => load());
  const saveRef = useRef<number | null>(null);

  // Debounced save
  useEffect(() => {
    if (saveRef.current) window.clearTimeout(saveRef.current);
    saveRef.current = window.setTimeout(() => save(state), 250);
    return () => {
      if (saveRef.current) window.clearTimeout(saveRef.current);
    };
  }, [state]);

  const addSeconds = useCallback((sec: number) => {
    if (sec <= 0) return;
    setState(prev => {
      const today = todayKey();
      const daily = [...prev.daily];
      const idx = daily.findIndex(d => d.date === today);
      if (idx >= 0) daily[idx] = { ...daily[idx], seconds: daily[idx].seconds + sec };
      else daily.push({ date: today, seconds: sec });

      // Recompute longest streak
      daily.sort((a, b) => a.date.localeCompare(b.date));
      let streak = 0, best = 0;
      let last: string | null = null;
      for (const d of daily) {
        if (d.seconds <= 0) continue;
        if (!last) {
          streak = 1;
        } else {
          const diff = dayDiff(last, d.date);
          if (diff === 1) streak += 1; else if (diff === 0) {/* same day */} else streak = 1;
        }
        best = Math.max(best, streak);
        last = d.date;
      }

      return { ...prev, daily, longestStreak: best };
    });
  }, []);

  const setGoalMinutes = useCallback((m: number) => {
    setState(prev => ({ ...prev, goalMinutesPerDay: Math.max(1, Math.min(240, Math.round(m))) }));
  }, []);

  const current = useMemo(() => {
    const today = todayKey();
    const entry = state.daily.find(d => d.date === today);
    const seconds = entry?.seconds || 0;
    const minutes = Math.floor(seconds / 60);
    const todayProgress = Math.min(100, Math.round((seconds / 60) / state.goalMinutesPerDay * 100));

    // Compute current streak based on consecutive days with any reading
    const sorted = [...state.daily].filter(d => d.seconds > 0).sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    let last: string | null = null;
    const todayISO = todayKey();
    for (let i = sorted.length - 1; i >= 0; i--) {
      const d = sorted[i].date;
      if (!last) {
        // Ensure streak anchors at today or yesterday; if last read was earlier, streak is 0/1 accordingly
        const gap = dayDiff(d, todayISO);
        if (gap > 1) { streak = 0; break; }
        streak = 1;
        last = d;
      } else {
        const diff = dayDiff(d, last);
        if (diff === 1) { streak += 1; last = d; } else if (diff === 0) { last = d; } else { break; }
      }
    }

    return { seconds, minutes, todayProgress, currentStreak: streak };
  }, [state.daily, state.goalMinutesPerDay]);

  // Last 7 days summary
  const weekly = useMemo(() => {
    const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const out: { day: string; read: boolean; minutes: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const found = state.daily.find(e => e.date === key);
      out.push({ day: labels[d.getDay()], read: !!(found && found.seconds > 0), minutes: found ? Math.floor(found.seconds/60) : 0 });
    }
    return out;
  }, [state.daily]);

  return {
    state,
    current,
    weekly,
    setGoalMinutes,
    addSeconds,
  };
}


