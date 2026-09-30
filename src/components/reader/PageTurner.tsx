import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
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
  matrix: string;
  shadow: Pt[];
  fold: { m: Pt; n: Pt } | null;
};

const EDGE = 0.18;
const EDGE_NARROW = 0.24; // phones: bigger tap targets
const TAP_MS = 300;
const TAP_PX = 10;
const DRAG_PX = 8;
const SWIPE_PX = 40; // "none" mode: a flick still turns
const SNAPSHOT_BUDGET_MS = 450; // past this, turn without animation rather than feel stuck
// The grabbed corner travels 2W to flip fully; the pointer moves it this many times its own
// distance, so the sheet feels attached to the finger instead of racing ahead of it.
const DRAG_GAIN = 2; // dragging the corner across the full page width flips it completely
const DRAG_GAIN_NARROW = 1.7; // phones: a full swipe should still get most of the way
const COMMIT_PROGRESS = 0.3; // release past this and the turn finishes
const COMMIT_VELOCITY = 0.35; // px/ms flick that finishes a turn from anywhere
const TURN_EASE: [number, number, number, number] = [0.3, 0.05, 0.2, 1];

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => window.setTimeout(() => r(fallback), ms))]);

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
  if (len < 0.5) return { front: rect, back: [], matrix: "none", shadow: [], fold: null };
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
  const lift = Math.min(18, len * 0.06);
  const shadow = back.map((p) => ({ x: p.x + n.x * lift, y: p.y + n.y * lift }));
  return { front, back, matrix: `matrix(${a},${b},${b},${d},${e},${f})`, shadow, fold: { m, n } };
}

export const PageTurner = forwardRef<PageTurnerHandle, PageTurnerProps>(function PageTurner(
  { api, mode, turnSpeed = "normal", theme, canNext, canPrev, pageKey, disabled, onTapCenter, onTurned, children },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  // The chosen mode is an explicit user setting ("None" exists for exactly this), so an OS
  // reduced-motion hint only shortens the animation instead of silently disabling it.
  const reduced = useReducedMotion();
  const effectiveMode: PageTurnMode = mode;
  const fullTurnSec = TURN_SPEED_SECONDS[turnSpeed] * (reduced ? 0.6 : 1);
  const [dragging, setDragging] = useState(false);

  // Overlay DOM (imperatively driven for 60fps)
  const staticRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<SVGPolygonElement>(null);
  const shadeRef = useRef<SVGPolygonElement>(null);
  const shadeGradRef = useRef<SVGLinearGradientElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState<null | { dir: 1 | -1; kind: "curl" | "slide" }>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
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
    host.replaceChildren();
    if (!face) {
      host.style.background = theme.bg;
      return Promise.resolve();
    }
    if (face instanceof HTMLCanvasElement) {
      face.style.width = "100%";
      face.style.height = "100%";
      face.style.display = "block";
    }
    host.appendChild(face);
    return face.rrReady ? face.rrReady() : Promise.resolve();
  };
  const cloneFace = (face: PageFace | null): PageFace | null => {
    if (!face) return null;
    if (face instanceof HTMLCanvasElement) return cloneCanvas(face);
    const c = face.cloneNode(true) as PageFace;
    c.rrReady = face.rrReady;
    return c;
  };

  // Warm faces: painted into the hidden overlay hosts ahead of time (iframes load while display:none),
  // so a turn needs no snapshot or load at gesture start. Moving an iframe reloads it, so each host
  // gets its own copy rather than sharing one. Each copy is a full chapter document, so only the two
  // that every turn needs are kept warm; the back of the sheet is plain paper.
  const warmKey = useRef<string | null>(null);
  const [warmTick, setWarmTick] = useState(0);
  useEffect(() => {
    warmKey.current = null;
    if (!api || !pageKey || effectiveMode === "none" || effectiveMode === "scroll") return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      if (turning.current || activeRef.current) return;
      const face = await getSnapshot();
      if (cancelled || !face || turning.current || activeRef.current) return;
      await Promise.all([paintFace(frontRef.current, face), paintFace(staticRef.current, cloneFace(face))]);
      if (!cancelled && !turning.current) warmKey.current = pageKey;
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
      if (slideRef.current) slideRef.current.style.transform = `translate3d(${(-W * tv).toFixed(1)}px,0,0)`;
      return;
    }
    // Sheet always turns from the right edge; for "prev" the sheet is the incoming page unfolding back (t: 1 → 0)
    const C = { x: W, y: H };
    const P = { x: W - 2 * W * tv, y: Math.max(0, Math.min(H, H + py.get())) };
    const g = foldGeometry(W, H, C, P);
    if (frontRef.current) frontRef.current.style.clipPath = poly(g.front);
    if (backRef.current) backRef.current.style.clipPath = poly(g.back);
    if (shadowRef.current) shadowRef.current.setAttribute("points", pts(g.shadow));
    if (shadeRef.current) shadeRef.current.setAttribute("points", pts(g.back));
    if (shadeGradRef.current && g.fold) {
      const { m, n } = g.fold;
      const L = Math.max(60, W * 0.18);
      shadeGradRef.current.setAttribute("x1", `${m.x}`);
      shadeGradRef.current.setAttribute("y1", `${m.y}`);
      shadeGradRef.current.setAttribute("x2", `${m.x - n.x * L}`);
      shadeGradRef.current.setAttribute("y2", `${m.y - n.y * L}`);
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
  }, [render, t, py, active]);

  /* ---------- turn orchestration ---------- */
  const finish = useCallback(() => {
    turning.current = false;
    setActive(null);
    t.set(0);
    py.set(0);
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
      try {
        const warm = !!pageKey && warmKey.current === pageKey && !!frontRef.current?.firstChild;
        warmKey.current = null;
        const current = warm ? null : await getSnapshot();
        if (!warm && !current) {
          // Nothing to animate with — still turn, just without the sheet
          await (dir === 1 ? api.next() : api.prev());
          onTurned?.(dir);
          turning.current = false;
          return false;
        }
        // Mount the right overlay variant now so its refs exist for painting
        flushSync(() => {
          activeRef.current = { dir, kind };
          setActive({ dir, kind });
        });
        const sheet = kind === "slide" ? slideRef.current : frontRef.current;
        if (dir === 1) {
          // Outgoing page rides the sheet; the live reader already shows the next page underneath
          if (staticRef.current) staticRef.current.style.display = "none";
          if (!warm) {
            t.set(0);
            render();
            await paintFace(sheet, current);
          } else if (kind === "slide" && slideRef.current && frontRef.current?.firstChild) {
            // Warm faces live in the curl hosts; the slide sheet borrows the front one
            await paintFace(slideRef.current, cloneFace(frontRef.current.firstChild as PageFace));
          }
          t.set(0);
          render();
          await api.next();
        } else {
          // Current page stays as a static layer; the previous page unfolds over it (t from 1 → 0)
          if (staticRef.current) staticRef.current.style.display = "block";
          if (!warm) await paintFace(staticRef.current, current);
          void paintFace(sheet, null);
          t.set(1);
          render();
          await api.prev();
          // Give the live reader a frame to paint, then capture the incoming page for the sheet
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const prevFace = validFace(await withTimeout(api.snapshot(), SNAPSHOT_BUDGET_MS, null));
          await paintFace(sheet, prevFace);
        }
        return true;
      } catch (e) {
        console.warn("page turn failed", e);
        finish();
        return false;
      }
    },
    [api, disabled, canNext, canPrev, effectiveMode, getSnapshot, onTurned, t, finish, pageKey],
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
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
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
  type Gesture = { id: number; type: string; zone: Zone; dir: 1 | -1; startX: number; startY: number; startT: number; lastX: number; lastTime: number; vx: number; dragging: boolean; began: boolean; captured: boolean; starting?: Promise<boolean> };
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
    gesture.current = { id: p.id, type: p.pointerType, zone: zoneAt(p.x), dir: 1, startX: p.x, startY: p.y, startT: now, lastX: p.x, lastTime: now, vx: 0, dragging: false, began: false, captured: false };
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
      if (Math.abs(dx) < DRAG_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
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
      if (!(await g.starting)) { releaseCapture(g); gesture.current = null; setDragging(false); return; }
    }
    if (!turning.current) return;
    const { W } = sizeRef.current;
    // Corner displacement = pointer displacement × gain; the corner needs 2W to flip fully
    const travel = (2 * W) / (W < 600 ? DRAG_GAIN_NARROW : DRAG_GAIN);
    t.set(Math.max(0, Math.min(1, g.dir === 1 ? (g.startX - p.x) / travel : 1 - (p.x - g.startX) / travel)));
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
    (window as unknown as { __rrTurner?: () => unknown }).__rrTurner = () => ({ mode, effectiveMode, reduced, api: !!api, disabled, turning: turning.current, canNext, canPrev, active: activeRef.current, t: t.get() });
  }

  return (
    <div ref={rootRef} className="relative h-full w-full select-none overflow-hidden" style={{ touchAction: effectiveMode === "scroll" ? "pan-y" : "none", cursor: dragging ? "grabbing" : undefined }} {...rootPointer}>
      <div className="absolute inset-0">{children}</div>

      {/* Edge zones: tap targets that keep edge touches away from the text; the middle belongs to the reader */}
      {showZones && (
        <>
          <div className="absolute inset-y-0 left-0 z-20" style={{ width: `${edgeFraction() * 100}%`, cursor: dragging ? "grabbing" : canPrev ? "grab" : "default" }} aria-hidden />
          <div className="absolute inset-y-0 right-0 z-20" style={{ width: `${edgeFraction() * 100}%`, cursor: dragging ? "grabbing" : canNext ? "grab" : "default" }} aria-hidden />
        </>
      )}

      {/* Overlay */}
      <div className="pointer-events-none absolute inset-0 z-30" style={{ display: active ? "block" : "none" }} aria-hidden>
        <div ref={staticRef} className="absolute inset-0" style={{ background: theme.bg, display: "none" }} />
        {active?.kind === "slide" ? (
          <div ref={slideRef} className="absolute inset-0 will-change-transform" style={{ background: theme.bg, boxShadow: `8px 0 24px ${sheetShadow}` }} />
        ) : (
          <>
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <filter id="rr-fold-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="10" />
                </filter>
                <linearGradient id="rr-fold-shade" ref={shadeGradRef} gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#000" stopOpacity={theme.dark ? 0.55 : 0.32} />
                  <stop offset="0.35" stopColor="#000" stopOpacity={theme.dark ? 0.22 : 0.1} />
                  <stop offset="1" stopColor="#fff" stopOpacity={theme.dark ? 0.02 : 0.12} />
                </linearGradient>
              </defs>
              <polygon ref={shadowRef} fill={sheetShadow} filter="url(#rr-fold-blur)" />
            </svg>
            <div ref={frontRef} className="absolute inset-0 will-change-[clip-path]" style={{ background: theme.bg }} />
            {/* Back of the sheet: plain paper, slightly darker than the page so the fold reads as a surface */}
            <div ref={backRef} className="absolute inset-0 will-change-[clip-path]" style={{ background: theme.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)", backgroundColor: theme.bg }}>
              <div className="absolute inset-0" style={{ background: theme.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)" }} />
            </div>
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              <polygon ref={shadeRef} fill="url(#rr-fold-shade)" />
            </svg>
          </>
        )}
      </div>
    </div>
  );
});

function cloneCanvas(src: HTMLCanvasElement) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d")?.drawImage(src, 0, 0);
  return c;
}
