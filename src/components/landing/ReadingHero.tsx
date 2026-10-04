import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { ReaderIllustration } from "./ReaderIllustration";
import { FORMAT_LABELS } from "@/lib/book-formats";

const rise = (ms: number): CSSProperties => ({ "--rise-delay": `${ms}ms` } as CSSProperties);

// `from` lets "0 feeds" count down to zero instead of sitting still
const stats = [
  { n: 20, from: 0, unit: "min", body: "A daily goal small enough to keep. Big enough to finish books." },
  { n: FORMAT_LABELS.length, from: 0, unit: "formats", body: "EPUB, PDF, plain text, Word and PowerPoint — dropped in, shelved, remembered." },
  { n: 0, from: 12, unit: "feeds", body: "No recommendations, no likes, no timeline. Just the page you're on." },
];
const STAT_STAGGER = 160;
const STAT_BASE_DELAY = 200;

/** True once the element has scrolled into view (fires once). */
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function CountUp({ to, from = 0, active, delayMs = 0, durationMs = 1400 }: { to: number; from?: number; active: boolean; delayMs?: number; durationMs?: number }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : from);
  useEffect(() => {
    if (!active) return;
    if (reduced) { setValue(to); return; }
    const start = performance.now() + delayMs;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to, from, delayMs, durationMs, reduced]);
  return <>{value}</>;
}

type Segment = { text: string; className?: string };

const HEADLINE: Segment[] = [
  { text: "The calm way to read more — " },
  { text: "one book at a time", className: "font-serif italic" },
  { text: ", twenty minutes a day." },
];
const HEADLINE_DELAY = 500;
const HEADLINE_STEP = 32;
const headlineLength = HEADLINE.reduce((n, s) => n + s.text.length, 0);
// CTA starts typing once the headline has finished
const CTA_DELAY = HEADLINE_DELAY + headlineLength * HEADLINE_STEP + 300;

function useTypewriter(length: number, delayMs: number, stepMs: number) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(reduced ? length : 0);

  useEffect(() => {
    if (reduced) {
      setCount(length);
      return;
    }
    // Clock-driven rather than chained timeouts so the cadence stays exact and
    // catches up instantly after a background tab throttles timers.
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(length, Math.max(0, Math.floor((now - start - delayMs) / stepMs) + 1));
      setCount(n);
      if (n < length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [length, delayMs, stepMs, reduced]);

  return count;
}

/**
 * Every character is in the DOM from the first frame (hidden, not removed), so
 * wrapping and centring are computed on the full text and never shift mid-type.
 */
function Typed({
  segments,
  delayMs,
  stepMs = 55,
  caretAfter = "blink",
}: {
  segments: Segment[];
  delayMs: number;
  stepMs?: number;
  caretAfter?: "blink" | "hide";
}) {
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const count = useTypewriter(total, delayMs, stepMs);
  const done = count >= total;
  const caretIndex = Math.max(0, count - 1);
  const showCaret = !done || caretAfter === "blink";

  let offset = 0;
  return (
    <>
      <span className="sr-only">{segments.map((s) => s.text).join("")}</span>
      <span aria-hidden>
        {segments.map((s, si) => {
          const start = offset;
          offset += s.text.length;
          return (
            <span key={si} className={s.className}>
              {Array.from(s.text).map((ch, ci) => {
                const i = start + ci;
                const typed = i < count;
                const caret = showCaret && ((count === 0 && i === 0) || (count > 0 && i === caretIndex));
                return (
                  <span
                    key={ci}
                    className={[
                      "relative",
                      typed ? "" : "invisible",
                      caret ? (count === 0 ? "tw-caret tw-caret-start" : "tw-caret") : "",
                      caret && done ? "tw-caret-blink" : "",
                    ].join(" ")}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </>
  );
}

export function ReadingHero() {
  const [statsRef, statsInView] = useInView<HTMLDivElement>();
  return (
    <section id="hero" className="relative">
      {/* Colour block — Circle-style with a large rounded base */}
      <div className="relative overflow-hidden rounded-b-[56px] md:rounded-b-[100px] bg-[linear-gradient(135deg,#0B0B0B_0%,#161514_55%,#242220_100%)] text-white">
        <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-14 pt-14 md:pt-20 pb-20 md:pb-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <p className="animate-rise font-mono text-[11px] uppercase tracking-[0.16em] text-white/70" style={rise(0)}>
              Ritual Reader — for people who finish books
            </p>

            <div className="animate-rise mt-8 w-full" style={rise(80)}>
              <ReaderIllustration className="mx-auto w-full max-w-[620px]" />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                Drag the globe to spin it
              </p>
            </div>

            <h1
              className="animate-rise mt-8 max-w-xl font-sans font-light text-[1.75rem] sm:text-4xl leading-tight tracking-[-0.01em] text-white/90"
              style={rise(160)}
            >
              <Typed segments={HEADLINE} delayMs={HEADLINE_DELAY} stepMs={HEADLINE_STEP} caretAfter="hide" />
            </h1>

            <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-5" style={rise(240)}>
              <Link
                to="/app"
                className="group inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border border-white/40 bg-transparent px-6 text-sm font-medium text-white transition-colors hover:border-white hover:bg-white hover:text-black active:scale-[0.98]"
              >
                <Typed segments={[{ text: "Start reading for free" }]} delayMs={CTA_DELAY} stepMs={45} />
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#features" className="text-sm text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white transition-colors">
                See what's inside
              </a>
            </div>
          </div>

          {/* Formats strip — where the reference shows partner logos */}
          <ul
            className="animate-rise mt-12 md:mt-16 flex flex-wrap items-center justify-center gap-x-14 gap-y-4 border-t border-white/20 pt-6 font-mono text-[12px] uppercase tracking-[0.16em] text-white/70"
            style={rise(360)}
          >
            {FORMAT_LABELS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Stat card overlapping the block edge */}
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-14 -mt-14 md:-mt-20 relative z-10">
        <div
          ref={statsRef}
          className="animate-rise rounded-[40px] md:rounded-[80px] bg-card text-card-foreground border border-border px-8 sm:px-12 lg:px-20 py-10 md:py-14 grid md:grid-cols-3 gap-10 md:gap-6"
          style={rise(440)}
        >
          {stats.map((s, i) => {
            const delay = STAT_BASE_DELAY + i * STAT_STAGGER;
            const reveal = (extra: number) => (statsInView ? "animate-rise" : "opacity-0") + " " + extra;
            return (
              <div key={s.unit} className={i > 0 ? "md:border-l md:border-border md:pl-10" : ""}>
                <div className="flex items-baseline gap-2">
                  <span className={reveal("font-sans font-light text-[56px] md:text-[64px] leading-none tracking-[-0.03em] tabular-nums")} style={rise(delay)}>
                    <CountUp to={s.n} from={s.from} active={statsInView} delayMs={delay + 200} />
                  </span>
                  <span className={reveal("font-serif italic text-2xl text-muted-foreground")} style={rise(delay + 140)}>{s.unit}</span>
                </div>
                <span className={(statsInView ? "animate-grow-x" : "scale-x-0") + " mt-4 block h-px w-12 bg-foreground/40"} style={rise(delay + 260)} aria-hidden />
                <p className={reveal("mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[26ch]")} style={rise(delay + 300)}>{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
