import { useEffect, useRef, useState } from "react";

type Props = {
  width: number;
  height: number;
  frontText: string;
  nextText: string;
  fontSize: number;
  onCommit: () => void;
};

export const TextPageCurlOverlay = ({ width, height, frontText, nextText, fontSize, onCommit }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [anim, setAnim] = useState<number | null>(null);
  const frontRef = useRef<HTMLCanvasElement | null>(null);
  const nextRef = useRef<HTMLCanvasElement | null>(null);

  // Render text pages to offscreen canvases
  useEffect(() => {
    const renderTextToCanvas = (text: string) => {
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      const ctx = off.getContext('2d')!;
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#e5e5e5';
      ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system`;
      ctx.textBaseline = 'top';
      const lineHeight = Math.round(fontSize * 1.5);
      const padding = 24;
      const maxWidth = width - padding * 2;
      const words = text.split(/\s+/);
      let x = padding;
      let y = padding;
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        const m = ctx.measureText(test);
        if (m.width > maxWidth) {
          ctx.fillText(line, x, y);
          line = w;
          y += lineHeight;
          if (y > height - padding - lineHeight) break;
        } else {
          line = test;
        }
      }
      if (y <= height - padding - lineHeight) ctx.fillText(line, x, y);
      return off;
    };
    frontRef.current = renderTextToCanvas(frontText);
    nextRef.current = renderTextToCanvas(nextText);
  }, [frontText, nextText, width, height, fontSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const under = nextRef.current;
    const front = frontRef.current;
    if (!canvas || !under || !front) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const corner = { x: width, y: height };
    const maxCurl = width * 0.9;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(under, 0, 0);
      ctx.drawImage(front, 0, 0);
      if (drag) {
        const dx = drag.x - corner.x;
        const dy = drag.y - corner.y;
        const dist = Math.hypot(dx, dy);
        const clamp = Math.min(dist, maxCurl);
        const ux = dist > 0 ? dx / dist : 0;
        const uy = dist > 0 ? dy / dist : 0;
        const px = corner.x + ux * clamp;
        const py = corner.y + uy * clamp;
        const perp = { x: -uy, y: ux };
        const foldWidth = Math.min(clamp * 0.7, width * 0.5);
        const mx = px + perp.x * foldWidth;
        const my = py + perp.y * foldWidth;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(corner.x, corner.y);
        ctx.lineTo(mx, my);
        ctx.closePath();
        ctx.clip();

        ctx.save();
        ctx.globalAlpha = 0.85;
        const angle = Math.atan2(uy, ux) || 0;
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.scale(-0.9, 1);
        ctx.rotate(-angle);
        ctx.translate(-px, -py);
        ctx.filter = 'brightness(70%) saturate(90%)';
        ctx.drawImage(front, 0, 0);
        ctx.filter = 'none';
        ctx.restore();

        const grad = ctx.createLinearGradient(px, py, mx, my);
        grad.addColorStop(0, 'rgba(0,0,0,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(Math.min(px, mx), Math.min(py, my), Math.abs(mx - px) || 1, Math.abs(my - py) || 1);

        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(mx, my);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    };

    draw();

    if (anim != null) {
      const id = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(id);
    }
  }, [drag, width, height, anim]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const pt = 'touches' in e ? (e.touches[0] || (e as any).changedTouches?.[0]) : (e as React.MouseEvent);
    const x = (pt.clientX - r.left) * (canvas.width / r.width);
    const y = (pt.clientY - r.top) * (canvas.height / r.height);
    return { x, y };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getPos(e);
    if (x > width * 0.6 && y > height * 0.6) setDrag({ x, y });
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag) return;
    const { x, y } = getPos(e);
    setDrag({ x, y });
  };
  const onEnd = () => {
    if (!drag) return;
    const commit = drag.x < width * 0.35;
    setAnim(performance.now());
    const start = { ...drag };
    const end = commit ? { x: -width, y: height * 0.5 } : { x: width, y: height };
    const duration = 200;
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const step = (t0: number) => {
      const now = performance.now();
      const p = Math.min(1, (now - t0) / duration);
      const e = easeInOut(p);
      setDrag({ x: start.x + (end.x - start.x) * e, y: start.y + (end.y - start.y) * e });
      if (p < 1) requestAnimationFrame(() => step(t0));
      else {
        setAnim(null);
        setDrag(null);
        if (commit) onCommit();
      }
    };
    step(performance.now());
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 z-20"
      style={{ touchAction: 'none' }}
      onMouseDown={onStart}
      onMouseMove={onMove}
      onMouseUp={onEnd}
      onMouseLeave={onEnd}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
    />
  );
};


