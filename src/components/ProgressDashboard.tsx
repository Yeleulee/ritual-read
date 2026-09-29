import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useReadingStats } from "@/hooks/use-reading-stats";
import { SectionHeader, Stat, StatGrid, Panel, Rule, Empty } from "@/components/dashboard/primitives";

interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  lastRead?: Date;
}

interface ProgressDashboardProps {
  books: BookItem[];
}

const fmtDate = (d?: Date) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export const ProgressDashboard = ({ books }: ProgressDashboardProps) => {
  const { current, weekly, state } = useReadingStats();

  const totals = useMemo(() => {
    const completed = books.filter((b) => b.progress >= 100).length;
    const inProgress = books.filter((b) => b.progress > 0 && b.progress < 100);
    const pagesRead = books.reduce((s, b) => s + Math.floor((b.progress / 100) * b.totalPages), 0);
    const avg = books.length ? books.reduce((s, b) => s + b.progress, 0) / books.length : 0;
    const recent = books
      .filter((b) => b.lastRead)
      .sort((a, b) => (b.lastRead?.getTime() || 0) - (a.lastRead?.getTime() || 0))
      .slice(0, 5);
    return { completed, inProgress, pagesRead, avg, recent };
  }, [books]);

  const week = useMemo(() => {
    const minutes = weekly.reduce((s, d) => s + d.minutes, 0);
    const active = weekly.filter((d) => d.minutes > 0).length;
    const best = weekly.reduce((a, b) => (b.minutes > a.minutes ? b : a), weekly[0]);
    return { minutes, active, avg: Math.round(minutes / 7), best };
  }, [weekly]);

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Progress"
        title="This week"
        meta={
          week.minutes
            ? `${week.minutes} minutes across ${week.active} ${week.active === 1 ? "day" : "days"} · best day ${week.best?.day}`
            : "No sessions recorded yet."
        }
      />

      {/* Figures */}
      <StatGrid className="grid-cols-2 md:grid-cols-4">
        <Stat label="Books" value={books.length} hint={`${totals.inProgress.length} in progress`} />
        <Stat label="Finished" value={totals.completed} hint={books.length ? `${Math.round((totals.completed / books.length) * 100)}% of shelf` : undefined} />
        <Stat label="Pages read" value={totals.pagesRead.toLocaleString()} />
        <Stat label="Avg. progress" value={`${Math.round(totals.avg)}%`} hint={`Streak ${current.currentStreak}d`} />
      </StatGrid>

      {/* Weekly minutes */}
      <Panel
        title="Minutes per day"
        action={<span className="eyebrow">Goal {state.goalMinutesPerDay} min</span>}
      >
        <div className="h-[220px] sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ left: -16, right: 0, top: 8, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickMargin={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 4,
                  fontFamily: "JetBrains Mono",
                  fontSize: 12,
                  padding: "6px 10px",
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v: number) => [`${v} min`, ""]}
                separator=""
              />
              <Bar dataKey="minutes" fill="hsl(var(--foreground))" radius={0} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <div><dt>Total</dt><dd className="mt-1 text-foreground">{week.minutes} min</dd></div>
          <div><dt>Daily avg.</dt><dd className="mt-1 text-foreground">{week.avg} min</dd></div>
          <div><dt>Active days</dt><dd className="mt-1 text-foreground">{week.active} / 7</dd></div>
        </dl>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* In progress */}
        <Panel title="Currently reading" action={<span className="eyebrow">{totals.inProgress.length}</span>}>
          {totals.inProgress.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Open a book and turn a page — it will show up here.</p>
          ) : (
            <ul className="divide-y divide-border -my-2">
              {totals.inProgress.slice(0, 5).map((b) => {
                const read = Math.floor((b.progress / 100) * b.totalPages);
                return (
                  <li key={b.id} className="py-4 first:pt-2 last:pb-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-serif text-lg leading-tight truncate">{b.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{b.author}</p>
                      </div>
                      <span className="font-mono text-sm tabular-nums">{Math.round(b.progress)}%</span>
                    </div>
                    <Rule value={b.progress} className="mt-3" />
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {read} of {b.totalPages} pp · {b.totalPages - read} left
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Recent */}
        <Panel title="Recently opened">
          {totals.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Your reading history will appear here.</p>
          ) : (
            <ul className="divide-y divide-border -my-2">
              {totals.recent.map((b) => (
                <li key={b.id} className="flex items-baseline justify-between gap-4 py-3 first:pt-2 last:pb-2">
                  <div className="min-w-0">
                    <p className="font-serif text-lg leading-tight truncate">{b.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{b.author}</p>
                  </div>
                  <div className="text-right font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                    <div>{fmtDate(b.lastRead)}</div>
                    <div className="text-foreground">{b.progress >= 100 ? "Finished" : `${Math.round(b.progress)}%`}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {books.length === 0 && (
        <Empty title="Nothing to measure yet." body="Add a book in the Library tab and read for a few minutes to see your first figures here." />
      )}
    </div>
  );
};
