import { useReadingStats } from "@/hooks/use-reading-stats";
import { cn } from "@/lib/utils";
import { SectionHeader, Stat, StatGrid, Panel, Rule } from "@/components/dashboard/primitives";

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

  // Compact header widget
  if (!detailed) {
    return (
      <div className="w-44">
        <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.12em]">
          <span className="text-foreground">{current.currentStreak}-day streak</span>
          <span className="text-muted-foreground">{goalMet ? "Goal met" : `${minutesLeft} min left`}</span>
        </div>
        <Rule value={current.todayProgress} className="mt-2" />
      </div>
    );
  }

  const next = MILESTONES.find((m) => m.days > current.currentStreak);

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Streaks"
        title={
          current.currentStreak === 0
            ? "Start today."
            : <>{current.currentStreak} {current.currentStreak === 1 ? "day" : "days"} <span className="text-muted-foreground">in a row.</span></>
        }
        meta={
          goalMet
            ? "Today's goal is met."
            : `${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"} today keeps it going.`
        }
      />

      <StatGrid className="grid-cols-3">
        <Stat label="Current" value={current.currentStreak} hint="days" />
        <Stat label="Longest" value={state.longestStreak} hint="days" />
        <Stat label="Today" value={`${Math.min(100, current.todayProgress)}%`} hint={`${minutesRead} of ${state.goalMinutesPerDay} min`} />
      </StatGrid>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Week */}
        <Panel title="This week" className="lg:col-span-3">
          <ol className="grid grid-cols-7 gap-2">
            {weekly.map((d, i) => (
              <li key={i} className="text-center">
                <span className="eyebrow block">{d.day.slice(0, 1)}</span>
                <div
                  className={cn(
                    "mt-2 flex aspect-square items-center justify-center border font-mono text-sm tabular-nums",
                    d.read ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
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

        {/* Goal */}
        <Panel title="Daily goal" className="lg:col-span-2">
          <div className="flex items-baseline gap-2">
            <span className="font-sans font-light text-5xl leading-none tracking-[-0.03em] tabular-nums">{state.goalMinutesPerDay}</span>
            <span className="font-serif italic text-xl text-muted-foreground">minutes</span>
          </div>
          <Rule value={current.todayProgress} className="mt-5" />
          <div className="mt-5 grid grid-cols-5 border border-border divide-x divide-border">
            {GOALS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGoalMinutes(m)}
                aria-pressed={state.goalMinutesPerDay === m}
                className={cn(
                  "h-10 font-mono text-xs tabular-nums transition-colors",
                  state.goalMinutesPerDay === m ? "bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Twenty minutes is enough to finish a book a month.</p>
        </Panel>
      </div>

      {/* Milestones */}
      <Panel
        title="Milestones"
        action={next && (() => { const d = next.days - current.currentStreak; return <span className="eyebrow">{d} {d === 1 ? "day" : "days"} to {next.label.toLowerCase()}</span>; })()}
      >
        <ol className="divide-y divide-border -my-2">
          {MILESTONES.map((m) => {
            const earned = current.currentStreak >= m.days || state.longestStreak >= m.days;
            return (
              <li key={m.days} className="flex items-center justify-between gap-4 py-3 first:pt-2 last:pb-2">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className={cn("h-2.5 w-2.5 border", earned ? "border-foreground bg-foreground" : "border-border")}
                  />
                  <span className={cn("font-serif text-lg", !earned && "text-muted-foreground")}>{m.label}</span>
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
