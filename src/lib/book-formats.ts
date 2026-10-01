/* The one list of formats the app can actually open. The file picker, the upload
   validator, the reader shell and the marketing copy all read from here so they
   can never disagree about what "supported" means. */

export type BookFormat = "epub" | "pdf" | "txt" | "docx" | "pptx";

export interface BookFormatInfo {
  id: BookFormat;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  /** Text is extracted at import and stored inline; the original file is only kept for download. */
  textBased: boolean;
  /** Typography settings (font, size, spacing, justification, margins) affect this format. */
  typography: boolean;
  /** Continuous scroll is available as a page-turn mode. */
  scroll: boolean;
}

export const BOOK_FORMATS: Record<BookFormat, BookFormatInfo> = {
  epub: { id: "epub", label: "EPUB", extensions: ["epub"], mimeTypes: ["application/epub+zip"], textBased: false, typography: true, scroll: true },
  pdf: { id: "pdf", label: "PDF", extensions: ["pdf"], mimeTypes: ["application/pdf"], textBased: false, typography: false, scroll: false },
  txt: { id: "txt", label: "TXT", extensions: ["txt", "text", "md", "markdown"], mimeTypes: ["text/plain", "text/markdown"], textBased: true, typography: true, scroll: true },
  docx: { id: "docx", label: "DOCX", extensions: ["docx"], mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], textBased: true, typography: true, scroll: true },
  pptx: { id: "pptx", label: "PPTX", extensions: ["pptx"], mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], textBased: false, typography: false, scroll: false },
};

export const FORMAT_ORDER: BookFormat[] = ["epub", "pdf", "txt", "docx", "pptx"];
export const FORMAT_LABELS = FORMAT_ORDER.map((id) => BOOK_FORMATS[id].label);
/** Value for `<input type="file" accept>` */
export const ACCEPT_FORMATS = FORMAT_ORDER.flatMap((id) => BOOK_FORMATS[id].extensions.map((e) => `.${e}`)).join(",");
export const MAX_FILE_MB = 100;

// Formats people commonly try that we can't read; named so the error can say why
const KNOWN_UNSUPPORTED: Record<string, string> = {
  mobi: "Kindle MOBI", azw: "Kindle AZW", azw3: "Kindle AZW3", kfx: "Kindle KFX",
  fb2: "FictionBook", djvu: "DjVu", djv: "DjVu", rtf: "Rich Text", doc: "legacy Word (.doc)", ppt: "legacy PowerPoint (.ppt)",
  cbz: "comic archive", cbr: "comic archive", lit: "Microsoft Reader", pdb: "Palm", odt: "OpenDocument", html: "HTML", htm: "HTML",
};

export const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** Resolve a file to a supported format by extension first, then MIME type. */
export function detectFormat(file: { name: string; type?: string }): BookFormat | null {
  const ext = extensionOf(file.name);
  for (const id of FORMAT_ORDER) if (BOOK_FORMATS[id].extensions.includes(ext)) return id;
  if (file.type) for (const id of FORMAT_ORDER) if (BOOK_FORMATS[id].mimeTypes.includes(file.type)) return id;
  return null;
}

/** Best-effort format from a stored `file_type` / extension string, for books already in a library. */
export function formatFromType(fileType?: string | null): BookFormat | null {
  if (!fileType) return null;
  const t = fileType.toLowerCase().replace(/^\./, "");
  if (t in BOOK_FORMATS) return t as BookFormat;
  return detectFormat({ name: `x.${t}` });
}

export const isSupportedFormat = (fileType?: string | null) => formatFromType(fileType) !== null;

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

/** Throws a user-readable error when the file can't be imported. Returns the detected format otherwise. */
export function validateBookFile(file: File): BookFormat {
  const format = detectFormat(file);
  if (!format) {
    const ext = extensionOf(file.name);
    const known = KNOWN_UNSUPPORTED[ext];
    const what = known ? `${known} files aren't` : ext ? `.${ext} files aren't` : "This file type isn't";
    throw new UnsupportedFormatError(`${what} supported yet. Convert it to ${FORMAT_LABELS.join(", ")} first.`);
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_MB) throw new Error(`This file is ${Math.round(sizeMb)} MB; the limit is ${MAX_FILE_MB} MB.`);
  return format;
}

/** MIME type to store with the upload when the browser didn't supply one. */
export const mimeForFormat = (format: BookFormat) => BOOK_FORMATS[format].mimeTypes[0];
