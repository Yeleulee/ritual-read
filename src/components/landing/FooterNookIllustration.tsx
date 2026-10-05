import { cn } from "@/lib/utils";

// Footer reading nook — flat mid-century scene in the brand ink-and-paper palette.
// Colors come from `.footer-scene` CSS vars so the piece inverts for dark mode. ~21:9;
// the scene ends at the floor so the footer's border-top reads as the floor line.
const INK = "var(--sc-ink)";
const PAPER = "var(--sc-paper)";
const GRAY = "var(--sc-gray)";
const EMBER = "var(--sc-ember)";
const STROKE = { stroke: INK, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Mobile disks: [cx, cy, r, fill]
const DISKS: Array<[number, number, number, string]> = [
  [980, 250, 26, INK],
  [1090, 212, 18, PAPER],
  [1180, 292, 34, GRAY],
  [1260, 236, 20, INK],
  [1050, 318, 14, EMBER],
];

export function FooterNookIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 2100 820"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="A mid-century reading nook: an oval side table holding a mushroom lamp, stacks of books and a cup of tea, beneath a hanging mobile and a large amber arch."
      className={cn("footer-scene block w-full h-auto", className)}
      style={{ aspectRatio: "2100 / 820" }}
    >
      {/* Ember arch — the single accent, a quiet sunrise behind the table */}
      <path d="M1420 820V560a300 300 0 0 1 600 0v260z" fill={EMBER} />

      {/* Mobile */}
      <g>
        <line x1="1120" y1="0" x2="1120" y2="150" {...STROKE} strokeOpacity="0.6" />
        <line x1="960" y1="150" x2="1280" y2="150" {...STROKE} />
        <line x1="980" y1="150" x2="980" y2="224" {...STROKE} strokeOpacity="0.6" />
        <line x1="1090" y1="150" x2="1090" y2="194" {...STROKE} strokeOpacity="0.6" />
        <line x1="1180" y1="150" x2="1180" y2="258" {...STROKE} strokeOpacity="0.6" />
        <line x1="1260" y1="150" x2="1260" y2="216" {...STROKE} strokeOpacity="0.6" />
        <line x1="1050" y1="150" x2="1050" y2="304" {...STROKE} strokeOpacity="0.6" />
        {DISKS.map(([cx, cy, r, fill], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={fill} {...STROKE} />
        ))}
      </g>

      {/* Oval side table */}
      <g>
        <rect x="1080" y="760" width="40" height="52" fill={INK} {...STROKE} />
        <ellipse cx="1100" cy="814" rx="130" ry="12" fill={INK} {...STROKE} />
        <ellipse cx="1100" cy="730" rx="560" ry="54" fill={INK} {...STROKE} />
      </g>

      {/* Mushroom lamp — stacked domes */}
      <g>
        <ellipse cx="800" cy="716" rx="76" ry="12" fill={PAPER} {...STROKE} />
        <rect x="784" y="540" width="32" height="176" fill={PAPER} {...STROKE} />
        <path d="M640 560a160 160 0 0 1 320 0z" fill={PAPER} {...STROKE} />
        <path d="M694 440a106 106 0 0 1 212 0z" fill={PAPER} {...STROKE} />
        <path d="M740 360a60 60 0 0 1 120 0z" fill={PAPER} {...STROKE} />
      </g>

      {/* Stack of books with an ember ribbon */}
      <g>
        <rect x="1050" y="680" width="220" height="34" rx="2" fill={INK} {...STROKE} />
        <rect x="1062" y="646" width="200" height="34" rx="2" fill={PAPER} {...STROKE} />
        <rect x="1040" y="612" width="210" height="34" rx="2" fill={GRAY} {...STROKE} />
        <line x1="1072" y1="690" x2="1072" y2="704" {...STROKE} strokeOpacity="0.5" />
        <line x1="1060" y1="622" x2="1060" y2="636" {...STROKE} strokeOpacity="0.5" />
        <path d="M1262 664c40 10 60 40 56 92" fill="none" stroke={EMBER} strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* Row of upright books, last one leaning */}
      <g>
        <rect x="1296" y="610" width="26" height="104" rx="2" fill={INK} {...STROKE} />
        <rect x="1324" y="622" width="22" height="92" rx="2" fill={PAPER} {...STROKE} />
        <rect x="1348" y="604" width="30" height="110" rx="2" fill={GRAY} {...STROKE} />
        <rect x="1380" y="618" width="22" height="96" rx="2" fill={INK} {...STROKE} />
        <g transform="translate(1404 714) rotate(16) translate(-1404 -714)">
          <rect x="1404" y="616" width="24" height="98" rx="2" fill={PAPER} {...STROKE} />
        </g>
        <line x1="1302" y1="622" x2="1302" y2="702" {...STROKE} strokeOpacity="0.45" />
        <line x1="1386" y1="630" x2="1386" y2="702" {...STROKE} strokeOpacity="0.45" />
      </g>

      {/* Open book lying flat beside the lamp */}
      <g>
        <path d="M580 700c24-16 50-16 74 0 24-16 50-16 74 0v14c-24-16-50-16-74 0-24-16-50-16-74 0z" fill={PAPER} {...STROKE} />
        <line x1="654" y1="700" x2="654" y2="714" {...STROKE} />
      </g>

      {/* Tea at the far right */}
      <g>
        <ellipse cx="1500" cy="716" rx="70" ry="12" fill={PAPER} {...STROKE} />
        <path d="M1456 640h88v44a44 44 0 0 1-88 0z" fill={PAPER} {...STROKE} />
        <path d="M1544 652c22 0 34 12 34 26s-12 26-34 26" fill="none" {...STROKE} />
        <path d="M1500 616c-14-16 14-30 0-48" fill="none" {...STROKE} strokeOpacity="0.6" />
      </g>
    </svg>
  );
}
