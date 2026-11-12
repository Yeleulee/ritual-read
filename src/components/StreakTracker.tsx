import { useReadingStats } from "@/hooks/use-reading-stats";
import { cn } from "@/lib/utils";
import { SectionHeader, Stat, StatGrid, Panel } from "@/components/dashboard/primitives";
import { PracticeHeatmap } from "@/components/practice/PracticeHeatmap";
import { Flame, Clock, CheckCircle2, Sparkles, Target } from "lucide-react";

interface StreakTrackerProps {
  detailed?: boolean;
}

const GOALS = [10, 20, 30, 45, 60];
const MILESTONES = [
  { days: 1, label: "First day" },
  { days: 7, label: "One week" },
  { days: 14, label: "Two weeks" },
  { days: 30, label: "One month" },
  { days: 100, label: "One hundred days" },
];

export const StreakTracker = ({ detailed = false }: StreakTrackerProps) => {
  const { state, current, weekly, setGoalMinutes } = useReadingStats();

  const minutesRead = Math.floor((current.todayProgress / 100) * state.goalMinutesPerDay);
  const minutesLeft = Math.max(0, state.goalMinutesPerDay - minutesRead);
  const goalMet = minutesLeft === 0;
  const isZero = current.currentStreak === 0;

  // Compact header widget
  if (!detailed) {
    return (
      <div className="group relative flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-border/70 bg-card/60 hover:bg-card hover:border-border transition-all shadow-sm">
        {/* Streak Flame / Day indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "grid place-items-center w-5 h-5 rounded-full transition-transform group-hover:scale-110",
              isZero ? "bg-amber-500/10 text-amber-500" : "bg-orange-500/15 text-orange-500",
            )}
          >
            <Flame className={cn("w-3.5 h-3.5", isZero ? "fill-amber-500/20" : "fill-orange-500 animate-pulse")} />
          </div>
          <span className="font-mono text-xs font-medium text-foreground tracking-tight">
            {isZero ? "Day 1" : `${current.currentStreak}d`}
          </span>
        </div>

        <span className="h-3 w-px bg-border/80" />

        {/* Minutes left / Goal status */}
        <div className="flex items-center gap-1.5">
          {goalMet ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Met
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
              <Clock className="w-3 h-3 text-amber-500/80" />
              <span>{minutesLeft}m left</span>
            </span>
          )}

          {/* Micro Progress Bar */}
          <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden ml-0.5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                goalMet
                  ? "bg-emerald-500"
                  : current.todayProgress > 0
                  ? "bg-gradient-to-r from-amber-500 to-emerald-500"
                  : "bg-amber-500/30",
              )}
              style={{ width: `${Math.max(goalMet ? 100 : 6, Math.min(100, current.todayProgress))}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  const next = MILESTONES.find((m) => m.days > current.currentStreak);

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Streaks & Momentum"
        title={
          isZero ? (
            "Ignite your daily ritual."
          ) : (
            <>
              {current.currentStreak} {current.currentStreak === 1 ? "day" : "days"}{" "}
              <span className="text-muted-foreground">in a row.</span>
            </>
          )
        }
        meta={
          goalMet
            ? "Today's daily reading goal is achieved!"
            : `${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"} today unlocks your streak.`
        }
      />

      {/* Motivational Day 1 Banner when streak is 0 */}
      {isZero && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/70 to-orange-500/5 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-inner">
                <Flame className="h-6 w-6 fill-amber-500/30 text-amber-500 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-xl sm:text-2xl font-normal text-foreground">
                    Day 1 Ready to Ignite
                  </h3>
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-400">
                    Next: 1st Day Badge
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
                  {goalMet
                    ? "Fantastic! You have completed today's reading goal. Your 1-day streak badge is primed and ready."
                    : `Read for just ${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"} today to officially start your streak.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-none">
              <div className="rounded-xl border border-border bg-background/80 px-4 py-2.5 text-center min-w-[120px] shadow-xs">
                <div className="flex items-center justify-center gap-1 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Remaining</span>
                </div>
                <div className="mt-1 font-mono text-xl font-light text-foreground">
                  {goalMet ? "0 min" : `${minutesLeft} min`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <StatGrid className="grid-cols-3">
        <Stat
          label="Current Streak"
          value={
            isZero ? (
              <span className="inline-flex items-center gap-2 text-amber-500 font-sans font-light">
                0 <Flame className="w-7 h-7 text-amber-500/70" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 font-sans font-light">
                {current.currentStreak} <Flame className="w-7 h-7 text-orange-500 fill-orange-500 animate-pulse" />
              </span>
            )
          }
          hint={
            isZero ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">Ready to ignite today</span>
            ) : (
              `${current.currentStreak} consecutive days`
            )
          }
        />
        <Stat
          label="Best Streak"
          value={state.longestStreak}
          hint={state.longestStreak > 0 ? "Personal record" : "Set your first record"}
        />
        <Stat
          label="Today's Progress"
          value={
            <span className={cn(goalMet ? "text-emerald-500 font-normal" : "font-light")}>
              {Math.min(100, Math.round(current.todayProgress))}%
            </span>
          }
          hint={
            goalMet ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Goal achieved!</span>
            ) : (
              `${minutesRead} of ${state.goalMinutesPerDay} min (${minutesLeft} min left)`
            )
          }
        />
      </StatGrid>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Weekly Calendar */}
        <Panel title="This week" className="lg:col-span-3">
          <ol className="grid grid-cols-7 gap-2">
            {weekly.map((d, i) => (
              <li key={i} className="text-center">
                <span className="eyebrow block">{d.day.slice(0, 1)}</span>
                <div
                  className={cn(
                    "mt-2 flex aspect-square items-center justify-center border font-mono text-sm tabular-nums transition-colors",
                    d.read ? "border-foreground bg-foreground text-background font-medium" : "border-border text-muted-foreground",
                  )}
                  aria-label={`${d.day}: ${d.read ? `${d.minutes} minutes` : "no reading"}`}
                >
                  {d.read ? d.minutes : "·"}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Minutes read per day. A filled square is a day the goal was met.</p>
        </Panel>

        {/* Daily Goal Configuration & Minutes Progress */}
        <Panel title="Daily goal" className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-sans font-light text-5xl leading-none tracking-[-0.03em] tabular-nums">{state.goalMinutesPerDay}</span>
              <span className="font-serif italic text-xl text-muted-foreground">minutes</span>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-medium border",
                  goalMet
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                {goalMet ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {goalMet ? "Goal met" : `${minutesLeft}m left`}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground font-mono mb-1.5">
              <span>{minutesRead} min read</span>
              <span>{Math.round(current.todayProgress)}% of target</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  goalMet
                    ? "bg-emerald-500"
                    : current.todayProgress > 0
                    ? "bg-gradient-to-r from-amber-500 to-emerald-500"
                    : "bg-amber-500/30",
                )}
                style={{ width: `${Math.max(goalMet ? 100 : 0, Math.min(100, current.todayProgress))}%` }}
              />
            </div>
          </div>

          {/* Goal Selector Buttons */}
          <div className="mt-5 grid grid-cols-5 border border-border divide-x divide-border rounded-lg overflow-hidden">
            {GOALS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGoalMinutes(m)}
                aria-pressed={state.goalMinutesPerDay === m}
                className={cn(
                  "min-h-[44px] h-11 font-mono text-xs tabular-nums transition-colors",
                  state.goalMinutesPerDay === m
                    ? "bg-foreground text-background font-semibold"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {m}m
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {goalMet
              ? "You have reached your goal for today! Keep reading for extra momentum."
              : current.todayProgress === 0
              ? "0 min read today. Even a 5-minute session builds your reading ritual."
              : `Great momentum! Just ${minutesLeft} more minutes to complete today's goal.`}
          </p>
        </Panel>
      </div>

      {/* GitHub-style Practice Heatmap */}
      <Panel title="Questions Practiced (Streak Tracker)">
        <PracticeHeatmap weeks={22} />
      </Panel>

      {/* Milestones */}
      <Panel
        title="Milestones"
        action={
          next &&
          (() => {
            const d = next.days - current.currentStreak;
            return (
              <span className="eyebrow flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-500" />
                {d} {d === 1 ? "day" : "days"} to {next.label.toLowerCase()}
              </span>
            );
          })()
        }
      >
        <ol className="divide-y divide-border -my-2">
          {MILESTONES.map((m) => {
            const earned = current.currentStreak >= m.days || state.longestStreak >= m.days;
            const isNextMilestone = next?.days === m.days;
            return (
              <li
                key={m.days}
                className={cn(
                  "flex items-center justify-between gap-4 py-3 first:pt-2 last:pb-2 transition-colors",
                  isNextMilestone && "bg-amber-500/5 -mx-5 px-5 rounded-md",
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "grid place-items-center h-4 w-4 rounded-full border text-[9px] font-bold",
                      earned
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isNextMilestone
                        ? "border-amber-500 bg-amber-500/20 text-amber-600"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {earned ? "✓" : isNextMilestone ? "•" : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-serif text-lg", !earned && !isNextMilestone && "text-muted-foreground")}>
                      {m.label}
                    </span>
                    {isNextMilestone && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-400">
                        Next Target
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {earned ? "Reached" : `${m.days} days`}
                </span>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
};
