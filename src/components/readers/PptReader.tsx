import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import type { ReaderTheme } from "@/lib/reader-themes";
import { errorText } from "@/lib/epub-repair";
import type { PageFace, ReaderApi, RelocatedInfo, TocItem } from "./EpubReader";

/* PPTX slides rendered one at a time. Exposes the shared ReaderApi so the shell's page
   turner, footer scrubber, keyboard shortcuts and saved position work like every other format. */

interface Slide {
  number: number;
  title: string;
  paragraphs: string[];
  imageUrl?: string;
}

interface PptReaderProps {
  fileUrl: string;
  theme: ReaderTheme;
  initialLocation?: string | null; // slide number as string
  onReady?: (api: ReaderApi) => void;
  onToc?: (toc: TocItem[]) => void;
  onRelocated?: (info: RelocatedInfo) => void;
  onPageText?: (text: string) => void;
  onTap?: () => void;
}

const slideNumber = (name: string) => Number(/slide(\d+)\.xml$/i.exec(name)?.[1] ?? 0);

async function parsePptx(data: ArrayBuffer): Promise<Slide[]> {
  const zip = await JSZip.loadAsync(data);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (!names.length) throw new Error("no slides found in this presentation");

  const parser = new DOMParser();
  const slides: Slide[] = [];
  for (const [i, name] of names.entries()) {
    const xml = await zip.file(name)!.async("text");
    const doc = parser.parseFromString(xml, "application/xml");
    // Each <a:p> is one paragraph; runs inside it are joined
    const paragraphs: string[] = [];
    for (const p of Array.from(doc.getElementsByTagName("a:p"))) {
      const text = Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent ?? "").join("").trim();
      if (text) paragraphs.push(text);
    }
    const title = paragraphs.shift() ?? `Slide ${i + 1}`;

    // Pictures are linked from the slide's relationship file, not by position in ppt/media
    let imageUrl: string | undefined;
    const relsName = name.replace(/^ppt\/slides\//, "ppt/slides/_rels/") + ".rels";
    const rels = zip.file(relsName);
    if (rels) {
      const relDoc = parser.parseFromString(await rels.async("text"), "application/xml");
      const image = Array.from(relDoc.getElementsByTagName("Relationship")).find((r) => /\/image$/i.test(r.getAttribute("Type") ?? ""));
      const target = image?.getAttribute("Target");
      if (target) {
        const path = target.startsWith("../") ? `ppt/${target.slice(3)}` : `ppt/slides/${target}`;
        const file = zip.file(path);
        if (file) imageUrl = URL.createObjectURL(await file.async("blob"));
      }
    }
    slides.push({ number: i + 1, title, paragraphs, imageUrl });
  }
  return slides;
}

export function PptReader({ fileUrl, theme, initialLocation, onReady, onToc, onRelocated, onPageText, onTap }: PptReaderProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(() => Math.max(0, (parseInt(initialLocation ?? "1", 10) || 1) - 1));
  const indexRef = useRef(index);
  const slidesRef = useRef<Slide[]>([]);
  const slideRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onToc, onRelocated, onPageText, onTap });
  cb.current = { onReady, onToc, onRelocated, onPageText, onTap };
  const initialApplied = useRef(initialLocation ?? null);

  const emit = (i: number) => {
    const list = slidesRef.current;
    const n = list.length;
    const slide = list[i];
    if (slide) cb.current.onPageText?.([slide.title, ...slide.paragraphs].join("\n"));
    cb.current.onRelocated?.({
      location: String(i + 1),
      percent: n > 1 ? i / (n - 1) : 0,
      page: i + 1,
      totalPages: n,
      chapter: slide ? { label: slide.title, href: String(i + 1) } : undefined,
      pagesLeftInChapter: 0,
      atStart: i <= 0,
      atEnd: i >= n - 1,
    });
  };
  const goTo = (i: number) => {
    const n = slidesRef.current.length;
    if (!n) return;
    const clamped = Math.min(Math.max(0, i), n - 1);
    indexRef.current = clamped;
    setIndex(clamped);
    emit(clamped);
  };

  const apiRef = useRef<ReaderApi>();
  if (!apiRef.current) {
    apiRef.current = {
      async next() {
        if (indexRef.current >= slidesRef.current.length - 1) return false;
        goTo(indexRef.current + 1);
        return true;
      },
      async prev() {
        if (indexRef.current <= 0) return false;
        goTo(indexRef.current - 1);
        return true;
      },
      async display(target) {
        const n = slidesRef.current.length;
        if (typeof target === "number") goTo(Math.round(Math.min(1, Math.max(0, target)) * (n - 1)));
        else if (/^\d+$/.test(target)) goTo(parseInt(target, 10) - 1);
      },
      currentLocation() {
        return String(indexRef.current + 1);
      },
      visibleText() {
        const s = slidesRef.current[indexRef.current];
        return s ? [s.title, ...s.paragraphs].join("\n") : "";
      },
      async snapshot() {
        const el = slideRef.current;
        if (!el) return null;
        const clone = el.cloneNode(true) as PageFace;
        clone.style.position = "absolute";
        clone.style.inset = "0";
        return clone;
      },
    };
  }

  useEffect(() => {
    let cancelled = false;
    let urls: string[] = [];
    setStatus("loading");
    setError(null);
    (async () => {
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const parsed = await parsePptx(await resp.arrayBuffer());
      if (cancelled) return;
      urls = parsed.map((s) => s.imageUrl).filter((u): u is string => !!u);
      slidesRef.current = parsed;
      setSlides(parsed);
      cb.current.onToc?.(parsed.map((s) => ({ label: s.title, href: String(s.number) })));
      setStatus("ready");
      goTo(indexRef.current);
      cb.current.onReady?.(apiRef.current!);
    })().catch((e) => {
      if (cancelled) return;
      console.error("PPTX load error", e);
      setStatus("error");
      setError(`Couldn't open this presentation: ${errorText(e)}.`);
    });
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    if (status !== "ready" || !initialLocation || initialLocation === initialApplied.current) return;
    initialApplied.current = initialLocation;
    goTo((parseInt(initialLocation, 10) || 1) - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLocation, status]);

  const slide = slides[index];
  return (
    <div className="relative h-full w-full" style={{ background: theme.bg, color: theme.fg }} onClick={() => cb.current.onTap?.()}>
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm">{error}</div>
      ) : status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: theme.muted }}>Opening presentation…</div>
      ) : slide ? (
        <div ref={slideRef} className="absolute inset-0 flex items-center justify-center overflow-hidden px-6 pb-24 pt-20 sm:px-12" style={{ background: theme.bg, color: theme.fg }}>
          <div className="flex max-h-full w-full max-w-4xl flex-col gap-6 overflow-hidden">
            {slide.imageUrl && <img src={slide.imageUrl} alt="" className="mx-auto max-h-[55vh] w-auto max-w-full rounded-md object-contain shadow-lg" draggable={false} />}
            <div className="min-h-0 overflow-hidden">
              <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{slide.title}</h2>
              {slide.paragraphs.length > 0 && (
                <ul className="mt-4 space-y-2 text-base leading-relaxed sm:text-lg" style={{ color: theme.muted }}>
                  {slide.paragraphs.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
