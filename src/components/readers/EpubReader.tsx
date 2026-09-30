import { useEffect, useRef, useState } from "react";
import type { Highlight } from "@/hooks/use-reader-store";
import { fontFaceCss, HIGHLIGHT_COLORS, MEASURE_EM, SPREAD_MIN_WIDTH, themeToEpubRules, type ReaderSettings, type ReaderTheme } from "@/lib/reader-themes";

/** A still image of the current page for the page-turn sheet: a canvas, or a detached DOM
    clone that looks identical once attached. `rrReady` (optional) resolves when it has painted. */
export type PageFace = (HTMLCanvasElement | HTMLElement) & { rrReady?: () => Promise<void> };

export type GesturePhase = "down" | "move" | "up" | "cancel";
export interface GesturePoint {
  id: number;
  x: number;
  y: number;
  pointerType: string;
}

/* Shared contract every format reader exposes to the shell / PageTurner. */
export interface ReaderApi {
  next(): Promise<boolean>;
  prev(): Promise<boolean>;
  display(target: string | number): Promise<void>;
  snapshot(): Promise<PageFace | null>;
  currentLocation(): string | null;
  search?(query: string): Promise<SearchHit[]>;
  clearSelection?(): void;
  visibleText?(): string;
}

export interface TocItem {
  label: string;
  href?: string;
  cfi?: string;
  subitems?: TocItem[];
}

export interface RelocatedInfo {
  location: string; // cfi (epub) | page number as string (others)
  percent: number; // 0..1 through the whole book
  page: number; // 1-based, whole-book
  totalPages: number;
  chapter?: { label: string; href?: string };
  pagesLeftInChapter: number;
  atStart: boolean;
  atEnd: boolean;
}

export interface SelectionInfo {
  cfiRange: string;
  text: string;
  rect: { left: number; top: number; width: number; height: number };
}

export interface SearchHit {
  cfi: string;
  excerpt: string;
  href: string;
  chapter?: string;
}

interface EpubReaderProps {
  fileUrl: string;
  settings: ReaderSettings;
  theme: ReaderTheme;
  initialLocation?: string | null;
  highlights: Highlight[];
  onReady?: (api: ReaderApi) => void;
  onToc?: (toc: TocItem[]) => void;
  onRelocated?: (info: RelocatedInfo) => void;
  onSelected?: (sel: SelectionInfo | null) => void;
  onHighlightClick?: (id: string, rect: DOMRect) => void;
  onTap?: () => void;
  /** Pointer events from inside the iframe, in top-window client coordinates */
  onGesture?: (phase: GesturePhase, p: GesturePoint) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onError?: (message: string) => void;
  /** Stable id used to cache the generated page index (e.g. the book id) */
  locationsKey?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const stripHash = (href = "") => href.split("#")[0];
const basename = (href = "") => stripHash(href).split("/").pop() ?? "";

function flattenToc(items: any[] = []): TocItem[] {
  return items.map((t) => ({ label: (t.label ?? "").trim(), href: t.href, cfi: t.cfi, subitems: t.subitems?.length ? flattenToc(t.subitems) : undefined }));
}
function findChapter(toc: TocItem[], href: string): TocItem | undefined {
  const target = stripHash(href);
  const base = basename(href);
  let hit: TocItem | undefined;
  const walk = (list: TocItem[]) => {
    for (const t of list) {
      if (t.href && (stripHash(t.href) === target || basename(t.href) === base)) hit = hit ?? t;
      if (t.subitems) walk(t.subitems);
    }
  };
  walk(toc);
  return hit;
}

/* Rules object → CSS string for a single <style> we own inside the iframe. */
function rulesToCss(rules: Record<string, Record<string, string>>, fontSize: number) {
  const body = Object.entries(rules)
    .map(([sel, decl]) => `${sel}{${Object.entries(decl).map(([k, v]) => `${k}:${v}`).join(";")}}`)
    .join("\n");
  return `html{font-size:${fontSize}px !important}\n${body}`;
}

export const EpubReader = ({
  fileUrl,
  settings,
  theme,
  initialLocation,
  highlights,
  onReady,
  onToc,
  onRelocated,
  onSelected,
  onHighlightClick,
  onTap,
  onGesture,
  onKeyDown,
  onError,
  locationsKey,
}: EpubReaderProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const tocRef = useRef<TocItem[]>([]);
  const lastLocRef = useRef<any>(null);
  const lastAppliedInitialRef = useRef<string | null>(null);
  const cssRef = useRef("");
  const settingsRef = useRef(settings);
  const themeRef = useRef(theme);
  const highlightsRef = useRef(highlights);
  const renderedHl = useRef(new Map<string, { cfiRange: string; type: "highlight" | "underline"; color: string }>());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Latest callbacks without re-creating the rendition
  const cb = useRef({ onReady, onToc, onRelocated, onSelected, onHighlightClick, onTap, onGesture, onKeyDown, onError });
  cb.current = { onReady, onToc, onRelocated, onSelected, onHighlightClick, onTap, onGesture, onKeyDown, onError };

  settingsRef.current = settings;
  themeRef.current = theme;
  highlightsRef.current = highlights;
  cssRef.current = `${fontFaceCss()}\n${rulesToCss(themeToEpubRules(theme, settings), settings.fontSize)}`;

  const flow = settings.pageTurn === "scroll" ? "scrolled" : "paginated";

  /* ---------- relocation → shell ---------- */
  const emitRelocated = (loc: any) => {
    const book = bookRef.current;
    if (!book || !loc?.start) return;
    const cfi: string = loc.start.cfi;
    const total = book.locations?.length?.() || 0;
    let percent = 0;
    let page = 1;
    if (total > 0) {
      percent = Number(book.locations.percentageFromCfi(cfi)) || 0;
      page = Math.max(1, (book.locations.locationFromCfi(cfi) || 0) + 1);
    } else {
      const spineLen = book.spine?.length || 1;
      const inSection = loc.start.displayed?.total ? (loc.start.displayed.page - 1) / loc.start.displayed.total : 0;
      percent = Math.min(1, (loc.start.index + inSection) / spineLen);
    }
    const chapter = findChapter(tocRef.current, loc.start.href);
    const end = loc.end?.displayed;
    cb.current.onRelocated?.({
      location: cfi,
      percent,
      page,
      totalPages: total,
      chapter: chapter ? { label: chapter.label, href: chapter.href } : undefined,
      pagesLeftInChapter: end ? Math.max(0, end.total - end.page) : 0,
      atStart: !!loc.atStart,
      atEnd: !!loc.atEnd,
    });
  };

  /* ---------- highlights ---------- */
  const hlStyles = (color: string) => {
    const c = HIGHLIGHT_COLORS[color] ?? HIGHLIGHT_COLORS.yellow;
    if (color === "underline") return { stroke: c.fill, "stroke-width": "2px", "stroke-opacity": "0.9" };
    return { fill: c.fill, "fill-opacity": themeRef.current.dark ? "0.45" : "0.4", "mix-blend-mode": themeRef.current.dark ? "screen" : "multiply" };
  };
  const addHl = (h: Highlight) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const type = h.color === "underline" ? "underline" : "highlight";
    const handler = (e: MouseEvent) => {
      const el = e.target as Element | null;
      cb.current.onHighlightClick?.(h.id, el?.getBoundingClientRect?.() ?? new DOMRect());
    };
    try {
      if (type === "underline") rendition.annotations.underline(h.cfi_range, { id: h.id }, handler, "rr-ul", hlStyles(h.color));
      else rendition.annotations.highlight(h.cfi_range, { id: h.id }, handler, "rr-hl", hlStyles(h.color));
      renderedHl.current.set(h.id, { cfiRange: h.cfi_range, type, color: h.color });
    } catch {
      /* CFI may not resolve in this rendition */
    }
  };
  const removeHl = (id: string) => {
    const r = renderedHl.current.get(id);
    if (!r) return;
    try {
      renditionRef.current?.annotations.remove(r.cfiRange, r.type);
    } catch {
      /* ignore */
    }
    renderedHl.current.delete(id);
  };
  const applyHighlights = (list: Highlight[]) => {
    const want = new Set(list.map((h) => h.id));
    for (const id of Array.from(renderedHl.current.keys())) if (!want.has(id)) removeHl(id);
    for (const h of list) {
      const cur = renderedHl.current.get(h.id);
      if (cur && (cur.cfiRange !== h.cfi_range || cur.color !== h.color)) removeHl(h.id);
      if (!renderedHl.current.has(h.id)) addHl(h);
    }
  };
  const reapplyHighlights = () => {
    Array.from(renderedHl.current.keys()).forEach(removeHl);
    applyHighlights(highlightsRef.current);
  };

  /* ---------- imperative API (stable object) ---------- */
  const apiRef = useRef<ReaderApi>();
  if (!apiRef.current) {
    apiRef.current = {
      async next() {
        const r = renditionRef.current;
        if (!r || lastLocRef.current?.atEnd) return false;
        await r.next();
        return true;
      },
      async prev() {
        const r = renditionRef.current;
        if (!r || lastLocRef.current?.atStart) return false;
        await r.prev();
        return true;
      },
      async display(target) {
        const r = renditionRef.current;
        const book = bookRef.current;
        if (!r || !book) return;
        if (typeof target === "number") {
          const cfi = book.locations?.cfiFromPercentage?.(Math.min(1, Math.max(0, target)));
          if (cfi) await r.display(cfi);
          return;
        }
        await r.display(target);
      },
      currentLocation() {
        return lastLocRef.current?.start?.cfi ?? null;
      },
      clearSelection() {
        renditionRef.current?.getContents().forEach((c: any) => {
          try {
            c.window.getSelection()?.removeAllRanges();
          } catch {
            /* ignore */
          }
        });
      },
      visibleText() {
        try {
          const r = renditionRef.current;
          const loc = lastLocRef.current;
          const c = r?.getContents()[0];
          if (!c || !loc) return "";
          const a = c.range(loc.start.cfi);
          const b = c.range(loc.end.cfi);
          if (!a || !b) return "";
          const range = c.document.createRange();
          range.setStart(a.startContainer, a.startOffset);
          range.setEnd(b.endContainer, b.endOffset);
          return range.toString();
        } catch {
          return "";
        }
      },
      async snapshot() {
        try {
          const r = renditionRef.current;
          const container = containerRef.current;
          const c = r?.getContents()[0];
          if (!r || !c || !container) return null;
          const frame = c.document.defaultView.frameElement as HTMLIFrameElement;
          const fr = frame.getBoundingClientRect();
          const cr = container.getBoundingClientRect();
          const bg = themeRef.current.bg;
          // A frozen copy of the section in a same-origin srcdoc iframe, positioned exactly where the live one is.
          // Scripts are dropped; blob: resources and our injected stylesheet resolve as-is.
          const wrap = document.createElement("div") as PageFace;
          wrap.style.cssText = `position:absolute;inset:0;overflow:hidden;background:${bg}`;
          const clone = document.createElement("iframe");
          clone.setAttribute("aria-hidden", "true");
          clone.tabIndex = -1;
          clone.style.cssText = `position:absolute;left:${fr.left - cr.left}px;top:${fr.top - cr.top}px;width:${fr.width}px;height:${fr.height}px;border:0;margin:0;pointer-events:none;background:${bg}`;
          const html = (c.document.documentElement as HTMLElement).outerHTML.replace(/<script[\s\S]*?<\/script>/gi, "");
          clone.srcdoc = `<!DOCTYPE html>${html}`;
          wrap.appendChild(clone);
          // srcdoc only loads once attached; caller awaits this after mounting
          wrap.rrReady = function (this: HTMLElement) {
            const f = this.querySelector("iframe");
            if (!f) return Promise.resolve();
            return new Promise<void>((res) => {
              f.addEventListener("load", () => requestAnimationFrame(() => res()), { once: true });
              window.setTimeout(res, 400);
            });
          };
          return wrap;
        } catch (e) {
          console.warn("snapshot failed", e);
          return null;
        }
      },
      async search(query) {
        const book = bookRef.current;
        if (!book || !query.trim()) return [];
        const q = query.trim();
        const hits: SearchHit[] = [];
        const items: any[] = book.spine?.spineItems ?? [];
        for (const item of items) {
          if (hits.length >= 200) break;
          try {
            await item.load(book.load.bind(book));
            const found: Array<{ cfi: string; excerpt: string }> = item.find(q) ?? [];
            const chapter = findChapter(tocRef.current, item.href)?.label;
            for (const f of found) hits.push({ cfi: f.cfi, excerpt: f.excerpt, href: item.href, chapter });
          } catch {
            /* skip section */
          } finally {
            try {
              item.unload();
            } catch {
              /* ignore */
            }
          }
        }
        return hits;
      },
    };
  }

  /* ---------- lifecycle ---------- */
  useEffect(() => {
    let cancelled = false;
    let scrollNudgeCleanup: (() => void) | null = null;
    const container = containerRef.current;
    if (!container) return;
    setStatus("loading");
    setErrorMsg(null);

    (async () => {
      const ePub = (await import("epubjs")).default;
      let resource: any = fileUrl;
      try {
        if (fileUrl.startsWith("blob:") || fileUrl.startsWith("http")) {
          const resp = await fetch(fileUrl);
          resource = await resp.arrayBuffer();
        }
      } catch {
        /* fall back to URL */
      }
      if (cancelled) return;

      const book = ePub(resource);
      bookRef.current = book;
      // Both modes use the continuous manager: it pre-renders the neighbouring chapter, so a page turn at
      // a chapter boundary is a scroll instead of a full iframe layout (~1 s on long chapters).
      const rendition = book.renderTo(container, {
        width: "100%",
        height: "100%",
        flow,
        manager: "continuous",
        spread: flow === "scrolled" ? "none" : "auto",
        minSpreadWidth: SPREAD_MIN_WIDTH,
        allowScriptedContent: false,
      });
      renditionRef.current = rendition;
      if (import.meta.env.DEV) (window as unknown as { __rrEpub?: unknown }).__rrEpub = { book, rendition };

      // Our stylesheet + gesture listeners go into every section as it loads
      rendition.hooks.content.register((contents: any) => {
        try {
          contents.addStylesheetCss(cssRef.current, "rr");
          const doc: Document = contents.document;
          doc.addEventListener("selectionchange", () => {
            const sel = contents.window.getSelection();
            if (!sel || sel.isCollapsed) cb.current.onSelected?.(null);
          });
          doc.addEventListener("click", (e) => {
            const sel = contents.window.getSelection();
            if (sel && !sel.isCollapsed) return;
            if ((e.target as HTMLElement | null)?.closest?.("a")) return;
            cb.current.onTap?.();
          });
          // Pointer events don't cross the iframe boundary; forward them so swipes anywhere can turn pages
          const forward = (phase: GesturePhase) => (e: PointerEvent) => {
            if (phase === "move" && !contents.window.getSelection()?.isCollapsed) return;
            const f = (contents.window.frameElement as HTMLElement | null)?.getBoundingClientRect();
            if (!f) return;
            cb.current.onGesture?.(phase, { id: e.pointerId, x: e.clientX + f.left, y: e.clientY + f.top, pointerType: e.pointerType });
          };
          doc.addEventListener("pointerdown", forward("down"));
          doc.addEventListener("pointermove", forward("move"));
          doc.addEventListener("pointerup", forward("up"));
          doc.addEventListener("pointercancel", forward("cancel"));
        } catch {
          /* ignore */
        }
      });

      await book.ready;
      if (cancelled) return;

      const toc = flattenToc(book.navigation?.toc ?? []);
      tocRef.current = toc;
      cb.current.onToc?.(toc);

      rendition.on("relocated", (loc: any) => {
        lastLocRef.current = loc;
        emitRelocated(loc);
      });
      rendition.on("selected", (cfiRange: string, contents: any) => {
        try {
          const sel = contents.window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
          const r = sel.getRangeAt(0).getBoundingClientRect();
          const f = (contents.document.defaultView.frameElement as HTMLElement).getBoundingClientRect();
          cb.current.onSelected?.({
            cfiRange,
            text: sel.toString(),
            rect: { left: r.left + f.left, top: r.top + f.top, width: r.width, height: r.height },
          });
        } catch {
          /* ignore */
        }
      });
      rendition.on("keydown", (e: KeyboardEvent) => cb.current.onKeyDown?.(e));
      rendition.on("displayError", () => setErrorMsg("Failed to display this section."));

      try {
        const target = lastLocRef.current?.start?.cfi ?? initialLocation ?? undefined;
        try {
          await rendition.display(target);
        } catch (e) {
          if (!target) throw e;
          // A saved location that no longer resolves (edited file, other reader) shouldn't block the book
          console.warn("EPUB: saved location unusable, opening at the start", e);
          await rendition.display();
        }
        lastAppliedInitialRef.current = initialLocation ?? null;
      } catch (e) {
        console.error("EPUB display error", e);
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("Failed to display EPUB.");
          cb.current.onError?.("Failed to display EPUB.");
        }
        return;
      }
      if (cancelled) return;
      container.style.background = themeRef.current.bg;
      setStatus("ready");
      cb.current.onReady?.(apiRef.current!);
      applyHighlights(highlightsRef.current);

      // Continuous scroll: epub.js appends the next chapter from its own scroll ticker, which
      // doesn't wake up on the first chapter. Ask it to check whenever we're near an edge.
      if (flow === "scrolled") {
        const manager = (rendition as any).manager as { container?: HTMLElement; check?: () => Promise<unknown> } | undefined;
        const scroller = manager?.container;
        if (scroller) {
          let pending = false;
          const nudge = () => {
            if (pending || cancelled) return;
            const nearEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 600;
            const nearStart = scroller.scrollTop <= 600;
            if (!nearEnd && !nearStart) return;
            pending = true;
            Promise.resolve(manager?.check?.()).catch(() => {}).finally(() => {
              pending = false;
            });
          };
          scroller.addEventListener("scroll", nudge, { passive: true });
          scrollNudgeCleanup = () => scroller.removeEventListener("scroll", nudge);
          nudge();
        }
      }

      // Whole-book locations for percent / page counts; not blocking first paint.
      // Generating them loads every chapter, so the result is cached per book.
      try {
        const cacheKey = locationsKey ? `rr:locations:${locationsKey}` : null;
        const cached = cacheKey ? localStorage.getItem(cacheKey) : null;
        if (cached) book.locations.load(cached);
        else {
          await book.locations.generate(1024);
          if (cacheKey && !cancelled) {
            try {
              localStorage.setItem(cacheKey, book.locations.save());
            } catch {
              /* storage full */
            }
          }
        }
        if (!cancelled && lastLocRef.current) emitRelocated(lastLocRef.current);
      } catch {
        /* ignore */
      }
    })().catch((e) => {
      console.error("EPUB load error", e);
      if (cancelled) return;
      setStatus("error");
      setErrorMsg("Failed to load EPUB. Try re-importing the book.");
      cb.current.onError?.("Failed to load EPUB.");
    });

    const ro = new ResizeObserver(() => {
      try {
        renditionRef.current?.resize?.(container.clientWidth, container.clientHeight);
      } catch {
        /* ignore */
      }
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      scrollNudgeCleanup?.();
      renderedHl.current.clear();
      try {
        renditionRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      try {
        bookRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      renditionRef.current = null;
      bookRef.current = null;
    };
    // Re-created only when the file or the flow changes; position carries over via lastLocRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, flow]);

  useEffect(() => {
    if (status !== "ready" || !initialLocation || initialLocation === lastAppliedInitialRef.current) return;
    if (initialLocation === lastLocRef.current?.start?.cfi) {
      lastAppliedInitialRef.current = initialLocation;
      return;
    }
    lastAppliedInitialRef.current = initialLocation;
    renditionRef.current?.display(initialLocation).catch(() => {});
  }, [initialLocation, status]);

  /* ---------- appearance ---------- */
  const layoutKey = [settings.fontId, settings.fontSize, settings.bold, settings.lineHeight, settings.letterSpacing, settings.wordSpacing, settings.justify, settings.hyphenation, settings.margins, theme.weight].join("|");

  const pushCss = () => {
    const css = cssRef.current;
    renditionRef.current?.getContents().forEach((c: any) => {
      try {
        c.addStylesheetCss(css, "rr");
      } catch {
        /* ignore */
      }
    });
  };

  useEffect(() => {
    if (status !== "ready") return;
    pushCss();
    if (containerRef.current) containerRef.current.style.background = theme.bg;
    reapplyHighlights(); // blend mode depends on light/dark paper
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.id, status]);

  useEffect(() => {
    if (status !== "ready") return;
    pushCss();
  }, [layoutKey, status]);

  useEffect(() => {
    if (status !== "ready") return;
    applyHighlights(highlights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, status]);

  // Readable measure: one column, or two facing pages plus a gutter, plus the body padding epub.js applies
  const frameMaxWidth = Math.round((MEASURE_EM * 2 + 3.2) * settings.fontSize * 1.18);

  return (
    <div className="relative h-full w-full" style={{ background: theme.bg }}>
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-sm" style={{ color: theme.fg }}>
          {errorMsg}
        </div>
      ) : status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-sm" style={{ color: theme.muted }}>
          Opening book…
        </div>
      ) : null}
      <div ref={containerRef} className="mx-auto h-full w-full" style={{ maxWidth: frameMaxWidth }} />
    </div>
  );
};
