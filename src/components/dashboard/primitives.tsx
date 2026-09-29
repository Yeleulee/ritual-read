import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Eyebrow + serif title row used at the top of every dashboard tab. */
export function SectionHeader({
  eyebrow,
  title,
  meta,
  action,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6", className)}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display text-3xl sm:text-4xl mt-2">{title}</h2>
        {meta && <p className="mt-2 text-sm text-muted-foreground">{meta}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/** Large figure with a mono label. Lay several out in a `StatGrid`. */
export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-background px-6 py-6", className)}>
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-sans font-light text-4xl sm:text-5xl leading-none tracking-[-0.03em] tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Hairline grid for Stats — 1px gaps over a border-coloured background survive wrapping. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-px border border-border bg-border", className)}>{children}</div>;
}

/** Hairline-bordered panel with an optional mono heading. */
export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border border-border bg-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          {title && <h3 className="eyebrow text-foreground">{title}</h3>}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** 2px progress rule. */
export function Rule({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-[2px] w-full bg-border", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-foreground transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Dashed empty-state block. */
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-border px-6 py-16 text-center">
      <p className="display text-2xl sm:text-3xl text-muted-foreground">{title}</p>
      {body && <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
