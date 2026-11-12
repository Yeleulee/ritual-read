import type { PracticeSet, PracticeStats } from "@/types/practice";

const STORAGE_KEY = "rr:practice:sets_v1";
const ACTIVITY_KEY = "rr:practice:activity_v1";

/* ───── Activity log: tracks daily practice like a GitHub heatmap ───── */

export interface PracticeDay {
  date: string; // YYYY-MM-DD
  questionsAnswered: number;
  correctCount: number;
  sessionsCompleted: number;
}

export interface PracticeActivity {
  days: PracticeDay[];
}

export function loadActivity(): PracticeActivity {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return { days: [] };
    const parsed = JSON.parse(raw) as Partial<PracticeActivity> | null;
    const days = Array.isArray(parsed?.days)
      ? parsed.days.filter(
          (d): d is PracticeDay =>
            !!d && typeof d.date === "string" && typeof d.questionsAnswered === "number"
        )
      : [];
    return { days };
  } catch {
    return { days: [] };
  }
}

function saveActivity(activity: PracticeActivity) {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
  } catch {
    /* ignore quota */
  }
}

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Log a completed practice session into the daily activity tracker */
export function logPracticeSession(questionsAnswered: number, correctCount: number): void {
  const activity = loadActivity();
  const days = Array.isArray(activity.days) ? [...activity.days] : [];
  const key = todayKey();
  const idx = days.findIndex((d) => d.date === key);
  if (idx >= 0) {
    days[idx] = {
      ...days[idx],
      questionsAnswered: days[idx].questionsAnswered + questionsAnswered,
      correctCount: days[idx].correctCount + correctCount,
      sessionsCompleted: (days[idx].sessionsCompleted || 0) + 1,
    };
  } else {
    days.push({
      date: key,
      questionsAnswered,
      correctCount,
      sessionsCompleted: 1,
    });
  }
  // Keep sorted
  days.sort((a, b) => a.date.localeCompare(b.date));
  // Keep at most 365 days
  const trimmed = days.length > 365 ? days.slice(-365) : days;
  saveActivity({ days: trimmed });
}

/** Get the current practice streak (consecutive days with at least 1 session) */
export function getPracticeStreak(): { current: number; longest: number; totalDays: number } {
  const activity = loadActivity();
  const days = Array.isArray(activity?.days) ? activity.days : [];
  const activeDates = days.filter((d) => d && d.questionsAnswered > 0).map((d) => d.date);
  const today = todayKey();

  let current = 0;
  let longest = 0;
  let streak = 0;
  let lastDate: string | null = null;

  for (const date of activeDates) {
    if (!lastDate) {
      streak = 1;
    } else {
      const diff = daysBetween(lastDate, date);
      if (diff === 1) streak += 1;
      else if (diff > 1) streak = 1;
    }
    longest = Math.max(longest, streak);
    lastDate = date;
  }

  // Current streak: walk backward from today/yesterday
  current = 0;
  lastDate = null;
  for (let i = activeDates.length - 1; i >= 0; i--) {
    const d = activeDates[i];
    if (!lastDate) {
      const gap = daysBetween(d, today);
      if (gap > 1) break;
      current = 1;
      lastDate = d;
    } else {
      const diff = daysBetween(d, lastDate);
      if (diff === 1) {
        current += 1;
        lastDate = d;
      } else if (diff === 0) {
        lastDate = d;
      } else {
        break;
      }
    }
  }

  return { current, longest, totalDays: activeDates.length };
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/* ───── Practice set CRUD ───── */

export function loadPracticeSets(): PracticeSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is PracticeSet =>
        !!s && typeof s.id === "string" && typeof s.title === "string" && Array.isArray(s.questions)
    );
  } catch (err) {
    console.error("Failed to load practice sets:", err);
    return [];
  }
}

export function savePracticeSet(set: PracticeSet): PracticeSet[] {
  try {
    const sets = loadPracticeSets();
    const index = sets.findIndex((s) => s.id === set.id);
    let next: PracticeSet[];
    if (index >= 0) {
      next = [...sets];
      next[index] = { ...set, updatedAt: Date.now() };
    } else {
      next = [set, ...sets];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch (err) {
    console.error("Failed to save practice set:", err);
    return loadPracticeSets();
  }
}

export function deletePracticeSet(id: string): PracticeSet[] {
  try {
    const sets = loadPracticeSets().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
    return sets;
  } catch (err) {
    console.error("Failed to delete practice set:", err);
    return loadPracticeSets();
  }
}

export function calculatePracticeStats(sets: PracticeSet[]): PracticeStats {
  const safeSets = Array.isArray(sets) ? sets : [];
  let totalAttempts = 0;
  let totalQuestionsAnswered = 0;
  let totalCorrect = 0;
  let scoreSum = 0;
  let scoredCount = 0;

  for (const s of safeSets) {
    if (s.lastAttempt) {
      totalAttempts += 1;
      totalQuestionsAnswered += s.lastAttempt.total;
      totalCorrect += s.lastAttempt.score;
      scoreSum += s.lastAttempt.percentage;
      scoredCount += 1;
    } else if (s.bestScore) {
      totalAttempts += 1;
      totalQuestionsAnswered += s.bestScore.total;
      totalCorrect += s.bestScore.score;
      scoreSum += s.bestScore.percentage;
      scoredCount += 1;
    }
  }

  return {
    totalSets: safeSets.length,
    totalAttempts,
    totalQuestionsAnswered,
    totalCorrect,
    averageScorePercentage: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0,
  };
}
