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

// The clip is 180 frames: 0–30 picks the book up, 30–150 reads, 150–179 puts it down.
// We loop the reading section only, so the character never closes the book.
const CLIP_FRAMES = 179;
const READ_START = 30;
const READ_END = 150;

// Open-book page corners in the book layer's local space: [innerTop, outerTop, outerBottom, innerBottom]
type Pt = [number, number];
const NEAR_PAGE: Pt[] = [[563.2, 837.1], [620.9, 810.5], [605, 852.8], [543.1, 877.7]];
const FAR_PAGE: Pt[] = [[582.6, 816.8], [521.4, 845.9], [543.1, 872], [602.4, 846.8]];
// Projected "up off the page" direction; shorter than the page width because the book faces the viewer
const NORMAL: Pt = [-6, -36];
// Frame windows where the hand sweeps down across the book (arm keyframes at 60→90 and 120→150)
const FLIPS: Array<[number, number]> = [[60, 90], [120, 150]];

// Playback is scheduled by hand instead of looping: only the two reading beats ever play
// (never the 0–30 pick-up or 150–179 put-down), alternating in order because the book tilts
// at 90, with short reading pauses and slight tempo changes between them.
const BEATS: Array<[number, number]> = [[READ_START, 90], [90, READ_END]];
const HOVER_SPEED = 1.25;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

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
  // Playback scheduler: reading beats with short holds between them
  const play = useRef({ visible: false, started: false, beat: 0, phase: "idle" as "idle" | "playing", base: 1, hover: 1, timer: 0 });

  const applySpeed = () => animRef.current?.setSpeed(play.current.base * play.current.hover);

  const startSegment = (seg: [number, number]) => {
    const anim = animRef.current;
    if (!anim) return;
    play.current.phase = "playing";
    applySpeed();
    anim.playSegments(seg, true);
  };

  const playNextBeat = () => {
    const p = play.current;
    p.base = rand(0.85, 1.05);
    const seg = BEATS[p.beat];
    p.beat = (p.beat + 1) % BEATS.length;
    startSegment(seg);
  };

  const scheduleNext = () => {
    const p = play.current;
    window.clearTimeout(p.timer);
    if (!p.visible) return;
    // A reading pause between page turns — the book stays open and up the whole time
    const hold = Math.random() < 0.8 ? rand(300, 1400) : rand(1800, 2800);
    p.timer = window.setTimeout(playNextBeat, hold);
  };

  const resume = () => {
    const p = play.current;
    const anim = animRef.current;
    if (!anim) return;
    if (!p.started) {
      p.started = true;
      playNextBeat();
    } else if (p.phase === "playing") {
      anim.play();
    } else {
      scheduleNext();
    }
  };

  const suspend = () => {
    window.clearTimeout(play.current.timer);
    animRef.current?.pause();
  };

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
    let anim: AnimationItem | null = null;
    let cancelled = false;
    let globeRaf = 0;
    let page: SVGPathElement | null = null;
    // Near (right) page group; the turning leaf drops behind it once past vertical
    let nearPage: SVGGElement | null = null;
    let pageOnTop = true;

    const onLoaded = () => {
      if (!anim) return;
      // Park on the reading pose (frame 0 is the book lowered); beats start once we're on screen
      anim.goToAndStop(READ_START, true);

      const svg = host.current?.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("viewBox", `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`);

      // renderer.elements: [0] = people precomp, [1] = room precomp
      const people = anim.renderer?.elements?.[0];
      const room = anim.renderer?.elements?.[1];

      // Breathing: wrap the whole figure so a CSS transform can ride on top of Lottie's
      if (people?.layerElement) {
        const layer: SVGGElement = people.layerElement;
        const breath = document.createElementNS(SVG_NS, "g");
        breath.setAttribute("class", "hero-breathe");
        while (layer.firstChild) breath.appendChild(layer.firstChild);
        layer.appendChild(breath);
      }

      // Turning page: appended inside the book layer so it inherits arm + book motion
      const book = people?.elements?.find((e: any) => e.data?.nm === "book");
      if (book?.layerElement) {
        page = document.createElementNS(SVG_NS, "path");
        page.setAttribute("fill", "#FFFFFF");
        page.setAttribute("stroke", "#1A1A1A");
        page.setAttribute("stroke-width", "1.2");
        page.setAttribute("stroke-linejoin", "round");
        page.setAttribute("opacity", "0");
        book.layerElement.appendChild(page);
        // Group 6 is the white fill of the near page (shapes render first-on-top)
        const idx = book.shapesData?.findIndex((s: any) => s.nm === "Group 6") ?? -1;
        nearPage = idx >= 0 ? book.itemsData?.[idx]?.gr ?? null : null;
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

      // Globe runs on its own clock so it keeps turning while the reader pauses between flips
      const tickGlobe = () => {
        const s = spin.current;
        if (play.current.visible && !s.dragging) {
          s.velocity += (IDLE_SPIN - s.velocity) * 0.03;
          s.offset += s.velocity;
          applySpin();
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
      const win = FLIPS.find(([a, b]) => f >= a && f <= b);
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
      play.current.phase = "idle";
      scheduleNext();
    };

    // Fetch + patch the clip so beats can be chained: leg1 ends the reading section at 7° but
    // starts it at 0°, so re-time it to the arms' 60-frame cadence (0° at 30/90/150).
    fetch(SRC)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !host.current) return;
        try {
          const people = data.assets?.find((a: any) => a.id === "comp_0");
          const leg = people?.layers?.find((l: any) => l.nm === "leg1");
          const kfs: any[] = leg?.ks?.r?.k;
          if (Array.isArray(kfs) && kfs.length > 1) {
            const ease = { i: kfs[1].i, o: kfs[1].o };
            leg.ks.r.k = [
              { ...ease, t: 0, s: [7] }, { ...ease, t: 30, s: [0] }, { ...ease, t: 60, s: [7] }, { ...ease, t: 90, s: [0] },
              { ...ease, t: 120, s: [7] }, { ...ease, t: 150, s: [0] }, { t: CLIP_FRAMES, s: [7] },
            ];
          }
        } catch {}

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
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cancelAnimationFrame(globeRaf);
      window.clearTimeout(play.current.timer);
      if (anim) {
        anim.removeEventListener("DOMLoaded", onLoaded);
        anim.removeEventListener("enterFrame", onFrame);
        anim.removeEventListener("complete", onComplete);
        anim.destroy();
      }
      animRef.current = null;
      globeGroup.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    play.current.hover = 1;
    applySpeed();
    if (!spin.current.dragging) setCursor("default");
  };
  const onPointerEnter = () => {
    play.current.hover = HOVER_SPEED;
    applySpeed();
  };

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
