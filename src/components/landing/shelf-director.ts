// Interactive shelf for the hero illustration: click a book and the reader gets up, swaps the book
// they're holding for the one you clicked, and sits back down. The Lottie clip only has a seated
// pose, so the trip is performed by a puppet built from the character's own torso and head artwork
// plus IK-driven limbs, cross-faded with the Lottie figure at both ends.

type Vec = { x: number; y: number };
const v = (x: number, y: number): Vec => ({ x, y });
const add = (a: Vec, b: Vec) => v(a.x + b.x, a.y + b.y);
const sub = (a: Vec, b: Vec) => v(a.x - b.x, a.y - b.y);
const mul = (a: Vec, k: number) => v(a.x * k, a.y * k);
const len = (a: Vec) => Math.hypot(a.x, a.y);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixV = (a: Vec, b: Vec, t: number) => v(mix(a.x, b.x, t), mix(a.y, b.y, t));
const mirror = (a: Vec, s: number) => v(a.x * s, a.y);
const RAD = Math.PI / 180;
// SVG space (y down): positive degrees turn clockwise on screen
const rotate = (p: Vec, deg: number) => {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return v(p.x * c - p.y * s, p.x * s + p.y * c);
};
const angleOf = (d: Vec) => Math.atan2(d.y, d.x) / RAD;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

type Ease = (t: number) => number;
const linear: Ease = (t) => t;
const inOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out: Ease = (t) => 1 - Math.pow(1 - t, 3);
const inQuad: Ease = (t) => t * t;
const sine: Ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

/* ---------------- Character measurements (composition units, from the Lottie rig) ---------------- */

const SOLE_Y = 1042;
const ANKLE_H = 20;
const ANKLE_Y = SOLE_Y - ANKLE_H;
const THIGH = 168;
const SHIN = 158;
const UPPER_ARM = 112;
const FOREARM = 106;
// Rest-pose anchors in the body/head layers' local space (the clip's pivots; hip joint under the hem)
const HIP_ART = v(425, 962);
const NECK_ART = v(459.389, 762.061);
const SHOULDER_ART = v(443.223, 803.878);
const SHOULDER_FAR_ART = v(462, 812);
const ART_LEAN = Math.atan2(NECK_ART.x - HIP_ART.x, HIP_ART.y - NECK_ART.y) / RAD;
// Trouser seat under the shirt hem, so the hips never show a gap between shirt and legs.
// Kept behind the shirt's front edge so it can't poke out as the torso leans forward.
const PELVIS_ART = [v(374, 966), v(466, 926), v(478, 952), v(474, 988), v(440, 1003), v(394, 1001), v(374, 986)];
const HEAD_REST = -8;
const GAZE_ZERO = 44; // head at 0° looks this many degrees below horizontal
const STAND_Y = ANKLE_Y - 318;
const STAND_X = 548; // where the reader stands up and sits down, over their tucked feet
const TUCK_N = v(574, ANKLE_Y);
const TUCK_F = v(546, ANKLE_Y);
const FLOOR_HAND_Y = SOLE_Y - 12; // wrist height with the palm flat on the floor
const REACH = 126; // hip-to-book horizontal distance when reaching the shelf

const INK = "#1A1A1A";
const LEG_INK = "#000000";
const ORANGE = "rgb(255,111,15)";
const ORANGE_FAR = "rgb(236,96,8)";
const WHITE = "#FFFFFF";
const WHITE_FAR = "#E9E7E4";
const LEG_W = [64, 50];
const ARM_W = [42, 34];

/* ---------------- Pose + timeline ---------------- */

interface Pose {
  face: number; // 1 = facing the shelf (right), −1 = facing the vase; the sign picks the mirror
  hip: Vec;
  offN: Vec; // hip-joint offsets in facing space (seated, the far leg starts at the floor)
  offF: Vec;
  lean: number; // torso tilt from vertical, degrees, + leans forward
  head: number; // head rotation relative to the torso, + looks down
  footN: Vec; // flat-foot ankle positions
  footF: Vec;
  pitchN: number; // + toes up (rolls on the heel), − heel up (rolls on the ball)
  pitchF: number;
  handF: Vec; // far wrist target
  wristF: number;
  palmF: number; // 0 = hand follows the forearm (+ wristF), 1 = hand held flat on a surface
  handN: Vec; // near wrist target when not holding the book
  wristN: number;
  grip: number; // 1 = near hand holds the book, 0 = free
  bookPos: Vec;
  bookRot: number;
  bookView: number; // 0 = spine (as on the shelf), 1 = cover
  bookOpen: number; // 1 = open spread (as the Lottie figure reads it), 0 = closed hardback
  bookShow: number;
  fade: number; // puppet opacity; the Lottie figure gets the inverse
}

type Foot = "N" | "F";
interface KeyOpts {
  ease?: Ease;
  liftN?: number;
  liftF?: number;
  swing?: Foot; // a walking step: this foot swings, the other stays planted
  lift?: number;
  bob?: number;
  event?: () => void;
}
interface Key extends KeyOpts {
  at: number;
  pose: Pose;
}

class Timeline {
  keys: Key[];
  t = 0;
  cur: Pose;
  constructor(start: Pose) {
    this.cur = start;
    this.keys = [{ at: 0, pose: start }];
  }
  to(dur: number, patch: Partial<Pose> | ((p: Pose) => Partial<Pose>), opts: KeyOpts = {}) {
    this.t += dur;
    this.cur = { ...this.cur, ...(typeof patch === "function" ? patch(this.cur) : patch) };
    this.keys.push({ ...opts, at: this.t, pose: this.cur });
    return this;
  }
  sample(t: number): Pose {
    const k = this.keys;
    if (t <= 0) return k[0].pose;
    if (t >= this.t) return k[k.length - 1].pose;
    let i = 0;
    while (k[i + 1].at < t) i++;
    const b = k[i + 1];
    const u = (t - k[i].at) / Math.max(1e-6, b.at - k[i].at);
    const p = k[i].pose;
    const q = b.pose;
    const e = (b.ease ?? inOut)(u);
    const arc = Math.sin(Math.PI * u);
    const pose: Pose = {
      face: mix(p.face, q.face, e),
      hip: mixV(p.hip, q.hip, e),
      offN: mixV(p.offN, q.offN, e),
      offF: mixV(p.offF, q.offF, e),
      lean: mix(p.lean, q.lean, e),
      head: mix(p.head, q.head, sine(Math.pow(u, 1.2))), // the head settles a touch after the body
      footN: sub(mixV(p.footN, q.footN, sine(u)), v(0, (b.liftN ?? 0) * arc)),
      footF: sub(mixV(p.footF, q.footF, sine(u)), v(0, (b.liftF ?? 0) * arc)),
      pitchN: mix(p.pitchN, q.pitchN, e),
      pitchF: mix(p.pitchF, q.pitchF, e),
      handF: mixV(p.handF, q.handF, e),
      wristF: mix(p.wristF, q.wristF, e),
      palmF: mix(p.palmF, q.palmF, e),
      handN: mixV(p.handN, q.handN, e),
      wristN: mix(p.wristN, q.wristN, e),
      grip: mix(p.grip, q.grip, e),
      bookPos: mixV(p.bookPos, q.bookPos, e),
      bookRot: mix(p.bookRot, q.bookRot, e),
      bookView: mix(p.bookView, q.bookView, e),
      bookOpen: mix(p.bookOpen, q.bookOpen, e),
      bookShow: q.bookShow,
      fade: mix(p.fade, q.fade, e),
    };
    if (b.swing) {
      // Walking step: steady hip travel with a rise over the stance leg; the swing foot toes off,
      // clears the floor, and lands heel-first while the stance heel peels up late in the step.
      const sw = b.swing;
      const st: Foot = sw === "N" ? "F" : "N";
      pose.hip = v(mix(p.hip.x, q.hip.x, u), mix(p.hip.y, q.hip.y, u) - (b.bob ?? 0) * arc);
      const a0 = p[`foot${sw}`];
      const a1 = q[`foot${sw}`];
      pose[`foot${sw}`] = v(mix(a0.x, a1.x, sine(u)), mix(a0.y, a1.y, u) - (b.lift ?? 0) * Math.sin(Math.PI * Math.pow(u, 0.8)));
      pose[`pitch${sw}`] = u < 0.35 ? mix(p[`pitch${sw}`], 4, sine(u / 0.35)) : mix(4, q[`pitch${sw}`], sine((u - 0.35) / 0.65));
      pose[`foot${st}`] = p[`foot${st}`];
      const s0 = p[`pitch${st}`];
      const s1 = q[`pitch${st}`];
      pose[`pitch${st}`] = u < 0.25 ? mix(s0, 0, sine(u / 0.25)) : u < 0.6 ? 0 : mix(0, s1, sine((u - 0.6) / 0.4));
    }
    return pose;
  }
}

/* ---------------- Kinematics ---------------- */

const sgnOf = (p: Pose) => (p.face >= 0 ? 1 : -1);
const torsoPoint = (hip: Vec, lean: number, s: number, art: Vec) => add(hip, mirror(rotate(sub(art, HIP_ART), lean - ART_LEAN), s));

// Two-bone IK; `pole` picks which way the middle joint bends
function solve2(root: Vec, target: Vec, a: number, b: number, pole: Vec) {
  const d0 = sub(target, root);
  const dist = clamp(len(d0), Math.abs(a - b) + 0.5, a + b - 0.5);
  const dir = mul(d0, 1 / Math.max(1e-6, len(d0)));
  const along = (a * a - b * b + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const n = v(-dir.y, dir.x);
  const side = n.x * pole.x + n.y * pole.y >= 0 ? 1 : -1;
  return { joint: add(add(root, mul(dir, along)), mul(n, h * side)), end: add(root, mul(dir, dist)) };
}

// Pitch rolls the foot around the heel (toes up) or the ball (heel up), so the sole never sinks
function footFrame(flat: Vec, pitch: number, s: number) {
  const pivot = add(flat, mirror(pitch >= 0 ? v(-12, ANKLE_H) : v(38, ANKLE_H), s));
  return add(pivot, rotate(sub(flat, pivot), -pitch * s));
}

// Book-local wrist position for the near hand: beside the spine on the shelf, the lower corner in hand
const gripLocal = (view: number, w: number, h: number) => mixV(v(-w / 2 - 10, -h * 0.1), v(-w / 2 + 2, h / 2 - 8), view);
// Hand angle on the book (facing space): fingers across the spine, or up the cover's edge
const gripAngle = (view: number, rot: number) => rot + mix(-8, -74, view);

function solvePose(p: Pose, bookW: (view: number) => number, bookH: number) {
  const s = sgnOf(p);
  // Leaning forward, the hip joints sit further back under the shirt so the thigh caps stay covered
  const tuck = v(-Math.max(0, p.lean - ART_LEAN) * 0.4, 0);
  const hipN = add(p.hip, mirror(add(p.offN, tuck), s));
  const hipF = add(p.hip, mirror(add(p.offF, tuck), s));
  const knee = v(s, -1);
  const elbow = v(-s, 1);
  const legN = solve2(hipN, footFrame(p.footN, p.pitchN, s), THIGH, SHIN, knee);
  const legF = solve2(hipF, footFrame(p.footF, p.pitchF, s), THIGH, SHIN, knee);
  const shoulderN = torsoPoint(p.hip, p.lean, s, SHOULDER_ART);
  const shoulderF = torsoPoint(p.hip, p.lean, s, SHOULDER_FAR_ART);
  const onBook = add(p.bookPos, mirror(rotate(gripLocal(p.bookView, bookW(p.bookView), bookH), p.bookRot), s));
  const armN = solve2(shoulderN, mixV(p.handN, onBook, p.grip), UPPER_ARM, FOREARM, elbow);
  const armF = solve2(shoulderF, p.handF, UPPER_ARM, FOREARM, elbow);
  const local = (d: Vec) => angleOf(mirror(d, s));
  const foreN = local(sub(armN.end, armN.joint));
  const foreF = local(sub(armF.end, armF.joint));
  return {
    s,
    hipN,
    hipF,
    kneeN: legN.joint,
    kneeF: legF.joint,
    ankleN: legN.end,
    ankleF: legF.end,
    shoulderN,
    shoulderF,
    elbowN: armN.joint,
    elbowF: armF.joint,
    wristN: armN.end,
    wristF: armF.end,
    handAngN: mix(foreN + p.wristN, gripAngle(p.bookView, p.bookRot), p.grip),
    handAngF: mix(foreF + p.wristF, 0, p.palmF),
  };
}

/* ---------------- Drawing ---------------- */

const NS = "http://www.w3.org/2000/svg";
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const node = document.createElementNS(NS, tag);
  for (const [k, val] of Object.entries(attrs)) node.setAttribute(k, String(val));
  parent?.appendChild(node);
  return node;
}
const seg = (a: Vec, b: Vec) => `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}`;
// Closed shape with rounded corners: quadratic curves through each vertex between edge midpoints
const roundPoly = (pts: Vec[]) => {
  const n = pts.length;
  const mid = (i: number) => mixV(pts[i % n], pts[(i + 1) % n], 0.5);
  let d = `M${f1(mid(n - 1).x)} ${f1(mid(n - 1).y)}`;
  for (let i = 0; i < n; i++) d += `Q${f1(pts[i].x)} ${f1(pts[i].y)} ${f1(mid(i).x)} ${f1(mid(i).y)}`;
  return d + "Z";
};
const place = (node: Element, at: Vec, s: number, deg: number) => node.setAttribute("transform", `translate(${f1(at.x)} ${f1(at.y)}) scale(${s} 1) rotate(${f1(deg)})`);

const SHOE = "M-12 -6L-15 12Q-15 20 -7 20L44 20Q57 20 57 11Q55 3 40 1L13 -8Z";
const HAND = "M-2 -10C11 -13 25 -10 30 -2C34 5 27 11 15 11L-2 10Z";
const THUMB = "M6 -8Q9 -19 17 -17Q21 -14 15 -6";

// A limb drawn as capsules: an ink pass underneath a fill pass, so joints merge without seams
function capsuleLimb(parent: Element, fill: string, ink: string, widths: number[], extra = 0) {
  const inkG = el("g", { stroke: ink, fill: "none", "stroke-linecap": "round" }, parent);
  const fillG = el("g", { stroke: fill, fill: "none", "stroke-linecap": "round" }, parent);
  const inkSegs = widths.map((w) => el("path", { "stroke-width": w + 5 }, inkG));
  const fillSegs = widths.map((w) => el("path", { "stroke-width": w }, fillG));
  const inkExtra = Array.from({ length: extra }, () => el("path", { fill: ink, stroke: ink, "stroke-width": 5, "stroke-linejoin": "round" }, inkG));
  const fillExtra = Array.from({ length: extra }, () => el("path", { fill, stroke: "none" }, fillG));
  // Keep the extras (e.g. the trouser seat) under the capsules within each pass
  inkExtra.forEach((n) => inkG.insertBefore(n, inkG.firstChild));
  fillExtra.forEach((n) => fillG.insertBefore(n, fillG.firstChild));
  return (points: Vec[], extras: string[] = []) => {
    for (let i = 0; i < widths.length; i++) {
      const d = seg(points[i], points[i + 1]);
      inkSegs[i].setAttribute("d", d);
      fillSegs[i].setAttribute("d", d);
    }
    extras.forEach((d, i) => {
      inkExtra[i]?.setAttribute("d", d);
      fillExtra[i]?.setAttribute("d", d);
    });
  };
}

/* ---------------- Lottie + shelf model ---------------- */

export interface LottieLayer {
  data?: { nm?: string };
  layerElement?: SVGGElement;
  elements?: LottieLayer[];
  shapesData?: Array<{ nm?: string }>;
  itemsData?: Array<{ gr?: SVGGElement }>;
}

export interface ShelfBook {
  index: number;
  color: string;
  name: "black" | "orange" | "white";
  center: Vec;
  tilt: number;
  height: number;
  spine: number;
  dots: Array<Vec & { r: number }>;
  groups: SVGGElement[];
}

const group = (layer: LottieLayer | undefined, name: string) => {
  const i = layer?.shapesData?.findIndex((s) => s.nm === name) ?? -1;
  return i >= 0 ? (layer?.itemsData?.[i]?.gr ?? null) : null;
};

// Left → right on the lower wall shelf: [outline, fill] shape groups in the room's `bg` layer
const BOOK_GROUPS: Array<[string, string]> = [
  ["Group 36", "Group 37"],
  ["Group 34", "Group 35"],
  ["Group 32", "Group 33"],
  ["Group 30", "Group 31"],
  ["Group 28", "Group 29"],
  ["Group 26", "Group 27"],
];
// Round spine labels drawn over the books
const LABEL_GROUPS: Array<[string, string]> = [
  ["Group 5", "Group 6"],
  ["Group 7", "Group 8"],
  ["Group 9", "Group 10"],
];

function colorName(fill: string): ShelfBook["name"] {
  const [r, g, b] = (fill.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  if (r > 200 && g > 200 && b > 200) return "white";
  if (r > 200 && g < 170) return "orange";
  return "black";
}

function analyzeShelf(svg: SVGSVGElement, bg: LottieLayer): ShelfBook[] {
  const inv = svg.getScreenCTM()?.inverse();
  const toComp = (node: SVGGraphicsElement) => {
    const m = inv && node.getScreenCTM() ? inv.multiply(node.getScreenCTM()!) : new DOMMatrix();
    return (x: number, y: number) => {
      const p = new DOMPoint(x, y).matrixTransform(m);
      return v(p.x, p.y);
    };
  };
  const books: ShelfBook[] = [];
  BOOK_GROUPS.forEach(([outlineName, fillName], index) => {
    const outline = group(bg, outlineName);
    const fill = group(bg, fillName);
    const path = fill?.querySelector("path");
    if (!outline || !fill || !path) return;
    // The outline's principal axes give each book's lean, height and spine width
    const map = toComp(path);
    const total = path.getTotalLength();
    const pts = Array.from({ length: 96 }, (_, i) => {
      const q = path.getPointAtLength((total * i) / 96);
      return map(q.x, q.y);
    });
    const c = mul(pts.reduce(add, v(0, 0)), 1 / pts.length);
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const p of pts) {
      const d = sub(p, c);
      sxx += d.x * d.x;
      syy += d.y * d.y;
      sxy += d.x * d.y;
    }
    const major = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let long = v(Math.cos(major), Math.sin(major));
    if (long.y < 0) long = mul(long, -1);
    const across = v(-long.y, long.x);
    const extent = (dir: Vec) => {
      const proj = pts.map((p) => (p.x - c.x) * dir.x + (p.y - c.y) * dir.y);
      return { lo: Math.min(...proj), hi: Math.max(...proj) };
    };
    const along = extent(long);
    const wide = extent(across);
    const center = add(add(c, mul(long, (along.lo + along.hi) / 2)), mul(across, (wide.lo + wide.hi) / 2));
    const color = path.getAttribute("fill") ?? WHITE;
    books.push({
      index,
      color,
      name: colorName(color),
      center,
      tilt: Math.atan2(-long.x, long.y) / RAD,
      height: along.hi - along.lo,
      spine: wide.hi - wide.lo,
      dots: [],
      groups: [outline, fill],
    });
  });
  for (const [outlineName, fillName] of LABEL_GROUPS) {
    const outline = group(bg, outlineName);
    const fill = group(bg, fillName);
    if (!outline || !fill) continue;
    const b = fill.getBBox();
    const center = toComp(fill)(b.x + b.width / 2, b.y + b.height / 2);
    // Labels overlap two leaning books; they belong to the top-most one (right-most in draw order)
    const owner = [...books].reverse().find((book) => {
      const r = rotate(sub(center, book.center), -book.tilt);
      return Math.abs(r.x) <= book.spine / 2 && Math.abs(r.y) <= book.height / 2;
    });
    if (owner) {
      owner.dots.push({ ...rotate(sub(center, owner.center), -owner.tilt), r: Math.max(b.width, b.height) / 2 });
      owner.groups.push(outline, fill);
    }
  }
  return books;
}

/* ---------------- Director ---------------- */

export interface ShelfDirector {
  books: ShelfBook[];
  held: () => number;
  busy: () => boolean;
  bookAt: (clientX: number, clientY: number) => number | null;
  hover: (index: number | null) => void;
  request: (index: number) => void;
  destroy: () => void;
  /** Dev aid: draw the trip to `index` at time `t` without playing it; returns the trip length */
  preview?: (index: number, t: number) => number;
}

interface DirectorOptions {
  svg: SVGSVGElement;
  people: LottieLayer;
  room: LottieLayer;
  onBegin: () => void;
  /** The Lottie figure is fully hidden behind the puppet (safe to move its playhead) */
  onHidden: () => void;
  onEnd: (held: number) => void;
}

const CHARACTER_LAYERS = ["arm1", "body", "head", "leg1", "leg2", "book", "arm2"];

export function createShelfDirector(opts: DirectorOptions): ShelfDirector | null {
  const { svg, people, room } = opts;
  const bg = room.elements?.find((l) => l.data?.nm === "bg");
  const layers = new Map((people.elements ?? []).map((l) => [l.data?.nm ?? "", l]));
  const body = layers.get("body")?.layerElement;
  const head = layers.get("head")?.layerElement;
  const lottieBook = layers.get("book");
  const host = people.layerElement?.parentNode;
  if (!bg || !body || !head || !lottieBook || !host) return null;

  const books = analyzeShelf(svg, bg);
  if (books.length !== BOOK_GROUPS.length) return null;
  const covers = ["Group 2", "Group 4"].map((n) => group(lottieBook, n)?.querySelector("path")).filter((p): p is SVGPathElement => !!p);
  const character = CHARACTER_LAYERS.map((n) => layers.get(n)?.layerElement).filter((e): e is SVGGElement => !!e);

  // The reader starts with the black book in hand, so its slot is empty
  let held = Math.max(0, books.findIndex((b) => b.name === "black"));
  const setShelf = (i: number, visible: boolean) => books[i].groups.forEach((g) => (g.style.visibility = visible ? "" : "hidden"));
  const setCover = (fill: string) => covers.forEach((p) => (p.style.fill = fill));
  setShelf(held, false);
  setCover(books[held].color);

  /* ---- puppet DOM, back to front ---- */
  const root = el("g", { opacity: 0, "pointer-events": "none" });
  host.insertBefore(root, people.layerElement!.nextSibling);
  const squash = el("g", {}, root);

  const armParts = (fill: string) => {
    const g = el("g", {}, squash);
    const draw = capsuleLimb(g, fill, INK, ARM_W);
    const hand = el("g", {}, g);
    el("path", { d: HAND, fill, stroke: INK, "stroke-width": 2.3, "stroke-linejoin": "round" }, hand);
    el("path", { d: THUMB, fill, stroke: INK, "stroke-width": 2.3, "stroke-linejoin": "round", "stroke-linecap": "round" }, hand);
    return { draw, hand };
  };
  const legParts = (fill: string, extra: number) => {
    const g = el("g", {}, squash);
    const shoe = el("path", { d: SHOE, fill: WHITE, stroke: INK, "stroke-width": 2.4, "stroke-linejoin": "round" }, g);
    const draw = capsuleLimb(g, fill, LEG_INK, LEG_W, extra);
    return { draw, shoe };
  };
  const farArm = armParts(WHITE_FAR);
  const farLeg = legParts(ORANGE_FAR, 0);
  const nearLeg = legParts(ORANGE, 1);
  const torso = el("g", {}, squash);
  const torsoArt = body.cloneNode(true) as SVGGElement;
  torsoArt.removeAttribute("transform");
  torsoArt.removeAttribute("style");
  torso.appendChild(torsoArt);
  const headG = el("g", {}, torso);
  const headArt = head.cloneNode(true) as SVGGElement;
  headArt.removeAttribute("transform");
  headArt.removeAttribute("style");
  headG.appendChild(headArt);
  const bookG = el("g", {}, squash);
  const bookLeaf = el("rect", { fill: WHITE, stroke: INK, "stroke-width": 2.3, "stroke-linejoin": "round" }, bookG);
  const bookCover = el("rect", { stroke: INK, "stroke-width": 2.3, "stroke-linejoin": "round" }, bookG);
  const bookOpenPage = el("rect", { fill: WHITE, stroke: "none" }, bookG);
  const bookPages = el("rect", { fill: WHITE, stroke: INK, "stroke-width": 1.4 }, bookG);
  const bookBand = el("rect", { fill: "none", stroke: INK, "stroke-width": 1.4 }, bookG);
  const bookDots = el("g", {}, bookG);
  const nearArm = armParts(WHITE);

  let bookIndex = held;
  const coverW = 40;
  const bookW = (view: number) => mix(books[bookIndex].spine, coverW, view);
  const styleBook = (i: number) => {
    bookIndex = i;
    const b = books[i];
    bookCover.setAttribute("fill", b.color);
    bookDots.replaceChildren();
    for (const d of b.dots) {
      el("circle", { cx: f1(d.x), cy: f1(d.y), r: f1(d.r + 0.6), fill: INK }, bookDots);
      el("circle", { cx: f1(d.x), cy: f1(d.y), r: f1(d.r - 0.8), fill: "rgb(28,3,17)" }, bookDots);
    }
  };
  styleBook(held);

  function draw(p: Pose) {
    const book = books[bookIndex];
    const s = solvePose(p, bookW, book.height);
    root.setAttribute("opacity", f1(clamp(p.fade, 0, 1)));
    character.forEach((g) => (g.style.opacity = String(1 - clamp(p.fade, 0, 1))));
    // Turning around: squash through the hip line, then mirror
    const k = Math.max(0.06, Math.abs(p.face));
    squash.setAttribute("transform", `translate(${f1(p.hip.x)} 0) scale(${f1(k)} 1) translate(${f1(-p.hip.x)} 0)`);

    const footAng = (pitch: number) => -pitch;
    place(nearLeg.shoe, s.ankleN, s.s, footAng(p.pitchN));
    place(farLeg.shoe, s.ankleF, s.s, footAng(p.pitchF));
    const seat = PELVIS_ART.map((q) => torsoPoint(p.hip, p.lean, s.s, q));
    nearLeg.draw([s.hipN, s.kneeN, s.ankleN], [roundPoly(seat)]);
    farLeg.draw([s.hipF, s.kneeF, s.ankleF]);
    nearArm.draw([s.shoulderN, s.elbowN, s.wristN]);
    farArm.draw([s.shoulderF, s.elbowF, s.wristF]);
    place(nearArm.hand, s.wristN, s.s, s.handAngN);
    place(farArm.hand, s.wristF, s.s, s.handAngF);

    torso.setAttribute("transform", `translate(${f1(p.hip.x)} ${f1(p.hip.y)}) scale(${s.s} 1) rotate(${f1(p.lean - ART_LEAN)}) translate(${-HIP_ART.x} ${-HIP_ART.y})`);
    headG.setAttribute("transform", `rotate(${f1(p.head)} ${NECK_ART.x} ${NECK_ART.y})`);

    const w = bookW(p.bookView);
    const h = book.height;
    bookG.style.display = p.bookShow ? "" : "none";
    place(bookG, p.bookPos, s.s, p.bookRot);
    bookCover.setAttribute("x", f1(-w / 2));
    bookCover.setAttribute("y", f1(-h / 2));
    bookCover.setAttribute("width", f1(w));
    bookCover.setAttribute("height", f1(h));
    // Opening: a second leaf swings out on the spine side and the cover reads as a white page
    const leaf = w * 1.5 * p.bookOpen;
    bookLeaf.setAttribute("x", f1(-w / 2 - leaf));
    bookLeaf.setAttribute("y", f1(-h / 2 + 1.5));
    bookLeaf.setAttribute("width", f1(Math.max(0.01, leaf)));
    bookLeaf.setAttribute("height", f1(h - 3));
    bookLeaf.style.display = p.bookOpen > 0.02 ? "" : "none";
    bookOpenPage.setAttribute("x", f1(-w / 2 + 1.2));
    bookOpenPage.setAttribute("y", f1(-h / 2 + 1.2));
    bookOpenPage.setAttribute("width", f1(w - 2.4));
    bookOpenPage.setAttribute("height", f1(h - 2.4));
    bookOpenPage.style.opacity = f1(clamp(p.bookOpen, 0, 1));
    const closed = p.bookOpen < 0.5;
    const pw = 6 * p.bookView;
    bookPages.setAttribute("x", f1(w / 2 - pw));
    bookPages.setAttribute("y", f1(-h / 2 + 2.5));
    bookPages.setAttribute("width", f1(pw));
    bookPages.setAttribute("height", f1(h - 5));
    bookPages.style.display = closed && p.bookView > 0.1 ? "" : "none";
    // A spine band reads as a closed hardback once the cover faces us
    bookBand.setAttribute("x", f1(-w / 2 + 6 * p.bookView));
    bookBand.setAttribute("y", f1(-h / 2));
    bookBand.setAttribute("width", "0.01");
    bookBand.setAttribute("height", f1(h));
    bookBand.style.display = closed && p.bookView > 0.3 ? "" : "none";
    bookDots.style.opacity = f1(clamp(1 - p.bookView * 2, 0, 1));
  }

  /* ---- choreography ---- */
  const seated: Pose = {
    face: 1,
    hip: HIP_ART,
    offN: v(-4, -4),
    offF: v(32, 50),
    lean: ART_LEAN,
    head: HEAD_REST,
    footN: v(708, ANKLE_Y),
    footF: v(784, ANKLE_Y - 2),
    pitchN: 6,
    pitchF: 60,
    handF: v(517, 855),
    wristF: -18,
    palmF: 0,
    handN: v(537, 868),
    wristN: -8,
    grip: 1,
    bookPos: v(566, 828),
    bookRot: -28,
    bookView: 1,
    bookOpen: 1,
    bookShow: 1,
    fade: 0,
  };
  // The clip's own open book crossfades with the puppet's while a hand closes or opens it
  const showClipBook = (on: boolean) => {
    const g = lottieBook.layerElement;
    if (!g) return;
    g.style.transition = "opacity 0.5s ease";
    g.style.opacity = on ? "" : "0";
  };

  const shoulderOf = (p: Pick<Pose, "hip" | "lean" | "face">) => torsoPoint(p.hip, p.lean, p.face >= 0 ? 1 : -1, SHOULDER_ART);
  // Book held against the chest while bending, or at the waist with the cover out while walking
  const hug = (p: Pick<Pose, "hip" | "lean" | "face">) => {
    const s = p.face >= 0 ? 1 : -1;
    return { bookPos: add(shoulderOf(p), mirror(rotate(v(44, 70), (p.lean - 8) * 0.7), s)), bookRot: -8 + (p.lean - 8) * 0.6, bookView: 1, bookOpen: 0, grip: 1 };
  };
  const carry = (p: Pick<Pose, "hip" | "lean" | "face">) => {
    const s = p.face >= 0 ? 1 : -1;
    return { bookPos: add(shoulderOf(p), mirror(v(58, 116), s)), bookRot: 4, bookView: 1, grip: 1 };
  };
  const hang = (p: Pick<Pose, "hip" | "lean" | "face">, swing = 0) => {
    const s = p.face >= 0 ? 1 : -1;
    return { handF: add(torsoPoint(p.hip, p.lean, s, SHOULDER_FAR_ART), mirror(v(-6 + swing, 208), s)), wristF: 6, palmF: 0 };
  };
  const gaze = (p: Pick<Pose, "hip" | "lean" | "face">, target: Vec) => {
    const s = p.face >= 0 ? 1 : -1;
    const d = mirror(sub(target, torsoPoint(p.hip, p.lean, s, NECK_ART)), s);
    return clamp(angleOf(d) - GAZE_ZERO - (p.lean - ART_LEAN), -32, 30);
  };
  const ahead = (p: Pick<Pose, "hip" | "lean" | "face">) => add(p.hip, v((p.face >= 0 ? 1 : -1) * 400, 40));
  const kneeAt = (p: Pose) => solvePose(p, bookW, books[bookIndex].height).kneeN;

  function rise(tl: Timeline, lookAt: Vec) {
    // Fade the puppet in over the identical figure; the clip's open book then fades as the hand closes ours
    tl.to(0.3, { fade: 1 }, { ease: sine, event: () => { opts.onHidden(); showClipBook(false); } });
    // Close the book (a real two-hand close) and draw both feet in
    tl.to(0.5, (p) => ({ head: -2, ...hug({ ...p, lean: 12 }), lean: 12 }), { ease: out });
    tl.to(0.6, (p) => ({ lean: 18, offF: v(6, -2), footN: TUCK_N, pitchN: 0, footF: TUCK_F, pitchF: 0, handF: v(438, FLOOR_HAND_Y), wristF: 0, palmF: 1, head: 8, ...hug({ ...p, lean: 18 }) }), { liftN: 10, liftF: 26 });
    // Rock forward over the feet, pushing off the floor
    tl.to(0.45, (p) => ({ hip: v(462, 950), lean: 44, head: 14, ...hug({ ...p, hip: v(462, 950), lean: 44 }) }), { ease: inQuad });
    // Hips come off the floor into a squat; the hand moves to push on the knee
    tl.to(0.5, (p) => {
      const q = { ...p, hip: v(510, 882), lean: 40 };
      return { hip: q.hip, lean: q.lean, head: 10, handF: add(kneeAt(q), v(-18, -24)), palmF: 0.4, wristF: 30, ...hug(q) };
    }, { ease: linear });
    tl.to(0.45, (p) => {
      const q = { ...p, hip: v(532, 790), lean: 22 };
      return { hip: q.hip, lean: q.lean, head: 4, handF: add(kneeAt(q), v(-20, -30)), palmF: 0.5, wristF: 30, ...hug(q) };
    }, { ease: linear });
    tl.to(0.55, (p) => {
      const q = { ...p, hip: v(STAND_X, STAND_Y), lean: 4 };
      return { hip: q.hip, lean: q.lean, head: gaze(q, lookAt), ...hang(q), ...carry(q) };
    }, { ease: out });
  }

  function sit(tl: Timeline, onOpen: () => void) {
    // Line the feet up where they started, then lower down the way they got up
    tl.to(0.45, (p) => ({ hip: v(STAND_X, STAND_Y + 2), footN: TUCK_N, pitchN: 0, footF: TUCK_F, pitchF: 0, head: 12, ...carry(p) }), { liftN: 8, liftF: 8 });
    tl.to(0.55, (p) => {
      const q = { ...p, hip: v(532, 790), lean: 24 };
      return { hip: q.hip, lean: q.lean, head: 16, handF: add(kneeAt(q), v(-20, -30)), palmF: 0.5, wristF: 30, ...hug(q) };
    }, { ease: inOut });
    tl.to(0.5, (p) => {
      const q = { ...p, hip: v(508, 884), lean: 40 };
      return { hip: q.hip, lean: q.lean, head: 14, handF: v(446, FLOOR_HAND_Y), palmF: 1, wristF: 0, ...hug(q) };
    }, { ease: linear });
    tl.to(0.5, (p) => ({ hip: v(462, 950), lean: 38, head: 10, ...hug({ ...p, hip: v(462, 950), lean: 38 }) }), { ease: linear });
    tl.to(0.45, (p) => ({ hip: HIP_ART, lean: 16, head: 2, ...hug({ ...p, hip: HIP_ART, lean: 16 }) }), { ease: out });
    // Stretch out against the vase and open the book
    tl.to(0.6, (p) => ({ lean: ART_LEAN, offF: seated.offF, footN: seated.footN, pitchN: seated.pitchN, footF: seated.footF, pitchF: seated.pitchF, handF: seated.handF, wristF: seated.wristF, palmF: 0, head: 0, ...hug({ ...p, lean: ART_LEAN }) }), { liftN: 6, liftF: 4 });
    tl.to(0.45, { handN: seated.handN, wristN: seated.wristN, bookPos: seated.bookPos, bookRot: seated.bookRot, head: HEAD_REST }, { event: () => { onOpen(); showClipBook(true); } });
    // Open the book to the first page while the clip's open spread fades in underneath, then fade out
    tl.to(0.55, { bookOpen: 1 }, { ease: sine });
    tl.to(0.6, { fade: 0 }, { ease: sine });
  }

  // Natural strides up to ~135 units, then the trailing foot joins the leading one
  function walk(tl: Timeline, toX: number, look: "ahead" | "book" | Vec, emptyHanded = false) {
    const start = tl.cur;
    const dist = toX - start.hip.x;
    if (Math.abs(dist) < 10) return;
    const dir = Math.sign(dist);
    const n = Math.max(1, Math.ceil(Math.abs(dist) / 135));
    const feet: Record<Foot, number> = { N: start.footN.x, F: start.footF.x };
    const behind = (): Foot => ((feet.N - feet.F) * dir < 0 ? "N" : "F");
    const lookAt = (q: Pose) => (look === "ahead" ? gaze(q, ahead(q)) : look === "book" ? gaze(q, q.bookPos) + 2 : gaze(q, look));
    // Arms swing opposite to the legs; the near arm only swings when it isn't holding the book
    const arms = (q: Pose, swing: number) => {
      const s = q.face >= 0 ? 1 : -1;
      const near = emptyHanded ? { grip: 0, handN: add(shoulderOf(q), mirror(v(-4 - swing, 206), s)), wristN: 6 } : carry(q);
      return { ...hang(q, swing), ...near };
    };
    const stepDur = 0.62;
    for (let i = 1; i <= n; i++) {
      const sw = behind();
      const hip = v(mix(start.hip.x, toX, i / n), STAND_Y + 3);
      feet[sw] = hip.x + dir * (i === n ? 14 : 38);
      const armSwing = (sw === "F" ? -18 : 18) * dir * (tl.cur.face >= 0 ? 1 : -1);
      tl.to(stepDur, (p) => {
        const q = { ...p, hip, lean: 5 };
        return {
          hip,
          lean: 5,
          [`foot${sw}`]: v(feet[sw], ANKLE_Y),
          [`pitch${sw}`]: 10,
          [`pitch${sw === "N" ? "F" : "N"}`]: -16,
          ...arms(q, armSwing),
          head: lookAt(q),
        };
      }, { swing: sw, lift: 20, bob: 7, ease: linear });
    }
    // The trailing foot comes alongside; weight settles and both feet go flat
    const trail = behind();
    const lead: Foot = trail === "N" ? "F" : "N";
    feet[trail] = feet[lead] - dir * 24;
    const rest = v(toX, STAND_Y);
    tl.to(0.48, (p) => {
      const q = { ...p, hip: rest, lean: 4 };
      return { hip: rest, lean: 4, [`foot${trail}`]: v(feet[trail], ANKLE_Y), [`pitch${trail}`]: 0, [`pitch${lead}`]: 0, ...arms(q, 0), head: lookAt(q) };
    }, { swing: trail, lift: 12, bob: 3, ease: out });
  }

  function turn(tl: Timeline, face: 1 | -1) {
    tl.to(0.42, (p) => {
      const q = { ...p, face };
      return { face, ...hang(q), ...carry(q), head: gaze(q, ahead(q)) };
    }, { ease: inOut });
  }

  const slotGrip = (b: ShelfBook) => add(b.center, rotate(gripLocal(0, b.spine, b.height), b.tilt));

  function plan(target: number) {
    const from = books[held];
    const to = books[target];
    const tl = new Timeline(seated);
    rise(tl, from.center);

    // Walk up to the empty slot and slide the held book back in, spine out
    const putX = from.center.x - REACH;
    walk(tl, putX, from.center);
    const at = (p: Pose, x: number) => ({ ...p, hip: v(x, STAND_Y + 6), lean: 12 });
    const hover = add(from.center, rotate(v(0, -30), from.tilt));
    tl.to(0.6, (p) => ({ hip: at(p, putX).hip, lean: 12, bookPos: hover, bookRot: from.tilt, bookView: 0, head: gaze(at(p, putX), from.center) }));
    tl.to(0.32, { bookPos: from.center }, { ease: out, event: () => setShelf(held, true) });
    tl.to(0.05, { bookShow: 0 }, { ease: linear });
    tl.to(0.3, (p) => ({ grip: 0, handN: add(slotGrip(from), v(-24, 26)), wristN: 24, head: gaze(p, to.center) }), { ease: out, event: () => styleBook(target) });

    // Side-step along the shelf if the chosen book is out of reach, then reach for it
    const takeX = to.center.x - REACH;
    if (Math.abs(takeX - putX) > 40) {
      tl.to(0.25, (p) => ({ hip: v(putX, STAND_Y), lean: 4, ...hang(p), handN: add(shoulderOf(p), v(10, 200)), wristN: 0 }), { ease: out });
      walk(tl, takeX, to.center, true);
    }
    const reachAt = (p: Pose) => at(p, takeX);
    tl.to(0.55, (p) => ({ hip: reachAt(p).hip, lean: 12, handN: slotGrip(to), wristN: -6, head: gaze(reachAt(p), to.center) }));
    // Grip the spine and ease it out, then turn it to look at the cover
    tl.to(0.12, { bookPos: to.center, bookRot: to.tilt, bookView: 0, grip: 1 }, { ease: linear, event: () => setShelf(target, false) });
    tl.to(0.01, { bookShow: 1 }, { ease: linear });
    tl.to(0.38, { bookPos: add(to.center, rotate(v(-6, -44), to.tilt * 0.5)), bookRot: to.tilt * 0.5 }, { ease: out });
    tl.to(0.55, (p) => {
      const q = { ...p, hip: v(takeX, STAND_Y + 2), lean: 8 };
      const bookPos = add(shoulderOf(q), v(64, 62));
      return { hip: q.hip, lean: 8, bookPos, bookRot: -12, bookView: 1, head: gaze(q, bookPos) };
    });
    tl.to(0.7, (p) => ({ bookRot: -16, bookPos: add(p.bookPos, v(-2, -3)), head: p.head + 3 }), { ease: sine });

    // Back to the vase: turn, walk, face the shelf again and sit
    turn(tl, -1);
    walk(tl, STAND_X, "ahead");
    turn(tl, 1);
    sit(tl, () => setCover(to.color));
    return tl;
  }

  /* ---- playback ---- */
  let running: { tl: Timeline; t: number; next: number; last: number; raf: number; target: number } | null = null;
  let queued: number | null = null;
  let queueTimer = 0;

  const finish = (target: number) => {
    held = target;
    running = null;
    root.setAttribute("opacity", "0");
    character.forEach((g) => (g.style.opacity = ""));
    showClipBook(true);
    opts.onEnd(held);
    const next = queued;
    queued = null;
    if (next !== null && next !== held) queueTimer = window.setTimeout(() => request(next), 1200);
  };

  const frame = (now: number) => {
    const r = running;
    if (!r) return;
    if (!document.hidden) r.t += Math.min(0.05, (now - r.last) / 1000);
    r.last = now;
    while (r.next < r.tl.keys.length && r.tl.keys[r.next].at <= r.t) r.tl.keys[r.next++].event?.();
    draw(r.tl.sample(r.t));
    if (r.t >= r.tl.t) finish(r.target);
    else r.raf = requestAnimationFrame(frame);
  };

  function request(index: number) {
    if (index < 0 || index >= books.length) return;
    if (running) {
      queued = index === running.target ? null : index;
      return;
    }
    if (index === held) return;
    opts.onBegin();
    styleBook(held);
    const tl = plan(index);
    running = { tl, t: 0, next: 1, last: performance.now(), raf: 0, target: index };
    draw(tl.sample(0));
    running.raf = requestAnimationFrame(frame);
  }

  const lookup = new Map<Element, number>();
  books.forEach((b) => b.groups.forEach((g) => lookup.set(g, b.index)));
  const bookAt = (clientX: number, clientY: number) => {
    for (const hit of document.elementsFromPoint(clientX, clientY)) {
      if (!svg.contains(hit)) continue;
      for (let n: Element | null = hit; n && n !== svg; n = n.parentElement) {
        const i = lookup.get(n);
        if (i !== undefined) return i === held && !running ? null : i;
      }
    }
    return null;
  };

  let hovered: number | null = null;
  const baseTransform = new Map<SVGGElement, string>();
  const hover = (index: number | null) => {
    if (index === hovered) return;
    hovered = index;
    for (const b of books) {
      const lift = b.index === index;
      for (const g of b.groups) {
        if (!baseTransform.has(g)) baseTransform.set(g, g.getAttribute("transform") ?? "");
        g.setAttribute("transform", `${lift ? "translate(0 -5) " : ""}${baseTransform.get(g)}`.trim());
      }
    }
  };

  const director: ShelfDirector = {
    books,
    held: () => held,
    busy: () => !!running,
    bookAt,
    hover,
    request,
    destroy: () => {
      if (running) cancelAnimationFrame(running.raf);
      window.clearTimeout(queueTimer);
      running = null;
      hover(null);
      root.remove();
      character.forEach((g) => (g.style.opacity = ""));
      showClipBook(true);
    },
  };
  if (import.meta.env.DEV) {
    director.preview = (index, t) => {
      styleBook(held);
      const tl = plan(index);
      const events = tl.keys.filter((k) => k.at <= t && k.event);
      // Replay shelf/book swaps up to t without committing them
      const shelfBefore = books.map((b) => b.groups[0].style.visibility);
      events.forEach((k) => k.event?.());
      draw({ ...tl.sample(t), fade: 1 });
      books.forEach((b, i) => b.groups.forEach((g) => (g.style.visibility = shelfBefore[i])));
      events.forEach((k) => k.event?.());
      return tl.t;
    };
    (svg as unknown as { __shelf?: ShelfDirector }).__shelf = director;
  }
  return director;
}
