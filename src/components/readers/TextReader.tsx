import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toCanvas } from "html-to-image";
import type { Highlight } from "@/hooks/use-reader-store";
import { fontById, HIGHLIGHT_COLORS, type ReaderSettings, type ReaderTheme } from "@/lib/reader-themes";
import type { ReaderApi, RelocatedInfo, SearchHit, SelectionInfo } from "./EpubReader";

/* Plain-text / DOCX reader. The whole text is laid out once in CSS columns the size of the
   viewport; a "page" is one column, turned by shifting the track. Locations are `txt:<page>`,
   highlight ranges are `txt:<startOffset>-<endOffset>` over the flattened text. */

interface TextReaderProps {
  content: string;
  settings: ReaderSettings;
  theme: ReaderTheme;
  initialLocation?: string | null;
  highlights: Highlight[];
  onReady?: (api: ReaderApi) => void;
  onRelocated?: (info: RelocatedInfo) => void;
  onSelected?: (sel: SelectionInfo | null) => void;
  onHighlightClick?: (id: string, rect: DOMRect) => void;
  onTap?: () => void;
}

type Para = { start: number; text: string };

function splitParagraphs(content: string): Para[] {
  const out: Para[] = [];
  let offset = 0;
  for (const raw of content.replace(/\r\n?/g, "\n").split(/\n{2,}|\n(?=\s{2,})/)) {
    const text = raw.replace(/\s*\n\s*/g, " ").trim();
    if (text) out.push({ start: offset, text });
    offset += text.length + 1; // +1 for the paragraph break
  }
  return out;
}

const parseRange = (s: string) => {
  const m = /^txt:(\d+)-(\d+)$/.exec(s);
  return m ? { start: +m[1], end: +m[2] } : null;
};

export const TextReader = ({ content, settings, theme, initialLocation, highlights, onReady, onRelocated, onSelected, onHighlightClick, onTap }: TextReaderProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const initialTextPage = /^txt:\d+$/.test(initialLocation ?? "") ? parseInt((initialLocation ?? "").slice(4), 10) : 1;
  const pageRef = useRef(Math.max(1, initialTextPage));
  const initialAppliedRef = useRef(false);
  const [page, setPage] = useState(pageRef.current);
  const [pages, setPages] = useState(1);
  const [vpWidth, setVpWidth] = useState(0);
  const paras = useMemo(() => splitParagraphs(content), [content]);
  const flat = useMemo(() => paras.map((p) => p.text).join("\n"), [paras]);

  const cb = useRef({ onReady, onRelocated, onSelected, onHighlightClick, onTap });
  cb.current = { onReady, onRelocated, onSelected, onHighlightClick, onTap };
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const scroll = settings.pageTurn === "scroll";
  const font = fontById(settings.fontId);
  const margins = { narrow: "4%", normal: "8%", wide: "14%" }[settings.margins];

  const emit = (p: number, n: number, percentOverride?: number) => {
    const percent = percentOverride ?? (n > 1 ? (p - 1) / (n - 1) : 0);
    cb.current.onRelocated?.({
      location: scroll ? `txt:pct:${percent.toFixed(5)}` : `txt:${p}`,
      percent,
      page: p,
      totalPages: n,
      chapter: undefined,
      pagesLeftInChapter: Math.max(0, n - p),
      atStart: p <= 1,
      atEnd: p >= n,
    });
  };
  const goTo = (p: number) => {
    const n = Math.max(1, pagesRef.current);
    const clamped = Math.min(Math.max(1, p), n);
    pageRef.current = clamped;
    setPage(clamped);
    emit(clamped, n);
  };
  const pagesRef = useRef(1);
  pagesRef.current = pages;

  // Column geometry: recount pages whenever size or typography changes
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    const measure = () => {
      if (scroll) {
        track.style.columnWidth = "auto";
        track.style.columnGap = "normal";
        track.style.height = "auto";
        const n = Math.max(1, Math.ceil(track.scrollHeight / Math.max(1, vp.clientHeight)));
        setPages(n);
        pagesRef.current = n;
        return;
      }
      const w = vp.clientWidth;
      if (!w) return;
      setVpWidth(w);
      track.style.columnWidth = `${w}px`;
      track.style.columnGap = "0px";
      track.style.height = `${vp.clientHeight}px`;
      const n = Math.max(1, Math.round(track.scrollWidth / w));
      setPages(n);
      pagesRef.current = n;
      if (pageRef.current > n) goTo(n);
      else emit(pageRef.current, n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroll, settings.fontId, settings.fontSize, settings.lineHeight, settings.letterSpacing, settings.wordSpacing, settings.justify, settings.hyphenation, settings.margins, settings.bold, flat]);

  const apiRef = useRef<ReaderApi>();
  if (!apiRef.current) {
    apiRef.current = {
      async next() {
        if (scroll) {
          const vp = viewportRef.current;
          if (!vp || vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 2) return false;
          vp.scrollBy({ top: vp.clientHeight * 0.85, behavior: "smooth" });
          return true;
        }
        if (pageRef.current >= pagesRef.current) return false;
        goTo(pageRef.current + 1);
        return true;
      },
      async prev() {
        if (scroll) {
          const vp = viewportRef.current;
          if (!vp || vp.scrollTop <= 1) return false;
          vp.scrollBy({ top: -vp.clientHeight * 0.85, behavior: "smooth" });
          return true;
        }
        if (pageRef.current <= 1) return false;
        goTo(pageRef.current - 1);
        return true;
      },
      async display(target) {
        if (typeof target === "number") {
          if (scroll) {
            const vp = viewportRef.current;
            if (vp) vp.scrollTo({ top: Math.max(0, Math.min(1, target)) * Math.max(0, vp.scrollHeight - vp.clientHeight), behavior: "smooth" });
          } else goTo(Math.round(target * (pagesRef.current - 1)) + 1);
        } else if (target.startsWith("txt:pct:")) {
          const vp = viewportRef.current;
          const percent = Number(target.slice(8));
          if (vp && Number.isFinite(percent)) vp.scrollTo({ top: Math.max(0, Math.min(1, percent)) * Math.max(0, vp.scrollHeight - vp.clientHeight), behavior: "auto" });
        } else if (target.startsWith("txt:")) {
          const r = parseRange(target);
          if (r) {
            // find the page containing this offset via the rendered mark/element
            const el = trackRef.current?.querySelector<HTMLElement>(`[data-start="${r.start}"]`) ?? offsetToElement(r.start);
            if (el && viewportRef.current) {
              const x = el.getBoundingClientRect().left - trackRef.current!.getBoundingClientRect().left;
              goTo(Math.floor(x / viewportRef.current.clientWidth) + 1);
            }
          } else goTo(parseInt(target.slice(4), 10) || 1);
        }
      },
      currentLocation() {
        return `txt:${pageRef.current}`;
      },
      clearSelection() {
        document.getSelection()?.removeAllRanges();
      },
      visibleText() {
        const vp = viewportRef.current;
        const track = trackRef.current;
        if (!vp || !track) return "";
        const vr = vp.getBoundingClientRect();
        const out: string[] = [];
        track.querySelectorAll("p").forEach((p) => {
          const r = p.getBoundingClientRect();
          if (r.right > vr.left && r.left < vr.right) out.push(p.textContent ?? "");
        });
        return out.join("\n").slice(0, 4000);
      },
      async snapshot() {
        const vp = viewportRef.current;
        if (!vp) return null;
        try {
          return await toCanvas(vp, { pixelRatio: Math.min(2, window.devicePixelRatio || 1), backgroundColor: themeRef.current.bg, cacheBust: false });
        } catch {
          return null;
        }
      },
      async search(query) {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const lower = flat.toLowerCase();
        const hits: SearchHit[] = [];
        let idx = lower.indexOf(q);
        while (idx !== -1 && hits.length < 200) {
          const s = Math.max(0, idx - 60);
          const e = Math.min(flat.length, idx + q.length + 60);
          hits.push({ cfi: `txt:${idx}-${idx + q.length}`, excerpt: `${s > 0 ? "…" : ""}${flat.slice(s, e)}${e < flat.length ? "…" : ""}`, href: "" });
          idx = lower.indexOf(q, idx + q.length);
        }
        return hits;
      },
    };
  }

  const offsetToElement = (offset: number): HTMLElement | null => {
    const ps = trackRef.current?.querySelectorAll<HTMLElement>("p[data-start]");
    if (!ps) return null;
    let hit: HTMLElement | null = null;
    ps.forEach((p) => {
      if (+p.dataset.start! <= offset) hit = p;
    });
    return hit;
  };

  useEffect(() => {
    cb.current.onReady?.(apiRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialAppliedRef.current || !initialLocation || !viewportRef.current) return;
    if (scroll && initialLocation.startsWith("txt:pct:")) {
      const percent = Number(initialLocation.slice(8));
      if (Number.isFinite(percent)) viewportRef.current.scrollTop = Math.max(0, Math.min(1, percent)) * Math.max(0, viewportRef.current.scrollHeight - viewportRef.current.clientHeight);
    } else if (!scroll && /^txt:\d+$/.test(initialLocation)) goTo(parseInt(initialLocation.slice(4), 10));
    initialAppliedRef.current = true;
  }, [initialLocation, scroll, pages]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !scroll) return;
    const onScroll = () => {
      const max = Math.max(1, vp.scrollHeight - vp.clientHeight);
      const percent = Math.max(0, Math.min(1, vp.scrollTop / max));
      const p = Math.min(pagesRef.current, Math.floor(vp.scrollTop / Math.max(1, vp.clientHeight)) + 1);
      pageRef.current = p;
      setPage(p);
      emit(p, pagesRef.current, percent);
    };
    vp.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => vp.removeEventListener("scroll", onScroll);
  }, [scroll, pages]);

  // Selection → offsets over the flat text
  useEffect(() => {
    const onChange = () => {
      const sel = document.getSelection();
      const track = trackRef.current;
      if (!sel || !track) return;
      if (sel.isCollapsed || sel.rangeCount === 0) {
        cb.current.onSelected?.(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!track.contains(range.commonAncestorContainer)) return;
      const toOffset = (node: Node, off: number) => {
        const p = (node.nodeType === 3 ? node.parentElement : (node as Element))?.closest<HTMLElement>("p[data-start]");
        if (!p) return null;
        const r = document.createRange();
        r.selectNodeContents(p);
        r.setEnd(node, off);
        return +p.dataset.start! + r.toString().length;
      };
      const a = toOffset(range.startContainer, range.startOffset);
      const b = toOffset(range.endContainer, range.endOffset);
      if (a === null || b === null || b <= a) return;
      const rect = range.getBoundingClientRect();
      cb.current.onSelected?.({ cfiRange: `txt:${a}-${b}`, text: sel.toString(), rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });
    };
    // selectionchange fires continuously; report on pointer release like epub.js does
    document.addEventListener("pointerup", onChange);
    document.addEventListener("keyup", onChange);
    document.addEventListener("selectionchange", () => {
      if (document.getSelection()?.isCollapsed) cb.current.onSelected?.(null);
    });
    return () => {
      document.removeEventListener("pointerup", onChange);
      document.removeEventListener("keyup", onChange);
    };
  }, []);

  // Paragraph → React nodes with highlight <mark>s
  const marks = useMemo(() => highlights.map((h) => ({ h, r: parseRange(h.cfi_range) })).filter((x) => x.r) as Array<{ h: Highlight; r: { start: number; end: number } }>, [highlights]);
  const renderPara = (p: Para) => {
    const end = p.start + p.text.length;
    const inside = marks.filter((m) => m.r.start < end && m.r.end > p.start).sort((a, b) => a.r.start - b.r.start);
    if (!inside.length) return p.text;
    const nodes: ReactNode[] = [];
    let cursor = p.start;
    for (const m of inside) {
      const s = Math.max(m.r.start, p.start);
      const e = Math.min(m.r.end, end);
      if (s < cursor) continue;
      if (s > cursor) nodes.push(p.text.slice(cursor - p.start, s - p.start));
      const c = HIGHLIGHT_COLORS[m.h.color] ?? HIGHLIGHT_COLORS.yellow;
      const underline = m.h.color === "underline";
      nodes.push(
        <mark
          key={m.h.id + s}
          data-start={s}
          onClick={(ev) => {
            ev.stopPropagation();
            cb.current.onHighlightClick?.(m.h.id, (ev.currentTarget as HTMLElement).getBoundingClientRect());
          }}
          style={{
            background: underline ? "transparent" : c.fill,
            color: "inherit",
            opacity: underline ? 1 : theme.dark ? 0.75 : 1,
            mixBlendMode: theme.dark ? "screen" : "multiply",
            textDecoration: underline ? `underline 2px ${c.fill}` : "none",
            textDecorationSkipInk: "none",
            cursor: "pointer",
          }}
        >
          {p.text.slice(s - p.start, e - p.start)}
        </mark>,
      );
      cursor = e;
    }
    if (cursor < end) nodes.push(p.text.slice(cursor - p.start));
    return nodes;
  };

  const vpWidthNow = scroll ? 0 : vpWidth;

  return (
    <div
      ref={viewportRef}
      className={scroll ? "h-full w-full overflow-y-auto" : "h-full w-full overflow-hidden"}
      style={{ background: theme.bg, color: theme.fg }}
      onClick={() => {
        if (document.getSelection()?.isCollapsed) cb.current.onTap?.();
      }}
    >
      <div
        ref={trackRef}
        className={scroll ? "mx-auto max-w-3xl" : "h-full"}
        style={{
          transform: scroll ? undefined : `translateX(${-(page - 1) * vpWidthNow}px)`,
          columnFill: scroll ? undefined : "auto",
          fontFamily: font.family || 'Georgia, "Times New Roman", serif',
          fontSize: settings.fontSize,
          fontWeight: settings.bold || theme.weight ? 700 : 400,
          lineHeight: settings.lineHeight,
          letterSpacing: settings.letterSpacing,
          wordSpacing: settings.wordSpacing,
          textAlign: settings.justify ? "justify" : "left",
          hyphens: settings.hyphenation ? "auto" : "manual",
          paddingLeft: margins,
          paddingRight: margins,
          paddingTop: scroll ? 32 : 0,
          paddingBottom: scroll ? 64 : 0,
          boxSizing: "border-box",
        }}
      >
        {paras.length === 0 ? (
          <p className="pt-10 text-center text-sm" style={{ color: theme.muted }}>
            This document is empty.
          </p>
        ) : (
          paras.map((p) => (
            <p key={p.start} data-start={p.start} style={{ margin: "0 0 1em", paddingTop: p.start === 0 && !scroll ? "6vh" : 0 }}>
              {renderPara(p)}
            </p>
          ))
        )}
      </div>
    </div>
  );
};
