import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// pdf.js v5 ships only an .mjs worker; the cdnjs `.js` path it used to point at 404s.
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}
