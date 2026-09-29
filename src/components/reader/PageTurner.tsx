import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import type { ReaderApi } from "@/components/readers/EpubReader";
import type { PageTurnMode, ReaderTheme } from "@/lib/reader-themes";

/* Apple Books–style page turning on top of any ReaderApi.
   The live reader advances underneath; a raster snapshot of the outgoing page is animated on top
   (curl = 2-D fold with mirrored back face and cast shadow; slide = horizontal sheet). */

export interface PageTurnerHandle {
  turn: (dir: 1 | -1) => void;
}

interface PageTurnerProps {
  api: ReaderApi | null;
  mode: PageTurnMode;
  theme: ReaderTheme;
  canNext: boolean;
  canPrev: boolean;
  /** Changes whenever the rendered page could look different (location, theme, typography, size) */
  snapshotKey: string;
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
const TAP_MS = 260;
const TAP_PX = 8;

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
  { api, mode, theme, canNext, canPrev, snapshotKey, disabled, onTapCenter, onTurned, children },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const effectiveMode: PageTurnMode = reduced && mode !== "scroll" ? "none" : mode;

  // Overlay DOM (imperatively driven for 60fps)
  const staticRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const backImgRef = useRef<HTMLDivElement>(null);
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

  // Snapshot cache of the current page, refreshed a moment after each relocation
  const cache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  useEffect(() => {
    if (!api || effectiveMode === "none" || effectiveMode === "scroll") return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      const c = await api.snapshot();
      if (!cancelled && c) cache.current = { key: snapshotKey, canvas: c };
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [api, snapshotKey, effectiveMode]);

  const getSnapshot = useCallback(async () => {
    if (cache.current?.key === snapshotKey) return cache.current.canvas;
    const c = await api?.snapshot();
    if (c) cache.current = { key: snapshotKey, canvas: c };
    return c ?? null;
  }, [api, snapshotKey]);

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
  const paintCanvas = (host: HTMLDivElement | null, canvas: HTMLCanvasElement | null) => {
    if (!host) return;
    host.replaceChildren();
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      host.appendChild(canvas);
    } else host.style.background = theme.bg;
  };

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
    if (backImgRef.current) backImgRef.current.style.transform = g.matrix;
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
      const current = await getSnapshot();
      // Mount the right overlay variant now so its refs exist for painting
      flushSync(() => {
        activeRef.current = { dir, kind };
        setActive({ dir, kind });
      });
      if (dir === 1) {
        // Outgoing page rides the sheet; the live reader already shows the next page underneath
        paintCanvas(staticRef.current, null);
        if (staticRef.current) staticRef.current.style.display = "none";
        paintCanvas(kind === "slide" ? slideRef.current : frontRef.current, current);
        if (kind === "curl") paintCanvas(backImgRef.current, current ? cloneCanvas(current) : null);
        t.set(0);
        render();
        await api.next();
      } else {
        // Current page stays as a static layer; the previous page unfolds over it (t from 1 → 0)
        if (staticRef.current) staticRef.current.style.display = "block";
        paintCanvas(staticRef.current, current);
        paintCanvas(kind === "slide" ? slideRef.current : frontRef.current, null);
        if (kind === "curl") paintCanvas(backImgRef.current, null);
        t.set(1);
        render();
        await api.prev();
        // Give the live reader a frame to paint, then capture the incoming page for the sheet
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const prevCanvas = await api.snapshot();
        paintCanvas(kind === "slide" ? slideRef.current : frontRef.current, prevCanvas);
        if (kind === "curl") paintCanvas(backImgRef.current, prevCanvas ? cloneCanvas(prevCanvas) : null);
      }
      return true;
    },
    [api, disabled, canNext, canPrev, effectiveMode, getSnapshot, onTurned, t],
  );

  const settle = useCallback(
    async (dir: 1 | -1, commit: boolean, velocity = 0) => {
      const target = dir === 1 ? (commit ? 1 : 0) : commit ? 0 : 1;
      const from = t.get();
      const dist = Math.abs(target - from);
      await Promise.all([
        animate(t, target, { duration: Math.max(0.16, Math.min(0.55, 0.5 * dist + 0.1 - Math.min(0.2, Math.abs(velocity) * 0.1))), ease: [0.22, 1, 0.36, 1] }).finished,
        animate(py, 0, { duration: 0.35, ease: "easeOut" }).finished,
      ]);
      if (!commit) {
        // Put the live reader back where the sheet says it is
        await (dir === 1 ? api?.prev() : api?.next());
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      } else onTurned?.(dir);
      finish();
    },
    [api, finish, onTurned, t, py],
  );

  const turn = useCallback(
    async (dir: 1 | -1) => {
      const ok = await beginTurn(dir);
      if (!ok) return;
      if (effectiveMode === "none" || effectiveMode === "scroll") return;
      // Programmatic turn: add a little lift so the fold runs diagonally like a thumb flick
      const { H } = sizeRef.current;
      animate(py, -H * 0.22, { duration: 0.25, ease: "easeOut" });
      await settle(dir, true);
    },
    [beginTurn, settle, effectiveMode, py],
  );

  useImperativeHandle(ref, () => ({ turn }), [turn]);

  /* ---------- gestures ---------- */
  const gesture = useRef<null | { dir: 1 | -1; startX: number; startY: number; startT: number; lastX: number; lastTime: number; vx: number; dragging: boolean; began: boolean; starting?: Promise<boolean> }>(null);

  const onPointerDown = (e: React.PointerEvent, zone: "left" | "right" | "center") => {
    if (disabled || e.button !== 0) return;
    if (effectiveMode === "scroll") {
      if (zone === "center") onTapCenter?.();
      return;
    }
    const dir: 1 | -1 = zone === "right" ? 1 : -1;
    if (zone === "center") {
      gesture.current = { dir: 1, startX: e.clientX, startY: e.clientY, startT: performance.now(), lastX: e.clientX, lastTime: performance.now(), vx: 0, dragging: false, began: false };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    gesture.current = { dir, startX: e.clientX, startY: e.clientY, startT: performance.now(), lastX: e.clientX, lastTime: performance.now(), vx: 0, dragging: false, began: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = async (e: React.PointerEvent, zone: "left" | "right" | "center") => {
    const g = gesture.current;
    if (!g) return;
    const now = performance.now();
    const dt = Math.max(1, now - g.lastTime);
    g.vx = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastTime = now;
    const dx = e.clientX - g.startX;
    if (!g.dragging && Math.abs(dx) > TAP_PX && zone !== "center") g.dragging = true;
    if (!g.dragging) return;
    if (effectiveMode === "none") return;
    if (!g.began) {
      g.began = true;
      g.starting = beginTurn(g.dir);
      const ok = await g.starting;
      if (!ok) {
        gesture.current = null;
        return;
      }
    }
    if (!turning.current) return;
    const { W } = sizeRef.current;
    if (g.dir === 1) {
      const travel = Math.max(1, g.startX - W * 0.12);
      t.set(Math.max(0, Math.min(1, (g.startX - e.clientX) / travel)));
    } else {
      const travel = Math.max(1, W * 0.88 - g.startX);
      t.set(Math.max(0, Math.min(1, 1 - (e.clientX - g.startX) / travel)));
    }
    py.set((e.clientY - g.startY) * 0.5);
  };

  const onPointerUp = async (e: React.PointerEvent, zone: "left" | "right" | "center") => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const elapsed = performance.now() - g.startT;
    const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
    if (!g.dragging) {
      if (elapsed < TAP_MS && moved < TAP_PX) {
        if (zone === "center") onTapCenter?.();
        else turn(g.dir);
      }
      return;
    }
    if (!g.began) return;
    if (g.starting && !(await g.starting)) return;
    if (!turning.current) return;
    const tv = t.get();
    const towardCommit = g.dir === 1 ? -g.vx : g.vx; // px/ms in the direction that completes the turn
    const progress = g.dir === 1 ? tv : 1 - tv;
    const commit = progress > 0.4 || (progress > 0.08 && towardCommit > 0.45);
    await settle(g.dir, commit, towardCommit);
  };

  const zoneProps = (zone: "left" | "right" | "center") => ({
    onPointerDown: (e: React.PointerEvent) => onPointerDown(e, zone),
    onPointerMove: (e: React.PointerEvent) => onPointerMove(e, zone),
    onPointerUp: (e: React.PointerEvent) => onPointerUp(e, zone),
    onPointerCancel: () => {
      const g = gesture.current;
      gesture.current = null;
      if (g?.began) void g.starting?.then((ok) => { if (ok && turning.current) return settle(g.dir, false); });
    },
  });

  const showZones = effectiveMode !== "scroll" && !disabled;
  const sheetShadow = theme.dark ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.28)";

  return (
    <div ref={rootRef} className="relative h-full w-full select-none overflow-hidden" style={{ touchAction: effectiveMode === "scroll" ? "pan-y" : "none" }}>
      <div className="absolute inset-0">{children}</div>

      {/* Edge zones: turn; the middle is left to the reader for selection, centre taps arrive via onTap */}
      {showZones && (
        <>
          <div className="absolute inset-y-0 left-0 z-20" style={{ width: `${EDGE * 100}%`, cursor: canPrev ? "w-resize" : "default" }} {...zoneProps("left")} aria-hidden />
          <div className="absolute inset-y-0 right-0 z-20" style={{ width: `${EDGE * 100}%`, cursor: canNext ? "e-resize" : "default" }} {...zoneProps("right")} aria-hidden />
        </>
      )}

      {/* Overlay */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-30" style={{ display: active ? "block" : "none" }} aria-hidden>
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
            <div ref={backRef} className="absolute inset-0 will-change-[clip-path]" style={{ background: theme.bg }}>
              <div ref={backImgRef} className="absolute inset-0 origin-top-left" style={{ background: theme.bg }} />
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
