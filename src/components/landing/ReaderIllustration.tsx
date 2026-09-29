import { useEffect, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

// "Reading book" by Abdul Latif — LottieFiles, Lottie Simple License (free for commercial use).
// Rendered with lottie-web's SVG renderer so individual layers can be driven by hand.
const SRC = "/lottie/reading.json";

// Scene geometry (composition units, 1200×1200)
const VIEW = { x: 130, y: 380, w: 1040, h: 730 };
const GLOBE = { cx: 906.75, cy: 880.75, r: 80.75 };
const GLOBE_PERIOD = 161.5; // continents texture repeats every globe diameter
const IDLE_SPIN = 0.45; // comp px per frame the globe drifts on its own

const CLIP_FRAMES = 179;
const READ_START = 60;
const READ_END = 120;
const READING_PAUSE_MIN = 10;
const READING_PAUSE_MAX = 16;

// Open-book page corners in the book layer's local space: [innerTop, outerTop, outerBottom, innerBottom]
type Pt = [number, number];
const NEAR_PAGE: Pt[] = [[563.2, 837.1], [620.9, 810.5], [605, 852.8], [543.1, 877.7]];
const FAR_PAGE: Pt[] = [[582.6, 816.8], [521.4, 845.9], [543.1, 872], [602.4, 846.8]];
// Projected "up off the page" direction; shorter than the page width because the book faces the viewer
const NORMAL: Pt = [-6, -36];
const FLIPS: Array<[number, number]> = [[66, 90]];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface ReadingClipData {
  assets?: Array<{
    id: string;
    layers?: Array<{ nm: string; ks?: Record<string, unknown>; shapes?: unknown }>;
  }>;
}

interface SvgLayer {
  data?: { nm?: string };
  layerElement?: SVGGElement;
  elements?: SvgLayer[];
  shapesData?: Array<{ nm?: string }>;
  itemsData?: Array<{ gr?: SVGGElement }>;
}

function holdReadingPose(value: unknown, frame: number): void {
  if (!value || typeof value !== "object") return;
  const property = value as Record<string, unknown>;
  if (property.a === 1 && Array.isArray(property.k)) {
    const keyframes = property.k as Array<{ t: number; s?: unknown[] }>;
    const resting = keyframes.filter((keyframe) => keyframe.t <= frame && keyframe.s).at(-1);
    if (resting?.s) {
      property.a = 0;
      property.k = structuredClone(resting.s.length === 1 ? resting.s[0] : resting.s);
      return;
    }
  }
  Object.values(value).forEach((child) => holdReadingPose(child, frame));
}

function prepareReadingClip(data: ReadingClipData): void {
  const layers = data.assets?.find((asset) => asset.id === "comp_0")?.layers ?? [];
  const heldLayers = new Set(["leg1", "leg2", "body", "arm1", "arm2", "book", "head"]);
  for (const layer of layers) {
    if (!heldLayers.has(layer.nm)) continue;
    const restingFrame = layer.nm.startsWith("leg") ? 30 : READ_START;
    holdReadingPose(layer.ks, restingFrame);
    holdReadingPose(layer.shapes, restingFrame);
    if (!layer.ks || (layer.nm !== "arm1" && layer.nm !== "head")) continue;
    const rotation = layer.ks.r as { k: number; ix?: number };
    const restingAngle = rotation.k;
    const poses = layer.nm === "arm1"
      ? [[READ_START, restingAngle], [66, restingAngle], [90, restingAngle + 4], [112, restingAngle], [READ_END, restingAngle]]
      : [[READ_START, restingAngle], [90, restingAngle + 0.8], [106, restingAngle + 1.5], [READ_END, restingAngle]];
    layer.ks.r = {
      a: 1,
      ix: rotation.ix,
      k: poses.map(([time, angle]) => ({
        t: time,
        s: [angle],
        i: { x: [0.667], y: [1] },
        o: { x: [0.333], y: [0] },
      })),
    };
  }
}

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// Leaf rotating about the spine: width vector swings from the near page's, through the normal,
// to the far page's. The two drawn pages don't share an inner edge, so the hinge slides across
// only after the leaf has dropped behind the near page (t > 0.5), where the move is hidden.
function pagePath(t: number) {
  const c = Math.cos(Math.PI * t);
  const s = Math.sin(Math.PI * t);
  const h = smooth(clamp01((t - 0.5) / 0.3));
  const hingeTop = lerp(NEAR_PAGE[0], FAR_PAGE[0], h);
  const hingeBot = lerp(NEAR_PAGE[3], FAR_PAGE[3], h);
  const wTop = t < 0.5 ? sub(NEAR_PAGE[1], NEAR_PAGE[0]) : sub(FAR_PAGE[0], FAR_PAGE[1]);
  const wBot = t < 0.5 ? sub(NEAR_PAGE[2], NEAR_PAGE[3]) : sub(FAR_PAGE[3], FAR_PAGE[2]);
  const pts: Pt[] = [
    hingeTop,
    [hingeTop[0] + c * wTop[0] + s * NORMAL[0], hingeTop[1] + c * wTop[1] + s * NORMAL[1]],
    [hingeBot[0] + c * wBot[0] + s * NORMAL[0], hingeBot[1] + c * wBot[1] + s * NORMAL[1]],
    hingeBot,
  ];
  return `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function ReaderIllustration({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // Only gates the pointer parallax; the scene itself always animates (product decision)
  const reduced = useReducedMotion();

  // Globe spin state (composition px)
  const spin = useRef({ offset: 0, velocity: 0, dragging: false, lastX: 0, frame: 0 });
  const globeGroup = useRef<SVGGElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const play = useRef({ visible: false, started: false, waiting: true, remaining: READING_PAUSE_MIN });

  const resume = () => {
    if (play.current.started && !play.current.waiting && !document.hidden) animRef.current?.play();
  };

  const suspend = () => animRef.current?.pause();

  const applySpin = () => {
    const g = globeGroup.current;
    if (!g) return;
    // The artist's continents slide one period over the full 0–179 clip; cancel that so the
    // shorter reading loop never jumps, then apply our own continuous rotation.
    const drift = (GLOBE_PERIOD * spin.current.frame) / CLIP_FRAMES;
    const o = (((spin.current.offset - drift) % GLOBE_PERIOD) + GLOBE_PERIOD) % GLOBE_PERIOD;
    g.setAttribute("transform", `translate(${o.toFixed(2)} 0)`);
  };

  // Tilt parallax (disabled while dragging the globe)
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 80, damping: 24, mass: 0.8 });
  const py = useSpring(rawY, { stiffness: 80, damping: 24, mass: 0.8 });
  const rotateY = useTransform(px, [-1, 1], [-5, 5]);
  const rotateX = useTransform(py, [-1, 1], [3, -3]);
  const shadowX = useTransform(px, [-1, 1], [12, -12]);

  useEffect(() => {
    if (!host.current) return;
    const playback = play.current;
    let anim: AnimationItem | null = null;
    let cancelled = false;
    let globeRaf = 0;
    let page: SVGPathElement | null = null;
    // Near (right) page group; the turning leaf drops behind it once past vertical
    let nearPage: SVGGElement | null = null;
    let pageOnTop = true;

    const onLoaded = () => {
      if (!anim || playback.started) return;
      anim.goToAndStop(READ_START, true);
      play.current.started = true;
      play.current.waiting = true;
      play.current.remaining = rand(READING_PAUSE_MIN, READING_PAUSE_MAX);

      const svg = host.current?.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("viewBox", `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`);

      // renderer.elements: [0] = people precomp, [1] = room precomp
      const renderer = (anim as AnimationItem & { renderer?: { elements?: SvgLayer[] } }).renderer;
      const people = renderer?.elements?.[0];
      const room = renderer?.elements?.[1];

      const torso = people?.elements?.find((layer) => layer.data?.nm === "body");
      if (torso?.layerElement) {
        const layer: SVGGElement = torso.layerElement;
        const breath = document.createElementNS(SVG_NS, "g");
        breath.setAttribute("class", "hero-breathe");
        while (layer.firstChild) breath.appendChild(layer.firstChild);
        layer.appendChild(breath);
      }

      // Turning page: appended inside the book layer so it inherits arm + book motion
      const book = people?.elements?.find((layer) => layer.data?.nm === "book");
      if (book?.layerElement) {
        page = document.createElementNS(SVG_NS, "path");
        page.setAttribute("fill", "#FFFFFF");
        page.setAttribute("stroke", "#1A1A1A");
        page.setAttribute("stroke-width", "1.2");
        page.setAttribute("stroke-linejoin", "round");
        page.setAttribute("opacity", "0");
        book.layerElement.appendChild(page);
        // Group 6 is the white fill of the near page (shapes render first-on-top)
        const idx = book.shapesData?.findIndex((shape) => shape.nm === "Group 6") ?? -1;
        nearPage = idx >= 0 ? book.itemsData?.[idx]?.gr ?? null : null;
      }

      // Globe: wrap the continents so we can add our own rotation, and tile them so it spins forever
      const continents = room?.elements?.find((layer) => layer.data?.nm === "shape");
      if (continents?.layerElement) {
        const layer: SVGGElement = continents.layerElement;
        const inner = document.createElementNS(SVG_NS, "g");
        while (layer.firstChild) inner.appendChild(layer.firstChild);
        const offsetGroup = document.createElementNS(SVG_NS, "g");
        offsetGroup.appendChild(inner);
        for (const k of [-2, -1, 1, 2]) {
          const clone = inner.cloneNode(true) as SVGGElement;
          clone.setAttribute("transform", `translate(${k * GLOBE_PERIOD} 0)`);
          offsetGroup.appendChild(clone);
        }
        layer.appendChild(offsetGroup);
        globeGroup.current = offsetGroup;
        applySpin();
      }

      let previousTime: number | null = null;
      const tickGlobe = (now: number) => {
        const elapsed = previousTime === null ? 0 : Math.min(50, now - previousTime) / 1000;
        previousTime = now;
        const s = spin.current;
        if (play.current.visible && !document.hidden) {
          if (play.current.waiting) {
            play.current.remaining -= elapsed;
            if (play.current.remaining <= 0 && anim) {
              play.current.waiting = false;
              anim.setSpeed(0.8);
              anim.playSegments([READ_START, READ_END], true);
            }
          }
          if (!s.dragging) {
            const frameDelta = elapsed * 60;
            s.velocity += (IDLE_SPIN - s.velocity) * (1 - Math.pow(0.97, frameDelta));
            s.offset += s.velocity * frameDelta;
            applySpin();
          }
        }
        globeRaf = requestAnimationFrame(tickGlobe);
      };
      globeRaf = requestAnimationFrame(tickGlobe);

      setReady(true);
      if (play.current.visible) resume();
    };

    const onFrame = () => {
      if (!anim) return;
      // Absolute clip frame (currentFrame is relative to the playing segment)
      const f = anim.currentFrame + (anim.firstFrame || 0);
      spin.current.frame = f;
      applySpin();
      if (!page) return;
      const win = FLIPS.find(([a, b]) => f > a && f < b);
      if (!win) {
        page.setAttribute("opacity", "0");
        return;
      }
      const t = easeInOut((f - win[0]) / (win[1] - win[0]));
      page.setAttribute("d", pagePath(t));
      const wantTop = t < 0.5;
      if (wantTop !== pageOnTop && nearPage?.parentNode) {
        if (wantTop) nearPage.parentNode.appendChild(page);
        else nearPage.parentNode.insertBefore(page, nearPage);
        pageOnTop = wantTop;
      }
      // Back of the page reads slightly warmer while it stands up
      const shade = 1 - Math.sin(t * Math.PI) * 0.1;
      const c = Math.round(255 * shade);
      page.setAttribute("fill", `rgb(${c},${Math.round(c * 0.985)},${Math.round(c * 0.96)})`);
      page.setAttribute("opacity", "1");
    };

    const onComplete = () => {
      play.current.waiting = true;
      play.current.remaining = rand(READING_PAUSE_MIN, READING_PAUSE_MAX);
      anim?.goToAndStop(READ_START, true);
    };

    const onVisibilityChange = () => {
      if (document.hidden || !play.current.visible) suspend();
      else resume();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    fetch(SRC)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !host.current) return;
        prepareReadingClip(data);

        anim = lottie.loadAnimation({
          container: host.current,
          renderer: "svg",
          loop: false,
          autoplay: false,
          animationData: data,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: false },
        });
        animRef.current = anim;
        anim.addEventListener("DOMLoaded", onLoaded);
        anim.addEventListener("enterFrame", onFrame);
        anim.addEventListener("complete", onComplete);
        // Inline animationData can finish building the DOM inside loadAnimation(), before the listener exists
        if (anim.isLoaded) onLoaded();
      })
      .catch((error) => console.error("Hero illustration failed to load", error));

    return () => {
      cancelled = true;
      cancelAnimationFrame(globeRaf);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (anim) {
        anim.removeEventListener("DOMLoaded", onLoaded);
        anim.removeEventListener("enterFrame", onFrame);
        anim.removeEventListener("complete", onComplete);
        anim.destroy();
      }
      playback.started = false;
      animRef.current = null;
      globeGroup.current = null;
    };
  }, []);

  // Only run while visible
  useEffect(() => {
    if (!wrap.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        play.current.visible = e.isIntersecting;
        if (!animRef.current) return;
        if (e.isIntersecting) resume();
        else suspend();
      },
      { threshold: 0.15 },
    );
    io.observe(wrap.current);
    return () => io.disconnect();
  }, [ready]);

  // Pointer → composition coordinates
  const toComp = (e: React.PointerEvent): Pt | null => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return null;
    return [VIEW.x + ((e.clientX - r.left) / r.width) * VIEW.w, VIEW.y + ((e.clientY - r.top) / r.height) * VIEW.h];
  };
  const overGlobe = (p: Pt | null) => !!p && Math.hypot(p[0] - GLOBE.cx, p[1] - GLOBE.cy) <= GLOBE.r * 1.1;

  const [cursor, setCursor] = useState<"default" | "grab" | "grabbing">("default");

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toComp(e);
    if (!overGlobe(p) || e.button !== 0) return;
    e.preventDefault();
    const s = spin.current;
    s.dragging = true;
    s.velocity = 0;
    s.lastX = e.clientX;
    setCursor("grabbing");

    // Track on window so the spin continues even if the pointer leaves the illustration
    const move = (ev: PointerEvent) => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const dx = ((ev.clientX - s.lastX) / r.width) * VIEW.w;
      s.offset += dx;
      s.velocity = dx;
      s.lastX = ev.clientX;
      applySpin();
    };
    const up = () => {
      s.dragging = false;
      setCursor("grab");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (spin.current.dragging) return;
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setCursor(overGlobe(toComp(e)) ? "grab" : "default");
    if (!reduced) {
      rawX.set(((e.clientX - r.left) / r.width) * 2 - 1);
      rawY.set(((e.clientY - r.top) / r.height) * 2 - 1);
    }
  };
  const onPointerLeave = () => {
    rawX.set(0);
    rawY.set(0);
    if (!spin.current.dragging) setCursor("default");
  };

  return (
    <div
      ref={wrap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ cursor, aspectRatio: `${VIEW.w} / ${VIEW.h}`, touchAction: "pan-y" }}
      className={cn("relative select-none [perspective:1200px]", className)}
      aria-label="Illustration of a person reading. Drag the globe to spin it."
      role="img"
    >
      <motion.div
        aria-hidden
        style={{ x: shadowX }}
        className="pointer-events-none absolute left-[14%] right-[14%] bottom-[2%] h-[7%] rounded-[50%] bg-black/30 blur-2xl"
      />
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn("h-full w-full transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
      >
        <div ref={host} className="h-full w-full [&_svg]:h-full [&_svg]:w-full" />
      </motion.div>
    </div>
  );
}
