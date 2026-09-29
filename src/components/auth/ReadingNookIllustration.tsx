import { cn } from "@/lib/utils";

// Night reading nook — original line illustration for the sign-in panel.
// Palette: paper (#F3EFE7), ink (#0F0E0D), ember (#E9752F). Sized by width; aspect 1040:730.
const PAPER = "#F3EFE7";
const INK = "#0F0E0D";
const EMBER = "#E9752F";
const STROKE = { stroke: PAPER, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// [x, width, height, fill, lean?]  — top shelf runs from x=136 to the lamp
const TOP_SHELF: Array<[number, number, number, string, boolean?]> = [
  [150, 22, 78, INK], [174, 30, 70, EMBER], [206, 20, 84, INK], [228, 26, 66, INK], [256, 34, 74, PAPER],
  [292, 22, 80, INK], [316, 28, 60, INK], [346, 24, 72, EMBER], [372, 20, 82, INK], [394, 26, 68, INK],
  [422, 30, 76, PAPER], [454, 22, 64, INK], [478, 26, 80, EMBER], [506, 20, 70, INK], [528, 32, 74, INK],
  [562, 24, 66, PAPER], [588, 22, 78, INK, true],
];
const LOW_SHELF: Array<[number, number, number, string]> = [
  [150, 30, 58, INK], [182, 22, 66, PAPER], [206, 26, 62, INK], [234, 20, 70, EMBER], [256, 32, 56, INK],
];
// Dust motes drifting up through the lamp light: [cx, cy, r, delay s, duration s]
const MOTES: Array<[number, number, number, number, number]> = [
  [688, 470, 1.6, 0, 7], [742, 520, 1.2, -2.3, 8.5], [704, 400, 1.4, -4.1, 6.5], [758, 440, 1.1, -1.2, 9],
  [676, 560, 1.3, -5.6, 7.5], [728, 360, 1.5, -3.4, 8], [772, 500, 1.0, -6.8, 6.8], [712, 600, 1.2, -0.7, 9.5],
];

export function ReadingNookIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1040 730"
      role="img"
      aria-label="A reading nook at night: a bookshelf, an armchair beside a lamp, and a cup of tea steaming on a side table."
      className={cn("auth-scene block w-full h-auto", className)}
      style={{ aspectRatio: "1040 / 730" }}
    >
      <defs>
        <radialGradient id="nook-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={EMBER} stopOpacity="0.55" />
          <stop offset="45%" stopColor={EMBER} stopOpacity="0.18" />
          <stop offset="100%" stopColor={EMBER} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nook-moon" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor={PAPER} stopOpacity="0.12" />
          <stop offset="100%" stopColor={PAPER} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nook-comet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={PAPER} stopOpacity="0" />
          <stop offset="1" stopColor={PAPER} stopOpacity="0.9" />
        </linearGradient>
        <clipPath id="nook-window">
          <rect x="691" y="91" width="238" height="248" rx="4" />
        </clipPath>
      </defs>

      {/* Lamp glow (behind everything) */}
      <circle className="auth-scene__glow" cx="716" cy="300" r="260" fill="url(#nook-glow)" />

      {/* Window */}
      <g>
        <circle cx="810" cy="190" r="120" fill="url(#nook-moon)" />
        <rect x="690" y="90" width="240" height="250" rx="4" fill={INK} {...STROKE} />
        {/* Shooting star, every so often, kept inside the panes */}
        <g clipPath="url(#nook-window)">
          <line className="auth-scene__comet" x1="-34" y1="-12" x2="0" y2="0" stroke="url(#nook-comet)" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <line x1="810" y1="90" x2="810" y2="340" {...STROKE} strokeOpacity="0.6" />
        <line x1="690" y1="215" x2="930" y2="215" {...STROKE} strokeOpacity="0.6" />
        {/* Crescent moon */}
        <path d="M842 152a38 38 0 1 0 22 68 30 30 0 1 1-22-68z" fill={PAPER} />
        {/* Stars */}
        <g fill={PAPER}>
          <circle className="auth-scene__star" cx="732" cy="130" r="2.2" />
          <circle className="auth-scene__star auth-scene__star--2" cx="760" cy="180" r="1.6" />
          <circle className="auth-scene__star auth-scene__star--3" cx="900" cy="120" r="1.8" />
          <circle className="auth-scene__star auth-scene__star--2" cx="880" cy="260" r="1.6" />
          <circle className="auth-scene__star auth-scene__star--3" cx="720" cy="290" r="1.4" />
        </g>
        {/* Sill */}
        <rect x="676" y="340" width="268" height="12" rx="2" fill={PAPER} />
        {/* Small plant on the sill */}
        <path className="auth-scene__plant" d="M712 340v-18M712 326c-10-4-16-14-14-26 12 2 18 10 14 26zM712 322c8-8 20-8 26 0-8 6-18 6-26 0z" fill="none" {...STROKE} />
      </g>

      {/* Bookshelves */}
      <g>
        <rect x="136" y="250" width="484" height="10" rx="2" fill={PAPER} />
        {TOP_SHELF.map(([x, w, h, fill, lean], i) =>
          lean ? (
            <g key={i} transform={`translate(${x} 250) rotate(-16) translate(${-x} -250)`}>
              <rect x={x} y={250 - h} width={w} height={h} fill={fill} {...STROKE} />
            </g>
          ) : (
            <g key={i}>
              <rect x={x} y={250 - h} width={w} height={h} fill={fill} {...STROKE} />
              {fill !== PAPER && <line x1={x + 5} y1={250 - h + 12} x2={x + 5} y2={250 - 12} stroke={PAPER} strokeWidth="1" strokeOpacity="0.45" />}
            </g>
          ),
        )}
        <rect x="136" y="390" width="200" height="10" rx="2" fill={PAPER} />
        {LOW_SHELF.map(([x, w, h, fill], i) => (
          <rect key={i} x={x} y={390 - h} width={w} height={h} fill={fill} {...STROKE} />
        ))}
        {/* Horizontal stack at end of low shelf */}
        <rect x="292" y="372" width="40" height="18" rx="1" fill={INK} {...STROKE} />
        <rect x="296" y="356" width="34" height="16" rx="1" fill={EMBER} {...STROKE} />
      </g>

      {/* Floor line + rug */}
      <line x1="60" y1="640" x2="980" y2="640" {...STROKE} strokeOpacity="0.5" />
      <ellipse cx="520" cy="640" rx="260" ry="16" fill={INK} {...STROKE} strokeOpacity="0.5" />

      {/* Armchair */}
      <g>
        {/* back */}
        <path d="M378 360c0-22 18-40 40-40h20c14 0 26 12 26 26v200H378z" fill={INK} {...STROKE} />
        {/* seat cushion */}
        <rect x="418" y="500" width="196" height="52" rx="16" fill={INK} {...STROKE} />
        {/* arm */}
        <path d="M584 430c26 0 46 20 46 46v76h-52v-92c0-10 4-20 6-30z" fill={INK} {...STROKE} />
        {/* base */}
        <path d="M378 552h252v40H378z" fill={INK} {...STROKE} />
        <line x1="392" y1="592" x2="392" y2="636" {...STROKE} />
        <line x1="616" y1="592" x2="616" y2="636" {...STROKE} />
        {/* throw blanket over the back */}
        <path d="M430 356c30 8 60 8 90 0v34c-30 10-60 10-90 0z" fill={EMBER} {...STROKE} />
        {/* open book resting on the seat */}
        <g transform="translate(512 500) rotate(-6)">
          <path d="M-48 0c16-8 32-8 48 0v-30c-16-8-32-8-48 0zM0 0c16-8 32-8 48 0v-30c-16-8-32-8-48 0z" fill={PAPER} {...STROKE} stroke={INK} strokeWidth="1.5" />
          <line x1="0" y1="-30" x2="0" y2="0" stroke={INK} strokeWidth="1.5" />
          <path d="M-36-20h24M-36-13h24M-36-6h18M12-20h24M12-13h24M12-6h18" stroke={INK} strokeWidth="1" strokeOpacity="0.55" />
          {/* a leaf that turns over now and then */}
          <path className="auth-scene__page" d="M0 0c16-8 32-8 48 0v-30c-16-8-32-8-48 0z" fill={PAPER} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </g>

      {/* Dust in the lamp light */}
      <g fill={PAPER}>
        {MOTES.map(([cx, cy, r, delay, dur], i) => (
          <circle key={i} className="auth-scene__mote" cx={cx} cy={cy} r={r} style={{ animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />
        ))}
      </g>

      {/* Floor lamp */}
      <g>
        <ellipse cx="716" cy="636" rx="34" ry="6" fill={INK} {...STROKE} />
        <line x1="716" y1="636" x2="716" y2="300" {...STROKE} />
        <path className="auth-scene__shade" d="M660 300l18-70h76l18 70z" fill={EMBER} {...STROKE} />
        <line x1="660" y1="300" x2="772" y2="300" {...STROKE} />
        {/* pull chain */}
        <g className="auth-scene__chain">
          <line x1="734" y1="300" x2="734" y2="322" {...STROKE} strokeOpacity="0.7" />
          <circle cx="734" cy="325" r="2.5" fill={PAPER} />
        </g>
      </g>

      {/* Side table with tea and a stack of books */}
      <g>
        <rect x="796" y="520" width="140" height="10" rx="2" fill={PAPER} />
        <line x1="812" y1="530" x2="812" y2="636" {...STROKE} />
        <line x1="920" y1="530" x2="920" y2="636" {...STROKE} />
        <line x1="812" y1="590" x2="920" y2="590" {...STROKE} strokeOpacity="0.5" />
        {/* stack */}
        <rect x="806" y="502" width="66" height="18" rx="1" fill={INK} {...STROKE} />
        <rect x="812" y="486" width="56" height="16" rx="1" fill={PAPER} {...STROKE} />
        <rect x="816" y="472" width="46" height="14" rx="1" fill={EMBER} {...STROKE} />
        {/* cup + saucer */}
        <ellipse cx="905" cy="520" rx="22" ry="4" fill={PAPER} />
        <path d="M888 490h34l-4 28h-26z" fill={INK} {...STROKE} />
        <path d="M922 496c10 0 12 14 0 16" fill="none" {...STROKE} />
        <line x1="891" y1="494" x2="919" y2="494" stroke={EMBER} strokeWidth="3" />
        {/* steam */}
        <g fill="none" stroke={PAPER} strokeWidth="1.6" strokeLinecap="round">
          <path className="auth-scene__steam" d="M897 480c-6-8 6-14 0-22" />
          <path className="auth-scene__steam auth-scene__steam--2" d="M905 476c-6-8 6-14 0-22" />
          <path className="auth-scene__steam auth-scene__steam--3" d="M913 480c-6-8 6-14 0-22" />
        </g>
      </g>

      {/* Books on the floor by the chair */}
      <g>
        <rect x="300" y="618" width="60" height="18" rx="1" fill={INK} {...STROKE} />
        <rect x="306" y="602" width="50" height="16" rx="1" fill={PAPER} {...STROKE} />
        <g transform="translate(348 618) rotate(-70)">
          <rect x="0" y="0" width="52" height="16" rx="1" fill={EMBER} {...STROKE} />
        </g>
      </g>
    </svg>
  );
}
