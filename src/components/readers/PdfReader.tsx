import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Highlight } from "@/hooks/use-reader-store";
import type { ReaderApi, RelocatedInfo, SearchHit, SelectionInfo, TocItem } from "./EpubReader";
import { HIGHLIGHT_COLORS, type ReaderTheme, type ReaderSettings } from "@/lib/reader-themes";
import { loadPdfjs, getPdfConfig } from "@/lib/pdf";

interface PdfReaderProps {
  fileUrl: string;
  theme: ReaderTheme;
  settings?: ReaderSettings;
  initialLocation?: string | null; // page number as string
  highlights?: Highlight[];
  spread?: boolean;
  fitMode?: "width" | "page";
  onReady?: (api: ReaderApi) => void;
  onToc?: (toc: TocItem[]) => void;
  onRelocated?: (info: RelocatedInfo) => void;
  onPageText?: (text: string) => void;
  onSelected?: (sel: SelectionInfo | null) => void;
  onHighlightClick?: (id: string, rect: DOMRect) => void;
  onTap?: () => void;
  /** Current zoom factor (1 = fit); the shell disables page-turn gestures while zoomed */
  onZoom?: (zoom: number) => void;
  /** Two fingers are on the page; the shell must not treat the movement as a page turn */
  onPinch?: (active: boolean) => void;
}

export const PDF_ZOOM_MIN = 1;
export const PDF_ZOOM_MAX = 4;
const clampZoom = (z: number) => Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, z));

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PageAnnotation {
  id: string;
  rect: [number, number, number, number]; // [left, top, width, height] in CSS pixels
  url?: string;
  dest?: any;
}

interface PageHighlightOverlay {
  id: string;
  color: string;
  rects: Array<{ left: number; top: number; width: number; height: number }>;
}

export const PdfReader = ({
  fileUrl,
  theme,
  settings,
  initialLocation,
  highlights = [],
  spread = false,
  fitMode = "width",
  onReady,
  onToc,
  onRelocated,
  onPageText,
  onSelected,
  onHighlightClick,
  onTap,
  onZoom,
  onPinch,
}: PdfReaderProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const primarySheetRef = useRef<HTMLDivElement | null>(null);
  const secondarySheetRef = useRef<HTMLDivElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const canvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const textLayer2Ref = useRef<HTMLDivElement | null>(null);

  const docRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const renderTask2Ref = useRef<any>(null);
  const outlineRef = useRef<Array<{ title: string; pageNumber: number }>>([]);
  const pageRef = useRef(Math.max(1, parseInt(initialLocation ?? "1", 10) || 1));
  const initialAppliedRef = useRef(initialLocation ?? null);

  const [page, setPage] = useState(pageRef.current);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);

  const [annotations, setAnnotations] = useState<PageAnnotation[]>([]);
  const [annotations2, setAnnotations2] = useState<PageAnnotation[]>([]);
  const [pageHighlights, setPageHighlights] = useState<PageHighlightOverlay[]>([]);
  const [pageHighlights2, setPageHighlights2] = useState<PageHighlightOverlay[]>([]);

  const [containerDims, setContainerDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const pinch = useRef<{ pointers: Map<number, { x: number; y: number }>; startDist: number; startZoom: number } | null>(null);
  const suppressTap = useRef(false);
  const lastTextRef = useRef("");

  const cb = useRef({ onReady, onToc, onRelocated, onPageText, onSelected, onHighlightClick, onTap, onZoom, onPinch });
  cb.current = { onReady, onToc, onRelocated, onPageText, onSelected, onHighlightClick, onTap, onZoom, onPinch };
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;

  // Determine if Two-Page Spread is active
  const isDual = useMemo(() => {
    if (!spread || zoom > 1) return false;
    if (numPages <= 1) return false;
    // On desktop/laptop screens (>= 900px wide container), show two pages side-by-side
    const containerW = containerDims.width || (typeof window !== "undefined" ? window.innerWidth : 0);
    return containerW >= 900;
  }, [spread, zoom, numPages, containerDims.width]);

  const isDualRef = useRef(isDual);
  isDualRef.current = isDual;

  // Page 1 & 2 are presented side-by-side from the very first open
  const leftPage = isDual ? (page % 2 === 1 ? page : page - 1) : page;
  const rightPage = isDual ? (leftPage + 1 <= numPages ? leftPage + 1 : null) : null;

  const setZoom = (z: number) => {
    const next = Math.round(clampZoom(z) * 100) / 100;
    if (next === zoomRef.current) return;
    zoomRef.current = next;
    setZoomState(next);
    cb.current.onZoom?.(next);
  };

  const emit = (p: number, n: number) => {
    const currentLeft = isDual ? (p % 2 === 1 ? p : p - 1) : p;
    const atEnd = isDual ? currentLeft + 1 >= n : p >= n;
    const atStart = isDual ? currentLeft <= 1 : p <= 1;

    const outline = outlineRef.current;
    let chapter: { label: string; href?: string } | undefined;
    let nextStart = n + 1;
    for (let i = 0; i < outline.length; i++) {
      if (outline[i].pageNumber <= currentLeft) chapter = { label: outline[i].title, href: String(outline[i].pageNumber) };
      else {
        nextStart = outline[i].pageNumber;
        break;
      }
    }
    cb.current.onRelocated?.({
      location: String(currentLeft),
      percent: n > 1 ? (currentLeft - 1) / (n - 1) : 0,
      page: currentLeft,
      totalPages: n,
      chapter,
      pagesLeftInChapter: Math.max(0, nextStart - currentLeft - 1),
      atStart,
      atEnd,
    });
  };

  const goTo = (p: number) => {
    const n = docRef.current?.numPages ?? 0;
    const clamped = Math.min(Math.max(1, p), Math.max(1, n));
    pageRef.current = clamped;
    setPage(clamped);
    if (n) emit(clamped, n);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  // Re-emit location when spread mode changes
  useEffect(() => {
    if (docRef.current?.numPages) {
      emit(pageRef.current, docRef.current.numPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDual]);

  // Helper to resolve PDF destination to 1-based page number
  const resolvePageNumber = async (doc: any, dest: any): Promise<number | null> => {
    if (!dest) return null;
    if (typeof dest === "number") return dest + 1;
    if (typeof dest === "string") {
      try {
        const explicit = await doc.getDestination(dest);
        if (explicit) return resolvePageNumber(doc, explicit);
      } catch {
        return null;
      }
    }
    if (Array.isArray(dest)) {
      const ref = dest[0];
      if (typeof ref === "number") return ref + 1;
      if (ref && typeof ref === "object") {
        try {
          const pageIdx = await doc.getPageIndex(ref);
          return pageIdx + 1;
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  // Apple Books PDF Theme Filter & Canvas Inversion
  const pdfThemeStyle = useMemo(() => {
    switch (theme.id) {
      case "focus": // Pure Dark / OLED Night
        return {
          filter: "invert(0.92) hue-rotate(180deg) contrast(1.05) brightness(0.95)",
          sheetBg: "#141416",
          selectionBg: theme.selection || "rgba(127, 179, 255, 0.35)",
          highlightBlend: "screen" as const,
          highlightOpacity: 0.65,
          spineGutter: "linear-gradient(to right, rgba(0,0,0,0.7), rgba(255,255,255,0.06) 50%, rgba(0,0,0,0.7))",
        };
      case "calm": // Warm Espresso / Dark Sepia
        return {
          filter: "invert(0.88) sepia(0.25) hue-rotate(180deg) brightness(0.92) contrast(1.05)",
          sheetBg: "#282420",
          selectionBg: theme.selection || "rgba(215, 167, 107, 0.3)",
          highlightBlend: "screen" as const,
          highlightOpacity: 0.65,
          spineGutter: "linear-gradient(to right, rgba(0,0,0,0.65), rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.65))",
        };
      case "paper": // Sepia Parchment Eye-Comfort
        return {
          filter: "sepia(0.35) contrast(0.96) brightness(0.97)",
          sheetBg: "#F6EEDC",
          selectionBg: theme.selection || "rgba(138, 90, 43, 0.25)",
          highlightBlend: "multiply" as const,
          highlightOpacity: 0.38,
          spineGutter: "linear-gradient(to right, rgba(0,0,0,0.14), rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.14))",
        };
      case "quiet": // Soft Matte Gray
        return {
          filter: "brightness(0.94) contrast(0.98)",
          sheetBg: "#EDEDED",
          selectionBg: theme.selection || "rgba(62, 92, 138, 0.25)",
          highlightBlend: "multiply" as const,
          highlightOpacity: 0.35,
          spineGutter: "linear-gradient(to right, rgba(0,0,0,0.12), rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.12))",
        };
      case "bold":
        return {
          filter: "contrast(1.04)",
          sheetBg: "#FFFFFF",
          selectionBg: theme.selection || "rgba(10, 79, 160, 0.25)",
          highlightBlend: "multiply" as const,
          highlightOpacity: 0.38,
          spineGutter: "linear-gradient(to right, rgba(0,0,0,0.12), rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.12))",
        };
      case "original":
      default:
        if (theme.dark) {
          return {
            filter: "invert(0.92) hue-rotate(180deg) contrast(1.05) brightness(0.95)",
            sheetBg: "#141416",
            selectionBg: theme.selection || "rgba(127, 179, 255, 0.35)",
            highlightBlend: "screen" as const,
            highlightOpacity: 0.65,
            spineGutter: "linear-gradient(to right, rgba(0,0,0,0.7), rgba(255,255,255,0.06) 50%, rgba(0,0,0,0.7))",
          };
        }
        return {
          filter: "none",
          sheetBg: "#FFFFFF",
          selectionBg: theme.selection || "rgba(59, 130, 246, 0.35)",
          highlightBlend: "multiply" as const,
          highlightOpacity: 0.35,
          spineGutter: "linear-gradient(to right, rgba(0,0,0,0.12), rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.12))",
        };
    }
  }, [theme.id, theme.dark, theme.selection]);

  const pdfThemeStyleRef = useRef(pdfThemeStyle);
  pdfThemeStyleRef.current = pdfThemeStyle;

  const apiRef = useRef<ReaderApi>();
  if (!apiRef.current) {
    apiRef.current = {
      async next() {
        const n = docRef.current?.numPages ?? 0;
        if (isDualRef.current) {
          const currentLeft = pageRef.current % 2 === 1 ? pageRef.current : pageRef.current - 1;
          const nextTarget = currentLeft + 2;
          if (nextTarget > n) return false;
          goTo(nextTarget);
          return true;
        } else {
          if (pageRef.current >= n) return false;
          goTo(pageRef.current + 1);
          return true;
        }
      },
      async prev() {
        if (isDualRef.current) {
          const currentLeft = pageRef.current % 2 === 1 ? pageRef.current : pageRef.current - 1;
          if (currentLeft <= 1) return false;
          goTo(Math.max(1, currentLeft - 2));
          return true;
        } else {
          if (pageRef.current <= 1) return false;
          goTo(pageRef.current - 1);
          return true;
        }
      },
      async display(target) {
        const n = docRef.current?.numPages ?? 1;
        if (typeof target === "number") goTo(Math.round(target * (n - 1)) + 1);
        else if (/^\d+$/.test(target)) goTo(parseInt(target, 10));
      },
      currentLocation() {
        const p = pageRef.current;
        const currentLeft = isDualRef.current ? (p % 2 === 1 ? p : p - 1) : p;
        return String(currentLeft);
      },
      zoomTo(z) {
        setZoom(z);
      },
      clearSelection() {
        try {
          window.getSelection()?.removeAllRanges();
          cb.current.onSelected?.(null);
        } catch {
          /* ignore */
        }
      },
      async snapshot() {
        const container = containerRef.current;
        const sheet1 = primarySheetRef.current;
        if (!container || !sheet1) return null;

        const out = document.createElement("canvas");
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        out.width = Math.round(container.clientWidth * dpr);
        out.height = Math.round(container.clientHeight * dpr);
        const ctx = out.getContext("2d");
        if (!ctx) return null;

        const currentTheme = themeRef.current;
        const currentStyle = pdfThemeStyleRef.current;

        ctx.fillStyle = currentTheme.bg;
        ctx.fillRect(0, 0, out.width, out.height);

        const cRect = container.getBoundingClientRect();

        const drawSheet = (sheetEl: HTMLElement) => {
          const canvasEl = sheetEl.querySelector("canvas");
          if (!canvasEl) return;
          const sRect = sheetEl.getBoundingClientRect();
          const dx = (sRect.left - cRect.left) * dpr;
          const dy = (sRect.top - cRect.top) * dpr;
          const dw = sRect.width * dpr;
          const dh = sRect.height * dpr;

          // 1. Sheet paper backdrop with shadow matching theme paper color
          ctx.save();
          ctx.shadowColor = currentTheme.dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.18)";
          ctx.shadowBlur = 12 * dpr;
          ctx.shadowOffsetY = 4 * dpr;
          ctx.fillStyle = currentStyle.sheetBg;
          ctx.fillRect(dx, dy, dw, dh);
          ctx.restore();

          // 2. Draw PDF canvas with Dark Mode / Eye-Comfort filter applied
          ctx.save();
          if (currentStyle.filter && currentStyle.filter !== "none") {
            ctx.filter = currentStyle.filter;
          }
          ctx.drawImage(canvasEl, dx, dy, dw, dh);
          ctx.restore();

          // 3. Draw active highlight overlays on this sheet
          const hlEls = sheetEl.querySelectorAll<HTMLElement>(".ritual-pdf-highlight");
          hlEls.forEach((hlEl) => {
            const hr = hlEl.getBoundingClientRect();
            const hx = (hr.left - cRect.left) * dpr;
            const hy = (hr.top - cRect.top) * dpr;
            const hw = hr.width * dpr;
            const hh = hr.height * dpr;
            ctx.save();
            ctx.globalCompositeOperation = (currentStyle.highlightBlend as GlobalCompositeOperation) || "source-over";
            ctx.globalAlpha = currentStyle.highlightOpacity;
            ctx.fillStyle = hlEl.style.backgroundColor || "#facc15";
            ctx.fillRect(hx, hy, hw, hh);
            ctx.restore();
          });
        };

        drawSheet(sheet1);
        if (isDualRef.current && secondarySheetRef.current) {
          drawSheet(secondarySheetRef.current);

          // Draw center spine gutter shadow between sheets in spread mode
          const s1 = sheet1.getBoundingClientRect();
          const s2 = secondarySheetRef.current.getBoundingClientRect();
          const spineX = (s1.right - cRect.left) * dpr;
          const spineW = Math.max(2 * dpr, (s2.left - s1.right) * dpr);
          const spineY = (Math.min(s1.top, s2.top) - cRect.top) * dpr;
          const spineH = Math.min(s1.height, s2.height) * dpr;
          ctx.save();
          ctx.fillStyle = currentTheme.dark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.12)";
          ctx.fillRect(spineX, spineY, spineW, spineH);
          ctx.restore();
        }

        // Fallback for environments without 2D ctx.filter support
        if (currentStyle.filter && currentStyle.filter !== "none" && ctx.filter !== currentStyle.filter) {
          out.style.filter = currentStyle.filter;
        }

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
              hits.push({
                cfi: String(p),
                excerpt: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
                href: "",
                chapter: chapter ?? `Page ${p}`,
              });
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

  // Load PDF Document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = await loadPdfjs();
      setLoading(true);
      setError(null);
      try {
        const pdfConfig = getPdfConfig();
        let source: any = {
          url: fileUrl,
          withCredentials: false,
          ...pdfConfig,
        };

        // If blob: or data:, fetch into Uint8Array for bulletproof worker loading
        if (fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")) {
          try {
            const res = await fetch(fileUrl);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              source = {
                data: new Uint8Array(buf),
                ...pdfConfig,
              };
            }
          } catch {
            /* fall back to url source */
          }
        }

        const doc = await pdfjsLib.getDocument(source).promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);

        // Deep outline extraction
        try {
          const rawOutline = await doc.getOutline();
          const items: Array<{ title: string; pageNumber: number }> = [];
          const walk = async (nodes: any[]) => {
            for (const item of nodes) {
              try {
                const pageNum = await resolvePageNumber(doc, item.dest);
                if (pageNum) items.push({ title: item.title || "Untitled", pageNumber: pageNum });
              } catch {
                /* skip */
              }
              if (item.items && item.items.length > 0) await walk(item.items);
            }
          };
          if (rawOutline) await walk(rawOutline);
          items.sort((a, b) => a.pageNumber - b.pageNumber);
          outlineRef.current = items;
          cb.current.onToc?.(items.map((i) => ({ label: i.title, href: String(i.pageNumber) })));
        } catch {
          /* no outline */
        }

        goTo(pageRef.current);
        cb.current.onReady?.(apiRef.current!);
      } catch (e: any) {
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
        renderTask2Ref.current?.cancel();
      } catch {
        /* ignore */
      }
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    if (!initialLocation || initialLocation === initialAppliedRef.current || !docRef.current) return;
    initialAppliedRef.current = initialLocation;
    goTo(parseInt(initialLocation, 10) || 1);
  }, [initialLocation]);

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDims({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Text Selection detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onSelectionChange = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        return;
      }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;
      const text = sel.toString().trim();
      if (!text) return;
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      cb.current.onSelected?.({
        cfiRange: `pdf:p${pageRef.current}:${encodeURIComponent(text.slice(0, 60))}`,
        text: sel.toString(),
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
    };

    const onPointerUp = () => {
      window.setTimeout(onSelectionChange, 25);
    };

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", onSelectionChange);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", onSelectionChange);
    };
  }, []);

  // Render Page function
  const renderSinglePage = useCallback(
    async (
      pageNum: number,
      canvas: HTMLCanvasElement | null,
      textLayerContainer: HTMLDivElement | null,
      sheetContainer: HTMLDivElement | null,
      isRightSide: boolean,
    ) => {
      const doc = docRef.current;
      const container = containerRef.current;
      if (!doc || !canvas || !textLayerContainer || !container || !sheetContainer) return;

      try {
        const p = await doc.getPage(pageNum);
        const baseVp = p.getViewport({ scale: 1 });

        // Sizing: Fit to Width expands to 100% screen width; Fit to Page fits screen height & width
        const isFitWidth = fitMode === "width";
        const padX = isFitWidth ? 0 : (isDual ? 20 : 28);
        const padY = isFitWidth ? 0 : 28;
        const availW = Math.max(100, isDual ? Math.floor((container.clientWidth - (isFitWidth ? 2 : padX * 2 + 4)) / 2) : container.clientWidth - padX * 2);
        const availH = Math.max(100, container.clientHeight - padY);

        const widthScale = availW / baseVp.width;
        const heightScale = availH / baseVp.height;
        const fitScale = isFitWidth ? widthScale : Math.min(widthScale, heightScale);
        const scale = fitScale * zoom;
        const dpr = Math.min(2.5, window.devicePixelRatio || 1);

        const renderVp = p.getViewport({ scale: scale * dpr });
        const cssVp = p.getViewport({ scale });

        // Canvas sizing
        const style = pdfThemeStyleRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.round(renderVp.width);
        canvas.height = Math.round(renderVp.height);
        canvas.style.width = `${Math.round(cssVp.width)}px`;
        canvas.style.height = `${Math.round(cssVp.height)}px`;
        canvas.style.filter = style.filter;

        // Sheet sizing
        sheetContainer.style.width = `${Math.round(cssVp.width)}px`;
        sheetContainer.style.height = `${Math.round(cssVp.height)}px`;
        sheetContainer.style.backgroundColor = style.sheetBg;

        // Text layer sizing & CSS variables
        textLayerContainer.innerHTML = "";
        textLayerContainer.style.width = `${Math.round(cssVp.width)}px`;
        textLayerContainer.style.height = `${Math.round(cssVp.height)}px`;
        textLayerContainer.style.setProperty("--total-scale-factor", String(scale));
        textLayerContainer.style.setProperty("--scale-round-x", "1px");
        textLayerContainer.style.setProperty("--scale-round-y", "1px");

        // Cancel previous render task
        if (isRightSide) {
          try {
            renderTask2Ref.current?.cancel();
          } catch {
            /* ignore */
          }
          renderTask2Ref.current = p.render({ canvasContext: ctx, viewport: renderVp });
          await renderTask2Ref.current.promise;
        } else {
          try {
            renderTaskRef.current?.cancel();
          } catch {
            /* ignore */
          }
          renderTaskRef.current = p.render({ canvasContext: ctx, viewport: renderVp });
          await renderTaskRef.current.promise;
        }

        // Render PDF.js TextLayer for live text selection
        const pdfjsLib = await loadPdfjs();
        const tc = await p.getTextContent();
        const fullText = tc.items.map((it: any) => it.str).join(" ");
        if (!isRightSide) {
          lastTextRef.current = fullText;
          cb.current.onPageText?.(fullText);
        } else {
          lastTextRef.current = (lastTextRef.current ? lastTextRef.current + "\n" : "") + fullText;
          cb.current.onPageText?.(lastTextRef.current);
        }

        try {
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: tc,
            container: textLayerContainer,
            viewport: cssVp,
          });
          await textLayer.render();
        } catch (tlErr) {
          console.warn("Text layer render error:", tlErr);
        }

        // Extract Link Annotations
        try {
          const rawAnns = await p.getAnnotations();
          const linkList: PageAnnotation[] = [];
          for (const ann of rawAnns || []) {
            if (ann.subtype === "Link" && ann.rect) {
              const vr = cssVp.convertToViewportRectangle(ann.rect);
              const x1 = Math.min(vr[0], vr[2]);
              const y1 = Math.min(vr[1], vr[3]);
              const w = Math.abs(vr[0] - vr[2]);
              const h = Math.abs(vr[1] - vr[3]);
              linkList.push({
                id: ann.id || `${pageNum}-${x1}-${y1}`,
                rect: [x1, y1, w, h],
                url: ann.url,
                dest: ann.dest,
              });
            }
          }
          if (isRightSide) setAnnotations2(linkList);
          else setAnnotations(linkList);
        } catch {
          if (isRightSide) setAnnotations2([]);
          else setAnnotations([]);
        }

        // Overlay Highlights
        const pageHls: PageHighlightOverlay[] = [];
        const currentHls = highlightsRef.current;
        for (const hl of currentHls) {
          const targetStr = hl.text?.trim().toLowerCase();
          if (!targetStr) continue;
          const isThisPage =
            hl.cfi_range?.startsWith(`pdf:p${pageNum}:`) ||
            hl.cfi_range === String(pageNum) ||
            fullText.toLowerCase().includes(targetStr);

          if (isThisPage) {
            const spans = Array.from(textLayerContainer.querySelectorAll("span"));
            const matchedRects: Array<{ left: number; top: number; width: number; height: number }> = [];

            for (const sp of spans) {
              const spText = (sp.textContent || "").trim().toLowerCase();
              if (spText && (targetStr.includes(spText) || spText.includes(targetStr))) {
                matchedRects.push({
                  left: sp.offsetLeft,
                  top: sp.offsetTop,
                  width: sp.offsetWidth,
                  height: sp.offsetHeight,
                });
              }
            }

            if (matchedRects.length > 0) {
              const cInfo = HIGHLIGHT_COLORS[hl.color] || HIGHLIGHT_COLORS.yellow;
              pageHls.push({
                id: hl.id,
                color: cInfo.fill,
                rects: matchedRects,
              });
            }
          }
        }
        if (isRightSide) setPageHighlights2(pageHls);
        else setPageHighlights(pageHls);
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") console.error("PDF page render error:", e);
      }
    },
    [isDual, zoom, fitMode]
  );

  // Trigger page render when page, spread, zoom, fitMode, or container size changes
  useEffect(() => {
    if (loading || error) return;
    renderSinglePage(leftPage, canvasRef.current, textLayerRef.current, primarySheetRef.current, false);

    if (isDual && rightPage) {
      renderSinglePage(rightPage, canvas2Ref.current, textLayer2Ref.current, secondarySheetRef.current, true);
    } else {
      setAnnotations2([]);
      setPageHighlights2([]);
    }
  }, [leftPage, rightPage, isDual, zoom, fitMode, containerDims, loading, error, renderSinglePage, highlights]);

  // A page change resets zoom to fit-to-screen
  useEffect(() => {
    setZoom(1);
  }, [leftPage]);

  // Handle Touch Pinch Zoom
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const s = pinch.current ?? { pointers: new Map(), startDist: 0, startZoom: zoomRef.current };
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = s;
    if (s.pointers.size === 2) {
      const [a, b] = Array.from(s.pointers.values());
      s.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      s.startZoom = zoomRef.current;
      cb.current.onPinch?.(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = pinch.current;
    if (!s || !s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size !== 2 || !s.startDist) return;
    const [a, b] = Array.from(s.pointers.values());
    setZoom(s.startZoom * (Math.hypot(a.x - b.x, a.y - b.y) / s.startDist));
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const s = pinch.current;
    if (!s) return;
    const wasPinch = s.pointers.size === 2;
    s.pointers.delete(e.pointerId);
    if (s.pointers.size < 2) {
      s.startDist = 0;
      if (s.pointers.size === 0) pinch.current = null;
      if (wasPinch) {
        suppressTap.current = true;
        cb.current.onPinch?.(false);
      }
    }
  };

  // Apple Books Tap Zones:
  // Left 20% = Prev Page | Right 20% = Next Page | Center 60% = Toggle Controls
  const handleContainerClick = (e: React.MouseEvent) => {
    if (suppressTap.current) {
      suppressTap.current = false;
      return;
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest(".ritual-pdf-link") || target.closest(".ritual-pdf-highlight")) {
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      cb.current.onTap?.();
      return;
    }

    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;

    if (ratio < 0.2) {
      // Left edge: previous page
      apiRef.current?.prev();
    } else if (ratio > 0.8) {
      // Right edge: next page
      apiRef.current?.next();
    } else {
      // Center zone: toggle reading controls
      cb.current.onTap?.();
    }
  };

  const handleLinkClick = async (ann: PageAnnotation, ev: React.MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    if (ann.url) {
      window.open(ann.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (ann.dest && docRef.current) {
      const targetP = await resolvePageNumber(docRef.current, ann.dest);
      if (targetP) goTo(targetP);
    }
  };

  const zoomed = zoom > 1;
  const isFitWidth = fitMode === "width";

  // Paper sheet drop shadow matching luxury Apple Books paper aesthetic
  const paperShadow = theme.dark
    ? "0 22px 55px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08)"
    : "0 16px 44px -10px rgba(0, 0, 0, 0.16), 0 2px 10px -2px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.06)";

  return (
    <div
      ref={containerRef}
      className={
        zoomed
          ? "h-full w-full overflow-auto overscroll-contain select-none"
          : isFitWidth
          ? "h-full w-full overflow-y-auto overflow-x-hidden select-none p-0"
          : "flex h-full w-full items-center justify-center overflow-hidden select-none p-2 sm:p-3"
      }
      style={{
        background: theme.bg,
        touchAction: zoomed ? "pan-x pan-y" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={handleContainerClick}
    >
      <style>{`
        .ritual-pdf-sheet {
          position: relative;
          background-color: ${pdfThemeStyle.sheetBg};
          border-radius: 3px;
          user-select: text;
          -webkit-user-select: text;
          box-sizing: content-box;
          transition: background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
        }
        .ritual-pdf-sheet canvas {
          display: block;
          filter: ${pdfThemeStyle.filter};
          transition: filter 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ritual-pdf-sheet .textLayer {
          position: absolute;
          inset: 0;
          overflow: clip;
          opacity: 1;
          line-height: 1;
          -webkit-text-size-adjust: none;
          text-size-adjust: none;
          transform-origin: 0 0;
          z-index: 2;
          user-select: text;
          -webkit-user-select: text;
          pointer-events: auto;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .ritual-pdf-sheet .textLayer :is(span, br) {
          color: transparent !important;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
        }
        .ritual-pdf-sheet .textLayer ::selection {
          background: ${pdfThemeStyle.selectionBg};
          border-radius: 2px;
        }
        .ritual-pdf-sheet .textLayer span[role="img"] {
          user-select: none;
          cursor: default;
        }
        .ritual-pdf-link {
          position: absolute;
          background: transparent;
          cursor: pointer;
          z-index: 4;
          transition: background-color 0.15s ease;
          border-radius: 2px;
        }
        .ritual-pdf-link:hover {
          background-color: ${theme.dark ? "rgba(127, 179, 255, 0.22)" : "rgba(59, 130, 246, 0.14)"};
        }
        .ritual-pdf-highlight {
          position: absolute;
          pointer-events: auto;
          cursor: pointer;
          z-index: 3;
          border-radius: 2px;
          mix-blend-mode: ${pdfThemeStyle.highlightBlend};
          opacity: ${pdfThemeStyle.highlightOpacity};
          transition: opacity 0.15s ease, filter 0.25s ease;
        }
        .ritual-pdf-highlight:hover {
          opacity: 0.9 !important;
        }
      `}</style>

      {error ? (
        <div className="px-6 py-4 rounded-xl text-center text-sm max-w-md shadow-md border" style={{ color: theme.fg, background: theme.chrome }}>
          <p className="font-semibold mb-1">Unable to Open Document</p>
          <p className="opacity-75 text-xs">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center gap-3 text-sm animate-pulse" style={{ color: theme.muted }}>
          <div className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span>Opening PDF document…</span>
        </div>
      ) : null}

      <div className={`min-h-full w-full flex items-center justify-center gap-0 ${loading || error ? "hidden" : ""}`}>
        {/* Primary Page Sheet (Single Page or Left Page of Spread) */}
        <div
          ref={primarySheetRef}
          className="ritual-pdf-sheet shrink-0"
          style={{
            backgroundColor: pdfThemeStyle.sheetBg,
            boxShadow: isFitWidth ? "none" : paperShadow,
            borderTopRightRadius: isDual && rightPage ? 0 : (isFitWidth ? 0 : 3),
            borderBottomRightRadius: isDual && rightPage ? 0 : (isFitWidth ? 0 : 3),
            borderTopLeftRadius: isFitWidth ? 0 : 3,
            borderBottomLeftRadius: isFitWidth ? 0 : 3,
          }}
        >
          <canvas ref={canvasRef} className="block" style={{ filter: pdfThemeStyle.filter }} />
          <div ref={textLayerRef} className="textLayer" />

          {/* Link Annotations */}
          {annotations.map((ann) => (
            <a
              key={ann.id}
              href={ann.url || "#"}
              className="ritual-pdf-link"
              style={{
                left: `${ann.rect[0]}px`,
                top: `${ann.rect[1]}px`,
                width: `${ann.rect[2]}px`,
                height: `${ann.rect[3]}px`,
              }}
              onClick={(ev) => handleLinkClick(ann, ev)}
              title={ann.url || "Jump to destination"}
            />
          ))}

          {/* Highlight overlays */}
          {pageHighlights.map((hl) =>
            hl.rects.map((r, i) => (
              <div
                key={`${hl.id}-${i}`}
                className="ritual-pdf-highlight"
                style={{
                  left: `${r.left}px`,
                  top: `${r.top}px`,
                  width: `${r.width}px`,
                  height: `${r.height}px`,
                  backgroundColor: hl.color,
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  cb.current.onHighlightClick?.(hl.id, (ev.currentTarget as HTMLElement).getBoundingClientRect());
                }}
              />
            ))
          )}
        </div>

        {/* Center Spine Gutter Shadow for Two-Page Spread */}
        {isDual && rightPage && (
          <div
            className="w-[2px] self-stretch z-10 pointer-events-none"
            style={{
              background: pdfThemeStyle.spineGutter,
            }}
          />
        )}

        {/* Secondary Page Sheet (Right Page of Spread) */}
        {isDual && rightPage && (
          <div
            ref={secondarySheetRef}
            className="ritual-pdf-sheet shrink-0"
            style={{
              backgroundColor: pdfThemeStyle.sheetBg,
              boxShadow: isFitWidth ? "none" : paperShadow,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderTopRightRadius: isFitWidth ? 0 : 3,
              borderBottomRightRadius: isFitWidth ? 0 : 3,
            }}
          >
            <canvas ref={canvas2Ref} className="block" style={{ filter: pdfThemeStyle.filter }} />
            <div ref={textLayer2Ref} className="textLayer" />

            {/* Link Annotations */}
            {annotations2.map((ann) => (
              <a
                key={ann.id}
                href={ann.url || "#"}
                className="ritual-pdf-link"
                style={{
                  left: `${ann.rect[0]}px`,
                  top: `${ann.rect[1]}px`,
                  width: `${ann.rect[2]}px`,
                  height: `${ann.rect[3]}px`,
                }}
                onClick={(ev) => handleLinkClick(ann, ev)}
                title={ann.url || "Jump to destination"}
              />
            ))}

            {/* Highlight overlays */}
            {pageHighlights2.map((hl) =>
              hl.rects.map((r, i) => (
                <div
                  key={`${hl.id}-${i}`}
                  className="ritual-pdf-highlight"
                  style={{
                    left: `${r.left}px`,
                    top: `${r.top}px`,
                    width: `${r.width}px`,
                    height: `${r.height}px`,
                    backgroundColor: hl.color,
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    cb.current.onHighlightClick?.(hl.id, (ev.currentTarget as HTMLElement).getBoundingClientRect());
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
