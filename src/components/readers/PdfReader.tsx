import { useEffect, useRef, useState } from "react";
import type { ReaderApi, RelocatedInfo, SearchHit, TocItem } from "./EpubReader";
import type { ReaderTheme } from "@/lib/reader-themes";

interface PdfReaderProps {
  fileUrl: string;
  theme: ReaderTheme;
  initialLocation?: string | null; // page number as string
  onReady?: (api: ReaderApi) => void;
  onToc?: (toc: TocItem[]) => void;
  onRelocated?: (info: RelocatedInfo) => void;
  onPageText?: (text: string) => void;
  onTap?: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export const PdfReader = ({ fileUrl, theme, initialLocation, onReady, onToc, onRelocated, onPageText, onTap }: PdfReaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const outlineRef = useRef<Array<{ title: string; pageNumber: number }>>([]);
  const pageRef = useRef(Math.max(1, parseInt(initialLocation ?? "1", 10) || 1));
  const [page, setPage] = useState(pageRef.current);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cb = useRef({ onReady, onToc, onRelocated, onPageText, onTap });
  cb.current = { onReady, onToc, onRelocated, onPageText, onTap };
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const emit = (p: number, n: number) => {
    const outline = outlineRef.current;
    let chapter: { label: string } | undefined;
    let nextStart = n + 1;
    for (let i = 0; i < outline.length; i++) {
      if (outline[i].pageNumber <= p) chapter = { label: outline[i].title };
      else {
        nextStart = outline[i].pageNumber;
        break;
      }
    }
    cb.current.onRelocated?.({
      location: String(p),
      percent: n > 1 ? (p - 1) / (n - 1) : 0,
      page: p,
      totalPages: n,
      chapter,
      pagesLeftInChapter: Math.max(0, nextStart - p - 1),
      atStart: p <= 1,
      atEnd: p >= n,
    });
  };

  const goTo = (p: number) => {
    const n = docRef.current?.numPages ?? 0;
    const clamped = Math.min(Math.max(1, p), Math.max(1, n));
    pageRef.current = clamped;
    setPage(clamped);
    if (n) emit(clamped, n);
  };

  const apiRef = useRef<ReaderApi>();
  if (!apiRef.current) {
    apiRef.current = {
      async next() {
        const n = docRef.current?.numPages ?? 0;
        if (pageRef.current >= n) return false;
        goTo(pageRef.current + 1);
        return true;
      },
      async prev() {
        if (pageRef.current <= 1) return false;
        goTo(pageRef.current - 1);
        return true;
      },
      async display(target) {
        const n = docRef.current?.numPages ?? 1;
        if (typeof target === "number") goTo(Math.round(target * (n - 1)) + 1);
        else if (/^\d+$/.test(target)) goTo(parseInt(target, 10));
      },
      currentLocation() {
        return String(pageRef.current);
      },
      async snapshot() {
        const src = canvasRef.current;
        const container = containerRef.current;
        if (!src || !container) return null;
        const out = document.createElement("canvas");
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        out.width = Math.round(container.clientWidth * dpr);
        out.height = Math.round(container.clientHeight * dpr);
        const ctx = out.getContext("2d");
        if (!ctx) return null;
        ctx.fillStyle = themeRef.current.bg;
        ctx.fillRect(0, 0, out.width, out.height);
        const r = src.getBoundingClientRect();
        const c = container.getBoundingClientRect();
        // Match the on-screen CSS filter used for dark papers
        if (themeRef.current.dark) ctx.filter = "invert(0.92) hue-rotate(180deg)";
        ctx.drawImage(src, (r.left - c.left) * dpr, (r.top - c.top) * dpr, r.width * dpr, r.height * dpr);
        return out;
      },
      visibleText() {
        return lastTextRef.current;
      },
      async search(query) {
        const doc = docRef.current;
        const q = query.trim().toLowerCase();
        if (!doc || !q) return [];
        const hits: SearchHit[] = [];
        for (let p = 1; p <= doc.numPages && hits.length < 200; p++) {
          try {
            const tc = await (await doc.getPage(p)).getTextContent();
            const text: string = tc.items.map((it: any) => it.str).join(" ");
            const lower = text.toLowerCase();
            let idx = lower.indexOf(q);
            let guard = 0;
            while (idx !== -1 && guard++ < 20 && hits.length < 200) {
              const start = Math.max(0, idx - 60);
              const end = Math.min(text.length, idx + q.length + 60);
              const chapter = outlineRef.current.filter((o) => o.pageNumber <= p).pop()?.title;
              hits.push({ cfi: String(p), excerpt: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`, href: "", chapter: chapter ?? `Page ${p}` });
              idx = lower.indexOf(q, idx + q.length);
            }
          } catch {
            /* skip page */
          }
        }
        return hits;
      },
    };
  }
  const lastTextRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      // @ts-expect-error worker options are untyped for the CDN path
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;
      setLoading(true);
      setError(null);
      try {
        const doc = await pdfjsLib.getDocument({ url: fileUrl, withCredentials: false }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        try {
          const outline = await doc.getOutline();
          const items: Array<{ title: string; pageNumber: number }> = [];
          for (const item of outline ?? []) {
            try {
              const dest = await doc.getDestination(typeof item.dest === "string" ? item.dest : item.dest?.[0]);
              const ref = Array.isArray(dest) ? dest[0] : dest?.[0];
              const pageIndex = await doc.getPageIndex(ref);
              items.push({ title: item.title || "Untitled", pageNumber: pageIndex + 1 });
            } catch {
              /* skip */
            }
          }
          items.sort((a, b) => a.pageNumber - b.pageNumber);
          outlineRef.current = items;
          cb.current.onToc?.(items.map((i) => ({ label: i.title, href: String(i.pageNumber) })));
        } catch {
          /* no outline */
        }
        goTo(pageRef.current);
        cb.current.onReady?.(apiRef.current!);
      } catch (e) {
        console.error("PDF load error:", e);
        if (!cancelled) setError("Failed to load PDF. Try re-importing the book.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch((e) => {
      console.error("PDF init error:", e);
      setError("Failed to initialize PDF renderer.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel();
      } catch {
        /* ignore */
      }
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    const render = async () => {
      const doc = docRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!doc || !canvas || !container) return;
      try {
        const p = await doc.getPage(page);
        const base = p.getViewport({ scale: 1 });
        const scale = Math.min(container.clientWidth / base.width, container.clientHeight / base.height);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const vp = p.getViewport({ scale: scale * dpr });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = `${vp.width / dpr}px`;
        canvas.style.height = `${vp.height / dpr}px`;
        try {
          renderTaskRef.current?.cancel();
        } catch {
          /* ignore */
        }
        renderTaskRef.current = p.render({ canvasContext: ctx, viewport: vp });
        await renderTaskRef.current.promise;
        try {
          const tc = await p.getTextContent();
          const text = tc.items.map((it: any) => it.str).join(" ");
          lastTextRef.current = text;
          cb.current.onPageText?.(text);
        } catch {
          /* ignore */
        }
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") console.error("PDF render error:", e);
      }
    };
    render();
    const ro = new ResizeObserver(() => render());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [page, numPages]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: theme.bg }}
      onClick={() => cb.current.onTap?.()}
    >
      {error ? (
        <div className="px-4 text-sm" style={{ color: theme.fg }}>
          {error}
        </div>
      ) : loading ? (
        <div className="px-4 text-sm" style={{ color: theme.muted }}>
          Opening PDF…
        </div>
      ) : null}
      <canvas ref={canvasRef} className={loading || error ? "hidden" : "block"} style={{ filter: theme.dark ? "invert(0.92) hue-rotate(180deg)" : "none" }} />
    </div>
  );
};
