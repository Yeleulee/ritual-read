import { useEffect, useRef, useState } from "react";

interface PdfReaderProps {
  fileUrl: string;
  page: number;
  onPageCount?: (count: number) => void;
}

export const PdfReader = ({ fileUrl, page, onPageCount }: PdfReaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      // Use CDN worker to avoid bundler worker config
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;
      const loadingTask = pdfjsLib.getDocument(fileUrl);
      const doc = await loadingTask.promise;
      if (cancelled) return;
      setPdfDoc(doc);
      onPageCount?.(doc.numPages);
    })().catch((e) => console.error("PDF load error:", e));
    return () => {
      cancelled = true;
      try { renderTaskRef.current?.cancel(); } catch {}
    };
  }, [fileUrl, onPageCount]);

  useEffect(() => {
    const render = async () => {
      if (!pdfDoc || !canvasRef.current || !containerRef.current) return;
      try {
        const p = await pdfDoc.getPage(page);
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
        renderTaskRef.current = p.render({ canvasContext: context, viewport: scaledViewport });
        await renderTaskRef.current.promise;
      } catch (e) {
        console.error("PDF render error:", e);
      }
    };
    render();

    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pdfDoc, page]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="max-w-full h-auto" />
    </div>
  );
};