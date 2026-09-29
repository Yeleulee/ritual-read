import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string; // sized by font-size (e.g. text-2xl) — 1em ≈ one glyph
  autoplay?: boolean; // slow idle page turns
  label?: string;
}

// Geometry in a 120x100 viewBox; the spine is the vertical centre line (x = 60).
const VIEW = "0 0 120 100";
const MIRROR = "matrix(-1 0 0 1 120 0)";

// Left-hand page for stack layer k (0 = innermost/topmost). Outer layers step out and down.
const pagePath = (k: number) => {
  const dx = 5 * k;
  const dy = 5 * k;
  const x = 22 - dx;
  return [
    `M60 ${28 + dy}`,
    `C46 ${20 + dy} 34 ${17 + dy} ${x + 3} ${19 + dy}`,
    `Q${x} ${19.5 + dy} ${x} ${22.5 + dy}`,
    `L${x} 77`,
    `C34 77 50 79 60 86`,
    "Z",
  ].join(" ");
};

const COVER =
  "M60 42 C46 33 26 30 9 34 Q6 34.7 6 37.6 L6 80 Q6 82.6 8.6 82.3 C26 80.5 46 83.5 60 94 " +
  "C74 83.5 94 80.5 111.4 82.3 Q114 82.6 114 80 L114 37.6 Q114 34.7 111 34 C94 30 74 33 60 42 Z";

const LAYERS = [2, 1, 0];

const Stack = () => (
  <>
    {LAYERS.map((k) => (
      <path key={`l${k}`} d={pagePath(k)} className="book-logo__page" />
    ))}
    <g transform={MIRROR}>
      {LAYERS.map((k) => (
        <path key={`r${k}`} d={pagePath(k)} className="book-logo__page" />
      ))}
    </g>
  </>
);

// Open book with fanned pages; a leaf turns from the right stack to the left on a loop,
// faster on hover and in a burst on click.
export const Logo = ({ className, autoplay = true, label = "Ritual Reader" }: LogoProps) => {
  const [burst, setBurst] = useState(false);
  const timer = useRef<number>();

  const flip = () => {
    setBurst(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBurst(false), 1600);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      onClick={flip}
      className={cn("book-logo", autoplay && "book-logo--auto", burst && "book-logo--burst", className)}
    >
      <svg viewBox={VIEW} className="book-logo__base" aria-hidden focusable="false">
        <path d={COVER} className="book-logo__cover" />
        <Stack />
        <path d="M60 28 L60 86" className="book-logo__spine" />
      </svg>

      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          viewBox={VIEW}
          className="book-logo__leaf"
          style={{ "--i": i } as CSSProperties}
          aria-hidden
          focusable="false"
        >
          <g transform={MIRROR}>
            <path d={pagePath(0)} className="book-logo__page" />
          </g>
        </svg>
      ))}
    </span>
  );
};
