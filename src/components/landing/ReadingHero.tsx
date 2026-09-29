import { Link } from "react-router-dom";
import { useEffect, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { ReaderIllustration } from "./ReaderIllustration";

const rise = (ms: number): CSSProperties => ({ "--rise-delay": `${ms}ms` } as CSSProperties);

const stats = [
  { n: "20", unit: "min", body: "A daily goal small enough to keep. Big enough to finish books." },
  { n: "3", unit: "formats", body: "EPUB, PDF and plain text — dropped in, shelved, remembered." },
  { n: "0", unit: "feeds", body: "No recommendations, no likes, no timeline. Just the page you're on." },
];

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
            {["EPUB", "PDF", "TXT"].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Stat card overlapping the block edge */}
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-14 -mt-14 md:-mt-20 relative z-10">
        <div
          className="animate-rise rounded-[40px] md:rounded-[80px] bg-card text-card-foreground border border-border px-8 sm:px-12 lg:px-20 py-10 md:py-14 grid md:grid-cols-3 gap-10 md:gap-6"
          style={rise(440)}
        >
          {stats.map((s, i) => (
            <div key={s.unit} className={i > 0 ? "md:border-l md:border-border md:pl-10" : ""}>
              <div className="flex items-baseline gap-2">
                <span className="font-sans font-light text-[56px] md:text-[64px] leading-none tracking-[-0.03em]">{s.n}</span>
                <span className="font-serif italic text-2xl text-muted-foreground">{s.unit}</span>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[26ch]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
