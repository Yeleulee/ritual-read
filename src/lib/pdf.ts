import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// pdf.js v5 ships only an .mjs worker; the cdnjs `.js` path it used to point at 404s.
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/** Standard configuration for decoding CJK/complex character sets and standard 14 PDF fonts offline */
export function getPdfConfig() {
  const base = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return {
    cMapUrl: `${base}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}/pdfjs/standard_fonts/`,
  };
}
