import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import type { GesturePhase, GesturePoint, PageFace, ReaderApi } from "@/components/readers/EpubReader";
import { TURN_SPEED_SECONDS, type PageTurnMode, type ReaderTheme, type TurnSpeed } from "@/lib/reader-themes";

/* Apple Books–style page turning on top of any ReaderApi.
   The live reader advances underneath; a still copy of the outgoing page is animated on top
   (curl = 2-D fold with mirrored back face and cast shadow; slide = horizontal sheet).
   Gestures: tap either edge, swipe anywhere with a finger/pen, drag from an edge with a mouse. */

export interface PageTurnerHandle {
  turn: (dir: 1 | -1) => void;
  /** Pointer events from a reader that swallows them (EPUB iframe) */
  feed: (phase: GesturePhase, p: GesturePoint) => void;
}

interface PageTurnerProps {
  api: ReaderApi | null;
  mode: PageTurnMode;
  turnSpeed?: TurnSpeed;
  theme: ReaderTheme;
  canNext: boolean;
  canPrev: boolean;
  /** Changes whenever the visible page could look different (location, theme, typography) */
  pageKey?: string;
  disabled?: boolean;
  onTapCenter?: () => void;
  onTurned?: (dir: 1 | -1) => void;
  children: ReactNode;
}

type Pt = { x: number; y: number };
type Geometry = {
  front: Pt[];
  back: Pt[];
  /** Region of the page that has been lifted (un-reflected) — the next page shows through here */
  folded: Pt[];
  matrix: string;
  shadow: Pt[];
  fold: { m: Pt; n: Pt; len: number } | null;
};

const EDGE = 0.18;
const EDGE_NARROW = 0.24; // phones: bigger tap targets
const TAP_MS = 300;
const TAP_PX = 10;
const DRAG_PX = 8;
// iOS back-swipe and Android back gestures begin in this strip; a touch drag starting there is theirs
const SYSTEM_EDGE_PX = 24;
const SWIPE_PX = 40; // "none" mode: a flick still turns
const SNAPSHOT_BUDGET_MS = 450; // past this, turn without animation rather than feel stuck
// The grabbed corner travels 2W to flip fully; the pointer moves it this many times its own
// distance, so the sheet feels attached to the finger instead of racing ahead of it.
const DRAG_GAIN = 2; // dragging the corner across the full page width flips it completely
const DRAG_GAIN_NARROW = 1.7; // phones: a full swipe should still get most of the way
const COMMIT_PROGRESS = 0.3; // release past this and the turn finishes
const COMMIT_VELOCITY = 0.35; // px/ms flick that finishes a turn from anywhere
const TURN_EASE: [number, number, number, number] = [0.3, 0.05, 0.2, 1];

/* Phones and tablets: every face is a whole chapter document in an iframe, and Safari repaints
   it on each clip-path frame. The lite path keeps one warm face instead of two, skips the
   blurred cast shadow (an SVG filter re-run per frame) and shortens the animation. */
const isLiteDevice = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 900);

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => window.setTimeout(() => r(fallback), ms))]);
const nextFrames = (n: number) => new Promise<void>((resolve) => { const step = (k: number) => (k <= 0 ? resolve() : requestAnimationFrame(() => step(k - 1))); step(n); });

const pts = (p: Pt[]) => p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
const poly = (p: Pt[]) => (p.length < 3 ? "polygon(0 0, 0 0, 0 0)" : `polygon(${p.map((q) => `${q.x.toFixed(1)}px ${q.y.toFixed(1)}px`).join(",")})`);

/* Clip a convex polygon to the half-plane f(X) = (X - m)·n <= 0 (keep = true) or >= 0. */
function clipHalfPlane(polygon: Pt[], m: Pt, n: Pt, keepNegative: boolean): Pt[] {
  const f = (p: Pt) => (p.x - m.x) * n.x + (p.y - m.y) * n.y;
  const inside = (p: Pt) => (keepNegative ? f(p) <= 0 : f(p) >= 0);
  const out: Pt[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const fa = f(a);
      const fb = f(b);
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/* Fold geometry for a page W×H whose corner C has been dragged to P. */
function foldGeometry(W: number, H: number, C: Pt, P: Pt): Geometry {
  const dx = C.x - P.x;
  const dy = C.y - P.y;
  const len = Math.hypot(dx, dy);
  const rect = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  if (len < 0.5) return { front: rect, back: [], folded: [], matrix: "none", shadow: [], fold: null };
  const n = { x: dx / len, y: dy / len }; // points toward the grabbed corner
  const m = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 };
  const front = clipHalfPlane(rect, m, n, true);
  const folded = clipHalfPlane(rect, m, n, false);
  const k = 2 * (m.x * n.x + m.y * n.y);
  const a = 1 - 2 * n.x * n.x;
  const b = -2 * n.x * n.y;
  const d = 1 - 2 * n.y * n.y;
  const e = k * n.x;
  const f = k * n.y;
  const reflect = (p: Pt): Pt => ({ x: a * p.x + b * p.y + e, y: b * p.x + d * p.y + f });
  const back = folded.map(reflect);
  // The curled part stands off the page, so its shadow falls on the paper *beyond* its outer edge
  // (away from the grabbed corner), growing as more of the sheet lifts
  const lift = Math.min(26, 6 + len * 0.05);
  const shadow = back.map((p) => ({ x: p.x - n.x * lift, y: p.y - n.y * lift }));
  return { front, back, folded, matrix: `matrix(${a},${b},${b},${d},${e},${f})`, shadow, fold: { m, n, len } };
}

export const PageTurner = forwardRef<PageTurnerHandle, PageTurnerProps>(function PageTurner(
  { api, mode, turnSpeed = "normal", theme, canNext, canPrev, pageKey, disabled, onTapCenter, onTurned, children },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  // An OS reduced-motion hint only shortens the animation instead of silently disabling it.
  const reduced = useReducedMotion();
  const effectiveMode: PageTurnMode = mode;
  const [lite] = useState(isLiteDevice);
  const fullTurnSec = TURN_SPEED_SECONDS[turnSpeed] * (reduced ? 0.6 : lite ? 0.8 : 1);
  const [dragging, setDragging] = useState(false);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  /* Overlay DOM, driven imperatively at 60fps. The overlay is never display:none: a hidden face
     stays laid out and painted, so showing it is a compositor change, not a fresh layout. */
  const overlayRef = useRef<HTMLDivElement>(null);
  const curlRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<SVGPolygonElement>(null);
  const shadeRef = useRef<SVGPolygonElement>(null);
  const shadeGradRef = useRef<SVGLinearGradientElement>(null);
  const creaseRef = useRef<SVGPolygonElement>(null);
  const creaseGradRef = useRef<SVGLinearGradientElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  // The turn in progress. A ref rather than state, so showing and hiding never wait on a React render.
  const activeRef = useRef<null | { dir: 1 | -1; kind: "curl" | "slide" }>(null);
  // Pointer movement that arrived while the turn was still being set up
  const dragReady = useRef(false);
  const pendingDrag = useRef<{ t: number; py: number } | null>(null);
  const t = useMotionValue(0); // 0 = sheet at rest on its own page, 1 = fully turned away
  const py = useMotionValue(0); // pointer-driven vertical offset for the fold angle
  const turning = useRef(false);
  const sizeRef = useRef({ W: 0, H: 0 });

  const validFace = (f: PageFace | null | undefined): PageFace | null => {
    if (!f) return null;
    if (f instanceof HTMLCanvasElement) return f.width > 0 && f.height > 0 ? f : null;
    return f;
  };
  // Faces are DOM clones / canvases produced in a few ms, so always take a fresh one at turn start
  const getSnapshot = useCallback(
    async () => validFace(await withTimeout(api?.snapshot() ?? Promise.resolve(null), SNAPSHOT_BUDGET_MS, null)),
    [api],
  );

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { W: el.clientWidth, H: el.clientHeight };
    });
    ro.observe(el);
    sizeRef.current = { W: el.clientWidth, H: el.clientHeight };
    return () => ro.disconnect();
  }, []);

  /* ---------- painting ---------- */
  const paintFace = (host: HTMLDivElement | null, face: PageFace | null): Promise<void> => {
    if (!host) return Promise.resolve();
    if (!face) {
      host.replaceChildren();
      host.style.background = themeRef.current.bg;
      return Promise.resolve();
    }
    const cur = host.firstElementChild as PageFace | null;
    // Same document as the face already here (another page of the same chapter): move it, don't reload it
    if (face.rrKey && cur && cur !== face && cur.rrKey === face.rrKey && cur.rrAdopt) {
      cur.rrAdopt(face);
      return cur.rrReadyPromise ?? Promise.resolve();
    }
    // Keyed faces carry their own backdrop; a transparent host lets any part not painted yet show
    // the identical live page instead of blank paper
    host.style.background = face.rrKey ? "transparent" : themeRef.current.bg;
    if (face instanceof HTMLCanvasElement) {
      face.style.width = "100%";
      face.style.height = "100%";
      face.style.display = "block";
    }
    host.replaceChildren(face);
    face.rrReadyPromise = face.rrReady ? face.rrReady() : Promise.resolve();
    return face.rrReadyPromise;
  };

  // Warm face: the current page is painted into the active mode's hidden sheet ahead of time, so a
  // turn normally finds the same document already laid out there and only has to move it.
  const [warmTick, setWarmTick] = useState(0);
  useEffect(() => {
    if (!api || !pageKey || effectiveMode === "none" || effectiveMode === "scroll") return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      if (turning.current) return;
      const face = await getSnapshot();
      if (cancelled || !face || turning.current) return;
      const [host, other] = effectiveMode === "slide" ? [slideRef.current, frontRef.current] : [frontRef.current, slideRef.current];
      if (other?.firstChild) paintFace(other, null);
      await paintFace(host, face);
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, pageKey, effectiveMode, warmTick]);

  const render = useCallback(() => {
    const a = activeRef.current;
    if (!a) return;
    const { W, H } = sizeRef.current;
    const tv = t.get();
    if (a.kind === "slide") {
      // The copy of the current page slides away (left going forward, right going back) over the live
      // reader, which is already on the destination page. The live reader itself never moves: epub.js
      // decides which chapter views to show from cached container bounds, so translating it hides the
      // incoming page until the turn ends.
      const p = a.dir === 1 ? tv : 1 - tv;
      if (slideRef.current) slideRef.current.style.transform = `translate3d(${(-a.dir * W * p).toFixed(1)}px,0,0)`;
      return;
    }
    // The sheet always turns at the right edge; going back it is the previous page unfolding (t: 1 → 0).
    // The live reader shows the destination page, so the copy of the current page only has to cover
    // the part still showing it: the sheet's flat part going forward, the uncovered part going back.
    const C = { x: W, y: H };
    const P = { x: W - 2 * W * tv, y: Math.max(0, Math.min(H, H + py.get())) };
    const g = foldGeometry(W, H, C, P);
    if (frontRef.current) frontRef.current.style.clipPath = poly(a.dir === 1 ? g.front : g.folded);
    if (backRef.current) backRef.current.style.clipPath = poly(g.back);
    // No sheet on the page at either extreme, so its shadows fade out there rather than leaving a band
    const edgeFade = Math.min(1, Math.min(tv, 1 - tv) / 0.04).toFixed(3);
    if (shadowRef.current) { shadowRef.current.setAttribute("points", pts(g.shadow)); shadowRef.current.setAttribute("opacity", edgeFade); }
    if (shadeRef.current) shadeRef.current.setAttribute("points", pts(g.back));
    if (creaseRef.current) { creaseRef.current.setAttribute("points", pts(g.folded)); creaseRef.current.setAttribute("opacity", edgeFade); }
    if (g.fold) {
      const { m, n, len } = g.fold;
      // Curl radius: tight when the corner has barely moved, opening up as the sheet comes over
      const R = Math.max(40, Math.min(W * 0.22, 36 + len * 0.16));
      // Back face: shading runs away from the crease into the lifted sheet (−n). The cylinder's
      // top catches light about a third of the way in, then falls back to flat paper.
      shadeGradRef.current?.setAttribute("x1", `${m.x}`);
      shadeGradRef.current?.setAttribute("y1", `${m.y}`);
      shadeGradRef.current?.setAttribute("x2", `${m.x - n.x * R * 2.2}`);
      shadeGradRef.current?.setAttribute("y2", `${m.y - n.y * R * 2.2}`);
      // Revealed page: the valley right under the crease is darkest and clears within one radius
      creaseGradRef.current?.setAttribute("x1", `${m.x}`);
      creaseGradRef.current?.setAttribute("y1", `${m.y}`);
      creaseGradRef.current?.setAttribute("x2", `${m.x + n.x * R}`);
      creaseGradRef.current?.setAttribute("y2", `${m.y + n.y * R}`);
    }
  }, [t, py]);

  useEffect(() => {
    const u1 = t.on("change", render);
    const u2 = py.on("change", render);
    render();
    return () => {
      u1();
      u2();
    };
  }, [render, t, py]);

  /* ---------- turn orchestration ---------- */
  const showOverlay = (kind: "curl" | "slide", dir: 1 | -1) => {
    if (slideRef.current) {
      slideRef.current.style.opacity = kind === "slide" ? "1" : "0";
      // The shadow trails the moving page: on its right going forward, on its left going back
      const shadow = themeRef.current.dark ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.28)";
      slideRef.current.style.boxShadow = kind === "slide" ? `${dir === 1 ? 10 : -10}px 0 28px ${shadow}` : "none";
    }
    if (curlRef.current) curlRef.current.style.opacity = kind === "curl" ? "1" : "0";
    if (overlayRef.current) overlayRef.current.style.opacity = "1";
    render();
  };
  const hideOverlay = () => {
    if (overlayRef.current) overlayRef.current.style.opacity = "0";
  };

  const finish = useCallback(() => {
    // Hide first. Resetting the sheet while it is still on screen flashes the old page back.
    hideOverlay();
    activeRef.current = null;
    turning.current = false;
    dragReady.current = false;
    pendingDrag.current = null;
    t.set(0);
    py.set(0);
    // Park the hidden sheet over the page again so its copy stays laid out for the next turn
    if (slideRef.current) slideRef.current.style.transform = "";
    if (frontRef.current) frontRef.current.style.clipPath = "";
    // The relocation that changed pageKey arrived mid-turn; warm the new page now that we're idle
    setWarmTick((n) => n + 1);
  }, [t, py]);

  const beginTurn = useCallback(
    async (dir: 1 | -1): Promise<boolean> => {
      if (!api || turning.current || disabled) return false;
      if (dir === 1 && !canNext) return false;
      if (dir === -1 && !canPrev) return false;
      turning.current = true;

      if (effectiveMode === "none" || effectiveMode === "scroll") {
        await (dir === 1 ? api.next() : api.prev());
        onTurned?.(dir);
        turning.current = false;
        return true;
      }

      const kind = effectiveMode === "slide" ? "slide" : "curl";
      const host = kind === "slide" ? slideRef.current : frontRef.current;
      dragReady.current = false;
      pendingDrag.current = null;
      // At rest the sheet is a copy of the current page lying exactly over the live one
      activeRef.current = { dir, kind };
      t.set(dir === 1 ? 0 : 1);
      py.set(0);
      render();
      try {
        // Only ever the page on screen right now, so the copy can be checked against the live page
        const face = await getSnapshot();
        if (!face) {
          // Nothing to animate with — still turn, just without the sheet
          activeRef.current = null;
          await (dir === 1 ? api.next() : api.prev());
          onTurned?.(dir);
          turning.current = false;
          return false;
        }
        await paintFace(host, face);
        // Reveal the copy and let it reach the screen before the reader underneath moves: until the
        // live page changes, any part of the copy that hasn't painted yet is indistinguishable from it.
        showOverlay(kind, dir);
        await nextFrames(2);
        await (dir === 1 ? api.next() : api.prev());
        const pending = pendingDrag.current;
        pendingDrag.current = null;
        dragReady.current = true;
        if (pending) {
          t.set(pending.t);
          py.set(pending.py);
        }
        return true;
      } catch (e) {
        console.warn("page turn failed", e);
        finish();
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, disabled, canNext, canPrev, effectiveMode, getSnapshot, onTurned, t, py, finish, render],
  );

  const settle = useCallback(
    async (dir: 1 | -1, commit: boolean, velocity = 0) => {
      const target = dir === 1 ? (commit ? 1 : 0) : commit ? 0 : 1;
      const from = t.get();
      const dist = Math.abs(target - from);
      // Remaining distance at the chosen pace, with a floor so short releases still read as motion;
      // a flick shaves off up to a third.
      const flick = Math.min(0.33, Math.abs(velocity) * 0.25);
      const duration = Math.max(0.28, fullTurnSec * (0.35 + 0.65 * dist)) * (1 - flick);
      await Promise.all([
        animate(t, target, { duration, ease: TURN_EASE }).finished,
        animate(py, 0, { duration: Math.min(duration, 0.45), ease: "easeOut" }).finished,
      ]);
      if (!commit) {
        // Put the live reader back where the sheet says it is
        await (dir === 1 ? api?.prev() : api?.next());
        await nextFrames(2);
      } else onTurned?.(dir);
      finish();
    },
    [api, finish, onTurned, t, py, fullTurnSec],
  );

  const turn = useCallback(
    async (dir: 1 | -1) => {
      const ok = await beginTurn(dir);
      if (!ok) return;
      if (effectiveMode === "none" || effectiveMode === "scroll") return;
      // Programmatic turn: add a little lift so the fold runs diagonally like a thumb flick
      const { H } = sizeRef.current;
      animate(py, -H * 0.22, { duration: fullTurnSec * 0.4, ease: "easeOut" });
      await settle(dir, true);
    },
    [beginTurn, settle, effectiveMode, py, fullTurnSec],
  );

  /* ---------- gestures ----------
     One engine for every input source: root pointer events (capture phase, so the reader keeps
     getting them for selection/links until a horizontal drag is recognised) and events fed in
     from inside the EPUB iframe. */
  type Zone = "left" | "right" | "center";
  type Gesture = { id: number; type: string; zone: Zone; dir: 1 | -1; startX: number; startY: number; startT: number; lastX: number; lastTime: number; vx: number; dragging: boolean; began: boolean; captured: boolean; systemEdge: boolean; starting?: Promise<boolean> };
  const gesture = useRef<Gesture | null>(null);

  const edgeFraction = () => (sizeRef.current.W < 600 ? EDGE_NARROW : EDGE);
  const zoneAt = (x: number): Zone => {
    const { W } = sizeRef.current;
    const left = rootRef.current?.getBoundingClientRect().left ?? 0;
    const rx = W ? (x - left) / W : 0.5;
    const edge = edgeFraction();
    return rx < edge ? "left" : rx > 1 - edge ? "right" : "center";
  };
  const hasSelection = () => {
    const s = document.getSelection();
    return !!s && !s.isCollapsed && s.toString().trim().length > 0;
  };
  const releaseCapture = (g: Gesture) => {
    if (!g.captured) return;
    try { rootRef.current?.releasePointerCapture(g.id); } catch { /* already released */ }
  };

  const gDown = (p: GesturePoint) => {
    if (disabled || effectiveMode === "scroll") return;
    const now = performance.now();
    const systemEdge = p.pointerType === "touch" && (p.x < SYSTEM_EDGE_PX || p.x > window.innerWidth - SYSTEM_EDGE_PX);
    gesture.current = { id: p.id, type: p.pointerType, zone: zoneAt(p.x), dir: 1, startX: p.x, startY: p.y, startT: now, lastX: p.x, lastTime: now, vx: 0, dragging: false, began: false, captured: false, systemEdge };
  };

  const gMove = async (p: GesturePoint) => {
    const g = gesture.current;
    if (!g || g.id !== p.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - g.lastTime);
    g.vx = (p.x - g.lastX) / dt;
    g.lastX = p.x;
    g.lastTime = now;
    const dx = p.x - g.startX;
    const dy = p.y - g.startY;
    if (!g.dragging) {
      if (disabled) return;
      if (Math.abs(dx) < DRAG_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      // A swipe that began in the system strip belongs to the browser's back/forward gesture
      if (g.systemEdge) return;
      // Mouse drags in the middle of the page select text; fingers and pens swipe anywhere
      if (g.zone === "center" && g.type === "mouse") return;
      if (effectiveMode === "none" || hasSelection()) return;
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      if ((dir === 1 && !canNext) || (dir === -1 && !canPrev)) { gesture.current = null; return; }
      g.dragging = true;
      g.dir = dir;
      setDragging(true);
      try { rootRef.current?.setPointerCapture(p.id); g.captured = true; } catch { /* fed from an iframe */ }
      g.began = true;
      g.starting = beginTurn(dir);
      void g.starting.then((ok) => {
        if (!ok && gesture.current === g) { releaseCapture(g); gesture.current = null; setDragging(false); }
      });
    }
    if (!turning.current || !activeRef.current) return;
    const { W } = sizeRef.current;
    // Slide follows the finger 1:1. For the curl the corner moves faster than the finger: it needs
    // 2W to flip fully, and a full-width swipe should get there.
    const travel = activeRef.current.kind === "slide" ? W : (2 * W) / (W < 600 ? DRAG_GAIN_NARROW : DRAG_GAIN);
    const next = Math.max(0, Math.min(1, g.dir === 1 ? (g.startX - p.x) / travel : 1 - (p.x - g.startX) / travel));
    // Until the sheet is on screen the move is only remembered, then applied in one step
    if (!dragReady.current) {
      pendingDrag.current = { t: next, py: dy };
      return;
    }
    t.set(next);
    // Fold angle follows the finger's height 1:1
    py.set(dy);
  };

  const gUp = async (p: GesturePoint) => {
    const g = gesture.current;
    if (!g || g.id !== p.id) return;
    gesture.current = null;
    releaseCapture(g);
    setDragging(false);
    const elapsed = performance.now() - g.startT;
    const dx = p.x - g.startX;
    const dy = p.y - g.startY;
    if (!g.dragging) {
      if (elapsed < TAP_MS && Math.hypot(dx, dy) < TAP_PX) {
        // Centre taps reach the reader itself, which reports them via onTap
        if (g.zone !== "center") turn(g.zone === "right" ? 1 : -1);
      } else if (effectiveMode === "none" && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) && !hasSelection()) {
        turn(dx < 0 ? 1 : -1);
      }
      return;
    }
    if (g.starting && !(await g.starting)) return;
    if (!turning.current) return;
    const tv = t.get();
    const towardCommit = g.dir === 1 ? -g.vx : g.vx; // px/ms in the direction that completes the turn
    const progress = g.dir === 1 ? tv : 1 - tv;
    const commit = progress > COMMIT_PROGRESS || (progress > 0.05 && towardCommit > COMMIT_VELOCITY);
    await settle(g.dir, commit, towardCommit);
  };

  const gCancel = (p?: GesturePoint) => {
    const g = gesture.current;
    if (!g || (p && g.id !== p.id)) return;
    gesture.current = null;
    releaseCapture(g);
    setDragging(false);
    if (g.began) void g.starting?.then((ok) => { if (ok && turning.current) return settle(g.dir, false); });
  };

  const feed = useCallback((phase: GesturePhase, p: GesturePoint) => {
    if (phase === "down") gDown(p);
    else if (phase === "move") void gMove(p);
    else if (phase === "up") void gUp(p);
    else gCancel(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, effectiveMode, canNext, canPrev, beginTurn, settle, turn]);

  useImperativeHandle(ref, () => ({ turn, feed }), [turn, feed]);

  const toPoint = (e: React.PointerEvent): GesturePoint => ({ id: e.pointerId, x: e.clientX, y: e.clientY, pointerType: e.pointerType });
  const rootPointer = {
    onPointerDownCapture: (e: React.PointerEvent) => { if (e.button === 0) gDown(toPoint(e)); },
    onPointerMoveCapture: (e: React.PointerEvent) => { void gMove(toPoint(e)); },
    onPointerUpCapture: (e: React.PointerEvent) => { void gUp(toPoint(e)); },
    onPointerCancelCapture: (e: React.PointerEvent) => gCancel(toPoint(e)),
  };

  const showZones = effectiveMode !== "scroll" && !disabled;
  const sheetShadow = theme.dark ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.28)";
  if (import.meta.env.DEV) {
    (window as unknown as { __rrTurner?: () => unknown }).__rrTurner = () => ({ mode, effectiveMode, reduced, api: !!api, disabled, turning: turning.current, canNext, canPrev, active: activeRef.current, t: t.get(), dragReady: dragReady.current, pending: pendingDrag.current, gesture: gesture.current && { dragging: gesture.current.dragging, dir: gesture.current.dir, lastX: gesture.current.lastX, startX: gesture.current.startX } });
  }

  return (
    <div ref={rootRef} className="relative h-full w-full select-none overflow-hidden" style={{ touchAction: disabled ? "auto" : effectiveMode === "scroll" ? "pan-y" : "none", cursor: dragging ? "grabbing" : undefined }} {...rootPointer}>
      <div className="absolute inset-0">{children}</div>

      {/* Edge zones: tap targets that keep edge touches away from the text; the middle belongs to the reader */}
      {showZones && (
        <>
          <div className="absolute inset-y-0 left-0 z-20" style={{ width: `${edgeFraction() * 100}%`, cursor: dragging ? "grabbing" : canPrev ? "grab" : "default" }} aria-hidden />
          <div className="absolute inset-y-0 right-0 z-20" style={{ width: `${edgeFraction() * 100}%`, cursor: dragging ? "grabbing" : canNext ? "grab" : "default" }} aria-hidden />
        </>
      )}

      {/* Overlay. Shown and hidden by opacity, imperatively; React never touches these opacities
          after mount, so re-renders can't flash it. */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-30" style={{ opacity: 0, willChange: "opacity" }} aria-hidden>
        <div ref={slideRef} className="absolute inset-0" style={{ opacity: 0, willChange: "transform" }} />
        <div ref={curlRef} className="absolute inset-0" style={{ opacity: 0 }}>
          {/* translateZ promotes each face to its own layer so the clip is applied at composite time
              instead of re-rasterizing the chapter document every frame */}
          <div ref={frontRef} className="absolute inset-0 will-change-[clip-path]" style={{ transform: "translateZ(0)", contain: "paint" }} />
          {/* Shadow the lifted sheet throws onto the page it is peeling from */}
          <svg className="absolute inset-0 h-full w-full overflow-visible">
            {!lite && (
              <defs>
                <filter id="rr-fold-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="9" />
                </filter>
              </defs>
            )}
            <polygon ref={shadowRef} fill={sheetShadow} fillOpacity={lite ? 0.45 : 0.85} filter={lite ? undefined : "url(#rr-fold-blur)"} />
          </svg>
          {/* Back of the sheet: paper a shade off the page colour so the fold reads as a surface */}
          <div ref={backRef} className="absolute inset-0 will-change-[clip-path]" style={{ backgroundColor: theme.bg, transform: "translateZ(0)", contain: "paint" }}>
            <div className="absolute inset-0" style={{ background: theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)" }} />
          </div>
          <svg className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              {/* Cylinder: dark in the crease, a highlight where the roll faces the light, then flat paper */}
              <linearGradient id="rr-fold-shade" ref={shadeGradRef} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#000" stopOpacity={theme.dark ? 0.6 : 0.42} />
                <stop offset="0.12" stopColor="#000" stopOpacity={theme.dark ? 0.3 : 0.16} />
                <stop offset="0.3" stopColor="#fff" stopOpacity={theme.dark ? 0.08 : 0.5} />
                <stop offset="0.5" stopColor="#fff" stopOpacity={theme.dark ? 0.03 : 0.12} />
                <stop offset="1" stopColor="#000" stopOpacity={theme.dark ? 0.12 : 0.05} />
              </linearGradient>
              {/* Valley on the revealed page, directly under the crease */}
              <linearGradient id="rr-fold-crease" ref={creaseGradRef} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#000" stopOpacity={theme.dark ? 0.55 : 0.3} />
                <stop offset="0.45" stopColor="#000" stopOpacity={theme.dark ? 0.16 : 0.08} />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon ref={creaseRef} fill="url(#rr-fold-crease)" />
            <polygon ref={shadeRef} fill="url(#rr-fold-shade)" />
          </svg>
        </div>
      </div>
    </div>
  );
});
