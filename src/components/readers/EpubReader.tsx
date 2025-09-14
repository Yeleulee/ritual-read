import { useEffect, useRef, useState } from "react";

interface EpubReaderProps {
  fileUrl: string;
  page: number; // 1-indexed from parent
  onPageCount?: (count: number) => void;
  onToc?: (toc: Array<{ label: string; href?: string; cfi?: string }>) => void;
  goto?: { cfi?: string; href?: string } | null;
  onRenderedText?: (text: string) => void;
}

export const EpubReader = ({ fileUrl, page, onPageCount, onToc, goto, onRenderedText }: EpubReaderProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const lastPageRef = useRef<number>(page);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [locationsCount, setLocationsCount] = useState<number | null>(null);
  const [tocReady, setTocReady] = useState<boolean>(false);

  // Init book
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ePub = (await import("epubjs")).default;
      setLoading(true);
      setError(null);

      // If using a blob: URL, load as ArrayBuffer to avoid fetch/CORS quirks
      let resource: any = fileUrl;
      try {
        if (fileUrl.startsWith('blob:')) {
          const resp = await fetch(fileUrl);
          const ab = await resp.arrayBuffer();
          resource = ab;
        }
      } catch (e) {
        console.warn('Falling back to direct URL for EPUB load');
      }

      const book = ePub(resource);
      bookRef.current = book;
      const rendition = book.renderTo(containerRef.current!, { width: "100%", height: "100%", flow: "paginated", spread: "none" });
      renditionRef.current = rendition;

      await book.ready;
      // TOC
      try {
        const toc = (book as any).navigation?.toc || [];
        if (toc && Array.isArray(toc)) {
          onToc?.(toc.map((t: any) => ({ label: t.label, href: t.href, cfi: t.cfi }))); 
          setTocReady(true);
        }
      } catch {}
      try {
        await rendition.display();
        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
        try {
          rendition.on('rendered', async (_section: any) => {
            try {
              const currentLoc = rendition.currentLocation();
              const cfi = (currentLoc as any)?.start?.cfi;
              if (cfi && book.getRange) {
                const range = await (book as any).getRange(cfi);
                const text = range?.toString?.() || '';
                if (text) onRenderedText?.(text);
              }
            } catch {}
          });
        } catch {}
      } catch (e) {
        console.error('EPUB display error:', e);
        setError('Failed to display EPUB.');
        setLoading(false);
      }

      // Generate locations after initial display so UI is not blocked
      try {
        await book.locations.generate(1024);
        const total = (book.locations as any)?.length?.() || 100;
        setLocationsCount(total);
        onPageCount?.(total);
      } catch {
        setLocationsCount(100);
        onPageCount?.(100);
      }
    })().catch((e) => {
      console.error("EPUB load error:", e);
      setError("Failed to load EPUB. Try re-importing the book.");
      setLoading(false);
    });

    return () => {
      try { renditionRef.current?.destroy?.(); } catch {}
      try { bookRef.current?.destroy?.(); } catch {}
    };
  }, [fileUrl, onPageCount]);

  // Respond to parent page changes (support both incremental and direct jumps)
  useEffect(() => {
    if (!ready || !renditionRef.current) return;
    const delta = page - lastPageRef.current;
    if (delta === 0) return;
    const runner = async () => {
      // If the jump is large and we have locations, compute CFI and display directly
      if (Math.abs(delta) > 5 && locationsCount && bookRef.current?.locations) {
        try {
          const total = locationsCount;
          const targetIndex = Math.max(0, Math.min(total - 1, page - 1));
          const percentage = total > 1 ? targetIndex / (total - 1) : 0;
          const cfi = (bookRef.current.locations as any).cfiFromPercentage(percentage);
          await renditionRef.current.display(cfi);
          lastPageRef.current = page;
          return;
        } catch (e) {
          // fallback to step navigation
        }
      }
      const steps = Math.min(Math.abs(delta), 20);
      for (let i = 0; i < steps; i++) {
        if (delta > 0) await renditionRef.current.next();
        else await renditionRef.current.prev();
      }
      lastPageRef.current = page;
    };
    runner();
  }, [page, ready]);

  // Respond to external goto requests (cfi or href)
  useEffect(() => {
    if (!goto || !renditionRef.current || !bookRef.current) return;
    (async () => {
      try {
        if (goto.cfi) {
          await renditionRef.current.display(goto.cfi);
        } else if (goto.href) {
          const loc = await bookRef.current?.cfiFromHref?.(goto.href);
          if (loc) await renditionRef.current.display(loc);
          else await renditionRef.current.display(goto.href);
        }
      } catch (e) {
        console.warn('EPUB goto failed', e);
      }
    })();
  }, [goto]);

  // Resize handler to ensure the content lays out correctly
  useEffect(() => {
    if (!renditionRef.current) return;
    const handleResize = () => {
      try { renditionRef.current.resize?.(containerRef.current?.clientWidth, containerRef.current?.clientHeight); } catch {}
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ready]);

  return (
    <div className="w-full h-full relative">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive px-4">{error}</div>
      ) : loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground px-4">Loading EPUB…</div>
      ) : null}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};