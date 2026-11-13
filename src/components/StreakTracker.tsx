import { useReadingStats } from "@/hooks/use-reading-stats";
import { cn } from "@/lib/utils";
import { SectionHeader, Stat, StatGrid, Panel, Rule } from "@/components/dashboard/primitives";
import { PracticeHeatmap } from "@/components/practice/PracticeHeatmap";
import { Flame, Clock, CheckCircle2, Compass } from "lucide-react";

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
      <div className="group relative flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/80 hover:bg-card hover:border-border transition-all shadow-xs">
        {/* Streak Flame / Day indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "grid place-items-center w-5 h-5 rounded-full transition-transform group-hover:scale-105",
              isZero ? "bg-muted text-muted-foreground" : "bg-streak/15 text-streak",
            )}
          >
            <Flame className="w-3.5 h-3.5" strokeWidth={1.75} />
          </div>
          <span className="font-mono text-xs font-medium text-foreground tracking-tight tabular-nums">
            {isZero ? "Day 1" : `${current.currentStreak}d`}
          </span>
        </div>

        <span className="h-3 w-px bg-border" />

        {/* Minutes left / Goal status */}
        <div className="flex items-center gap-1.5">
          {goalMet ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-foreground">
              <CheckCircle2 className="w-3 h-3 text-streak" strokeWidth={1.75} /> Met
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
              <Clock className="w-3 h-3 text-muted-foreground/75" strokeWidth={1.75} />
              <span className="tabular-nums">{minutesLeft}m left</span>
            </span>
          )}

          {/* Micro Progress Bar */}
          <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden ml-0.5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                goalMet ? "bg-foreground" : current.todayProgress > 0 ? "bg-streak" : "bg-muted-foreground/30",
              )}
              style={{ width: `${Math.max(goalMet ? 100 : 6, Math.min(100, current.todayProgress))}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  const next = MILESTONES.find((m) => m.days > current.currentStreak);
  const totalWeeklyMinutes = weekly.reduce((s, d) => s + d.minutes, 0);
  const activeDaysCount = weekly.filter((d) => d.read).length;
  const weeklyAvg = Math.round(totalWeeklyMinutes / 7);

  return (
    <div className="space-y-10">
      {/* Section Header */}
      <SectionHeader
        eyebrow="Momentum & Streaks"
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
            ? "Today's daily reading goal is achieved."
            : `${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"} today to complete today's streak.`
        }
      />

      {/* Motivational Day 1 Editorial Panel when streak is 0 */}
      {isZero && (
        <div className="border border-border/70 bg-card/60 p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 transition-colors">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 flex-none place-items-center border border-border bg-background text-streak">
              <Flame className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-serif text-xl sm:text-2xl font-normal text-foreground">
                  Day 1 of your reading ritual
                </h3>
                <span className="eyebrow bg-secondary px-2 py-0.5 text-[10px] text-foreground">
                  Ready to begin
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
                {goalMet
                  ? "Great job! You have reached today's reading goal. Your first day milestone is active."
                  : `Read for ${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"} today to officially start your streak.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-none">
            <div className="border border-border bg-background px-5 py-2.5 text-center min-w-[130px]">
              <p className="eyebrow text-[10px]">Today's Target</p>
              <p className="font-mono text-xl font-light text-foreground mt-0.5 tabular-nums">
                {goalMet ? "0 min" : `${minutesLeft} min`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Figures — Symmetrical 4-stat grid matching Progress */}
      <StatGrid className="grid-cols-2 md:grid-cols-4">
        <Stat
          label="Current Streak"
          value={
            <span className="inline-flex items-center gap-2 font-light">
              {current.currentStreak}
              <Flame className="w-7 h-7 text-streak" strokeWidth={1.75} />
            </span>
          }
          hint={isZero ? "Kindle your first day" : `${current.currentStreak} consecutive days`}
        />
        <Stat
          label="Best Record"
          value={`${state.longestStreak}d`}
          hint={state.longestStreak > 0 ? "Longest streak achieved" : "Set your first record"}
        />
        <Stat
          label="Today's Reading"
          value={`${minutesRead} min`}
          hint={`${Math.min(100, Math.round(current.todayProgress))}% of daily goal`}
        />
        <Stat
          label="Daily Goal"
          value={`${state.goalMinutesPerDay} min`}
          hint={goalMet ? "Daily target met today" : `${minutesLeft} min remaining`}
        />
      </StatGrid>

      {/* Balanced 2-Column Row — Mirroring Progress Currently Reading & Recently Opened */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly Consistency Calendar */}
        <Panel
          title="Weekly consistency"
          action={<span className="eyebrow">{activeDaysCount} / 7 active days</span>}
        >
          <ol className="grid grid-cols-7 gap-2">
            {weekly.map((d, i) => (
              <li key={i} className="text-center">
                <span className="eyebrow block">{d.day.slice(0, 1)}</span>
                <div
                  className={cn(
                    "mt-2 flex aspect-square items-center justify-center border font-mono text-sm tabular-nums transition-colors",
                    d.read
                      ? "border-foreground bg-foreground text-background font-medium"
                      : "border-border text-muted-foreground",
                  )}
                  aria-label={`${d.day}: ${d.read ? `${d.minutes} minutes` : "no reading"}`}
                >
                  {d.read ? d.minutes : "·"}
                </div>
              </li>
            ))}
          </ol>
          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <div>
              <dt>Total read</dt>
              <dd className="mt-1 text-foreground tabular-nums">{totalWeeklyMinutes} min</dd>
            </div>
            <div>
              <dt>Active days</dt>
              <dd className="mt-1 text-foreground tabular-nums">{activeDaysCount} / 7</dd>
            </div>
            <div>
              <dt>Daily avg.</dt>
              <dd className="mt-1 text-foreground tabular-nums">{weeklyAvg} min</dd>
            </div>
          </dl>
        </Panel>

        {/* Daily Goal Configuration & Minutes Progress */}
        <Panel
          title="Daily reading target"
          action={<span className="eyebrow">{goalMet ? "Goal met" : `${minutesLeft}m remaining`}</span>}
        >
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span className="font-sans font-light text-5xl leading-none tracking-[-0.03em] tabular-nums">
                {state.goalMinutesPerDay}
              </span>
              <span className="font-serif italic text-xl text-muted-foreground">minutes / day</span>
            </div>
            <div className="text-right font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
              {minutesRead} of {state.goalMinutesPerDay} min
            </div>
          </div>

          <div className="mt-4">
            <Rule value={current.todayProgress} />
          </div>

          {/* Goal Selector Buttons */}
          <div className="mt-6">
            <p className="eyebrow mb-2">Adjust Target</p>
            <div className="grid grid-cols-5 border border-border divide-x divide-border">
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
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {goalMet
              ? "You have reached your goal for today! Keep reading for extra focus time."
              : current.todayProgress === 0
              ? "Even a brief 5-minute session builds your reading ritual."
              : `Great momentum! Just ${minutesLeft} more minutes to complete today's goal.`}
          </p>
        </Panel>
      </div>

      {/* GitHub-style Practice Activity Heatmap */}
      <Panel
        title="Study & Question Activity"
        action={<span className="eyebrow">Question momentum</span>}
      >
        <PracticeHeatmap weeks={22} />
      </Panel>

      {/* Milestones */}
      <Panel
        title="Ritual Milestones"
        action={
          next && (
            <span className="eyebrow flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-streak" strokeWidth={1.75} />
              {next.days - current.currentStreak} {next.days - current.currentStreak === 1 ? "day" : "days"} to {next.label.toLowerCase()}
            </span>
          )
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
                  "flex items-center justify-between gap-4 py-3.5 first:pt-2 last:pb-2 transition-colors",
                  isNextMilestone && "bg-secondary/30 -mx-5 px-5",
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "grid place-items-center h-5 w-5 border text-xs font-mono transition-colors",
                      earned
                        ? "border-foreground bg-foreground text-background font-bold"
                        : isNextMilestone
                        ? "border-streak text-streak bg-streak/10"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {earned ? "✓" : isNextMilestone ? "•" : ""}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("font-serif text-lg", !earned && !isNextMilestone && "text-muted-foreground")}>
                      {m.label}
                    </span>
                    {isNextMilestone && (
                      <span className="eyebrow border border-border bg-background px-2 py-0.5 text-[10px]">
                        Next Target
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
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
