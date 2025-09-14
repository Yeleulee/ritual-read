import { useEffect, useRef, useState } from "react";

interface PdfReaderProps {
  fileUrl: string;
  page: number;
  onPageCount?: (count: number) => void;
  onOutline?: (outline: Array<{ title: string; pageNumber: number }>) => void;
  gotoPage?: number | null;
  onPageText?: (text: string) => void;
}

export const PdfReader = ({ fileUrl, page, onPageCount, onOutline, gotoPage, onPageText }: PdfReaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Use CDN worker to avoid bundler worker config
        // @ts-ignore
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;
        
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl, withCredentials: false });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        onPageCount?.(doc.numPages);

        // Outline (table of contents)
        try {
          const outline = await doc.getOutline();
          if (outline && outline.length) {
            const items: Array<{ title: string; pageNumber: number }> = [];
            for (const item of outline) {
              try {
                if (typeof item.dest === 'string') {
                  const dest: any = await doc.getDestination(item.dest);
                  const ref: any = Array.isArray(dest) ? dest[0] : (dest as any)?.[0];
                  if (ref) {
                    const pageIndex = await doc.getPageIndex(ref);
                    items.push({ title: item.title || 'Untitled', pageNumber: pageIndex + 1 });
                  }
                }
              } catch {}
            }
            if (items.length) onOutline?.(items);
          }
        } catch {}
      } catch (e: any) {
        console.error("PDF load error:", e);
        if (e.name === 'InvalidPDFException') {
          setError("This PDF file appears to be corrupted or invalid. Please try a different file.");
        } else if (e.name === 'MissingPDFException') {
          setError("PDF file not found. Please try re-importing the book.");
        } else if (e.name === 'UnexpectedResponseException') {
          setError("Network error loading PDF. Please check your connection and try again.");
        } else {
          setError("Failed to load PDF. The file may be corrupted or in an unsupported format.");
        }
      } finally {
        setLoading(false);
      }
    })().catch((e) => {
      console.error("PDF init error:", e);
      setError("Failed to initialize PDF renderer.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
      try { renderTaskRef.current?.cancel(); } catch {}
    };
  }, [fileUrl, onPageCount]);

  useEffect(() => {
    const render = async () => {
      if (!pdfDoc || !canvasRef.current || !containerRef.current) return;
      try {
        const p = await pdfDoc.getPage(gotoPage || page);
        const containerWidth = containerRef.current.clientWidth;
        const viewport = p.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / viewport.width, 2);
        const scaledViewport = p.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        // Cancel previous render if any
        try { renderTaskRef.current?.cancel(); } catch {}
        renderTaskRef.current = p.render({ canvasContext: context as any, canvas, viewport: scaledViewport } as any);
        await renderTaskRef.current.promise;

        // Extract text for side assistant
        try {
          const textContent = await p.getTextContent();
          const text = textContent.items.map((it: any) => it.str).join(" ");
          onPageText?.(text);
        } catch {}
      } catch (e) {
        console.error("PDF render error:", e);
        setError("Failed to render PDF page.");
      }
    };
    render();

    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pdfDoc, page, gotoPage]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      {error ? (
        <div className="text-sm text-destructive px-4">{error}</div>
      ) : loading ? (
        <div className="text-sm text-muted-foreground px-4">Loading PDF…</div>
      ) : (
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      )}
    </div>
  );
};