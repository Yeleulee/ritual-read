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

// Open-book page corners in the book layer's local space: [innerTop, outerTop, outerBottom, innerBottom]
type Pt = [number, number];
const RIGHT_PAGE: Pt[] = [[563.2, 837.1], [620.9, 810.5], [605, 852.8], [543.1, 877.7]];
const LEFT_PAGE: Pt[] = [[582.6, 816.8], [521.4, 845.9], [543.1, 872], [602.4, 846.8]];
const HINGE_TOP: Pt = [572.9, 827];
const HINGE_BOTTOM: Pt = [572.8, 862.3];
const LIFT: Pt = [-9, -58];
// Frame windows where the hand rises off the page (arm keyframes at 60→90 and 120→150)
const FLIPS: Array<[number, number]> = [[60, 90], [120, 150]];

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// Quadratic curve from a to b that passes through m at t = 0.5
const arc = (a: Pt, m: Pt, b: Pt, t: number): Pt => {
  const c: Pt = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2];
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function pagePath(t: number) {
  const liftTop: Pt = [HINGE_TOP[0] + LIFT[0], HINGE_TOP[1] + LIFT[1]];
  const liftBottom: Pt = [HINGE_BOTTOM[0] + LIFT[0], HINGE_BOTTOM[1] + LIFT[1] + 6];
  const pts: Pt[] = [
    lerp(RIGHT_PAGE[0], LEFT_PAGE[0], t),
    arc(RIGHT_PAGE[1], liftTop, LEFT_PAGE[1], t),
    arc(RIGHT_PAGE[2], liftBottom, LEFT_PAGE[2], t),
    lerp(RIGHT_PAGE[3], LEFT_PAGE[3], t),
  ];
  return `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function ReaderIllustration({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();

  // Globe spin state (composition px)
  const spin = useRef({ offset: 0, velocity: 0, dragging: false, lastX: 0 });
  const globeGroup = useRef<SVGGElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);

  const applySpin = () => {
    const g = globeGroup.current;
    if (!g) return;
    const o = ((spin.current.offset % GLOBE_PERIOD) + GLOBE_PERIOD) % GLOBE_PERIOD;
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
    const anim = lottie.loadAnimation({
      container: host.current,
      renderer: "svg",
      loop: true,
      autoplay: false,
      path: SRC,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: false },
    });
    animRef.current = anim;

    let page: SVGPathElement | null = null;

    const onLoaded = () => {
      const svg = host.current?.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("viewBox", `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`);

      // renderer.elements: [0] = people precomp, [1] = room precomp
      const people = anim.renderer?.elements?.[0];
      const room = anim.renderer?.elements?.[1];

      // Turning page: appended inside the book layer so it inherits arm + book motion
      const book = people?.elements?.find((e: any) => e.data?.nm === "book");
      if (book?.layerElement) {
        page = document.createElementNS(SVG_NS, "path");
        page.setAttribute("fill", "#FFFFFF");
        page.setAttribute("stroke", "#1A1A1A");
        page.setAttribute("stroke-width", "1.6");
        page.setAttribute("stroke-linejoin", "round");
        page.setAttribute("opacity", "0");
        book.layerElement.appendChild(page);
      }

      // Globe: wrap the continents so we can add our own rotation, and tile them so it spins forever
      const continents = room?.elements?.find((e: any) => e.data?.nm === "shape");
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

      if (reduced) anim.goToAndStop(45, true);
      setReady(true);
    };

    const onFrame = () => {
      // Idle drift; a flick's momentum eases back into it instead of stopping
      const s = spin.current;
      if (!s.dragging && !reduced) {
        s.velocity += (IDLE_SPIN - s.velocity) * 0.03;
        s.offset += s.velocity;
        applySpin();
      }
      if (!page) return;
      const f = anim.currentFrame;
      const win = FLIPS.find(([a, b]) => f >= a && f <= b);
      if (!win || reduced) {
        page.setAttribute("opacity", "0");
        return;
      }
      const t = easeInOut((f - win[0]) / (win[1] - win[0]));
      page.setAttribute("d", pagePath(t));
      // Back of the page reads slightly warmer while it stands up
      const shade = 1 - Math.sin(t * Math.PI) * 0.1;
      const c = Math.round(255 * shade);
      page.setAttribute("fill", `rgb(${c},${Math.round(c * 0.985)},${Math.round(c * 0.96)})`);
      page.setAttribute("opacity", "1");
    };

    anim.addEventListener("DOMLoaded", onLoaded);
    anim.addEventListener("enterFrame", onFrame);

    return () => {
      anim.removeEventListener("DOMLoaded", onLoaded);
      anim.removeEventListener("enterFrame", onFrame);
      anim.destroy();
      animRef.current = null;
      globeGroup.current = null;
    };
  }, [reduced]);

  // Only run while visible
  useEffect(() => {
    if (!wrap.current || reduced) return;
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? animRef.current?.play() : animRef.current?.pause()),
      { threshold: 0.15 },
    );
    io.observe(wrap.current);
    return () => io.disconnect();
  }, [reduced, ready]);

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
    animRef.current?.setSpeed(1);
    if (!spin.current.dragging) setCursor("default");
  };
  const onPointerEnter = () => { if (!reduced) animRef.current?.setSpeed(1.25); };

  return (
    <div
      ref={wrap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
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
