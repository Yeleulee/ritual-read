import { useMemo } from "react";
import { loadActivity, getPracticeStreak, type PracticeDay } from "@/lib/practice-storage";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HeatmapCell {
  date: string;
  count: number;
  correct: number;
  sessions: number;
}

interface PracticeHeatmapProps {
  /** Number of weeks to show (default 20 ≈ ~5 months) */
  weeks?: number;
  className?: string;
}

/** GitHub-style contribution graph for daily practice activity */
export function PracticeHeatmap({ weeks = 20, className }: PracticeHeatmapProps) {
  const { grid, totalQuestions, streak } = useMemo(() => {
    const activity = loadActivity();
    const streakData = getPracticeStreak();
    const dayMap = new Map<string, PracticeDay>();
    (Array.isArray(activity?.days) ? activity.days : []).forEach((d) => dayMap.set(d.date, d));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Anchor the first column on a Sunday so Mon/Wed/Fri rows match calendar weekdays
    const startOffset = (weeks - 1) * 7 + today.getDay();
    const columns: (HeatmapCell | null)[][] = [];
    let total = 0;

    for (let w = 0; w < weeks; w++) {
      const col: (HeatmapCell | null)[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const offset = startOffset - (w * 7 + dow);
        if (offset < 0) {
          col.push(null);
          continue;
        }
        const d = new Date(today);
        d.setDate(today.getDate() - offset);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const key = `${y}-${m}-${day}`;
        const entry = dayMap.get(key);
        const count = entry?.questionsAnswered ?? 0;
        total += count;
        col.push({
          date: key,
          count,
          correct: entry?.correctCount ?? 0,
          sessions: entry?.sessionsCompleted ?? 0,
        });
      }
      columns.push(col);
    }

    return { grid: columns, totalQuestions: total, streak: streakData };
  }, [weeks]);

  const getLevel = (count: number): number => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  };

  const levelColors = [
    "bg-muted/50 dark:bg-muted/30",                             // 0
    "bg-emerald-200 dark:bg-emerald-900/60",                     // 1
    "bg-emerald-400 dark:bg-emerald-700/80",                     // 2
    "bg-emerald-500 dark:bg-emerald-600",                        // 3
    "bg-emerald-700 dark:bg-emerald-500",                        // 4
  ];

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((col, colIdx) => {
      const firstDay = col[0];
      if (!firstDay) return;
      const d = new Date(`${firstDay.date}T00:00:00`);
      const month = d.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: d.toLocaleDateString(undefined, { month: "short" }),
          col: colIdx,
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [grid]);

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-foreground tabular-nums">{totalQuestions}</span>
          <span className="text-muted-foreground">questions practiced</span>
        </div>
        <span className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-foreground tabular-nums">{streak.current}</span>
          <span className="text-muted-foreground">day streak</span>
        </div>
        <span className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-foreground tabular-nums">{streak.longest}</span>
          <span className="text-muted-foreground">longest</span>
        </div>
        <span className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-foreground tabular-nums">{streak.totalDays}</span>
          <span className="text-muted-foreground">active days</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-0.5">
          {/* Month labels */}
          <div className="flex items-center" style={{ paddingLeft: 28 }}>
            {grid.map((_col, colIdx) => {
              const label = monthLabels.find((m) => m.col === colIdx);
              return (
                <div key={colIdx} className="w-[13px] mx-[1px]">
                  {label && (
                    <span className="text-[9px] font-mono text-muted-foreground leading-none">
                      {label.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          {Array.from({ length: 7 }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex items-center gap-0">
              <span className="w-7 text-right text-[9px] font-mono text-muted-foreground pr-1.5 leading-none">
                {dayLabels[rowIdx]}
              </span>
              {grid.map((col, colIdx) => {
                const cell = col[rowIdx];
                if (!cell) return <div key={colIdx} className="w-[13px] h-[13px] mx-[1px]" />;
                const level = getLevel(cell.count);
                const dateLabel = new Date(`${cell.date}T00:00:00`).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <Tooltip key={colIdx}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "w-[13px] h-[13px] mx-[1px] rounded-[3px] transition-colors border",
                          levelColors[level],
                          level === 0 ? "border-border/30" : "border-transparent"
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[11px] px-2 py-1.5">
                      {cell.count > 0 ? (
                        <span>
                          <strong>{cell.count}</strong> questions
                          {cell.correct > 0 && <> · <strong>{cell.correct}</strong> correct</>}
                          {cell.sessions > 0 && <> · {cell.sessions} session{cell.sessions > 1 ? "s" : ""}</>}
                          <br />
                          <span className="text-muted-foreground">{dateLabel}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No practice — {dateLabel}</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        {levelColors.map((color, i) => (
          <div
            key={i}
            className={cn("w-[11px] h-[11px] rounded-[2px] border", color, i === 0 ? "border-border/30" : "border-transparent")}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
