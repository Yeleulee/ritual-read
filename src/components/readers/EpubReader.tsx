import { useEffect, useRef, useState } from "react";

interface EpubReaderProps {
  fileUrl: string;
  page: number; // 1-indexed from parent
  onPageCount?: (count: number) => void;
}

export const EpubReader = ({ fileUrl, page, onPageCount }: EpubReaderProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const lastPageRef = useRef<number>(page);
  const [ready, setReady] = useState(false);

  // Init book
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ePub = (await import("epubjs")).default;
      const book = ePub(fileUrl);
      bookRef.current = book;
      const rendition = book.renderTo(containerRef.current!, { width: "100%", height: "100%" });
      renditionRef.current = rendition;

      await book.ready;
      try {
        // Generate locations for an approximate page count
        await book.locations.generate(1024);
        const total = (book.locations as any)?.length?.() || 100;
        onPageCount?.(total);
      } catch {
        onPageCount?.(100);
      }
      await rendition.display();
      if (!cancelled) setReady(true);
    })().catch((e) => console.error("EPUB load error:", e));

    return () => {
      try { renditionRef.current?.destroy?.(); } catch {}
      try { bookRef.current?.destroy?.(); } catch {}
    };
  }, [fileUrl, onPageCount]);

  // Respond to parent page changes by calling next/prev
  useEffect(() => {
    if (!ready || !renditionRef.current) return;
    const delta = page - lastPageRef.current;
    if (delta === 0) return;
    const steps = Math.min(Math.abs(delta), 5); // guard
    const runner = async () => {
      for (let i = 0; i < steps; i++) {
        if (delta > 0) await renditionRef.current.next();
        else await renditionRef.current.prev();
      }
      lastPageRef.current = page;
    };
    runner();
  }, [page, ready]);

  return <div ref={containerRef} className="w-full h-full" />;
};