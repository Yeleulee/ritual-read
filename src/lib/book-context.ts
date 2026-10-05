import JSZip from "jszip";
import type { ChatMessage } from "@/lib/ai";
import type { BookItem } from "@/hooks/use-books";
import { getBookFile } from "@/lib/fileCache";
import { loadPdfjs } from "@/lib/pdf";

/** All book context in one request (open book + tagged books) shares this budget, well under the server's 60k cap. */
export const MAX_BOOK_CONTEXT_CHARS = 32_000;
export const MAX_TAGGED_BOOKS = 5;

// Enough raw text to pick relevant passages from; the budget trims it further per request
const MAX_EXTRACT_CHARS = 400_000;
const MAX_PDF_PAGES = 400;
const EXTRACT_TIMEOUT_MS = 25_000;

const NO_TEXT_NOTE = "[Only title/author available; file text not extracted]";

/* Imported PDF/EPUB/PPTX books only store a stub like "PDF: <title>\n\nOpen to render." */
const PLACEHOLDER_RE = /^(PDF|EPUB File|PowerPoint Presentation):[^\n]*\n\n[^\n]*(Open to (render|read|view)\.)\s*$/;

export const isPlaceholderContent = (content?: string) => !content?.trim() || PLACEHOLDER_RE.test(content.trim());

const normalizeText = (text: string) =>
  text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function loadBookBlob(book: BookItem): Promise<Blob | null> {
  if (!book.fileUrl) return null;
  const url = await getBookFile(book.fileUrl);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } finally {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  try {
    const parts: string[] = [];
    let size = 0;
    const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
    for (let i = 1; i <= pages && size < MAX_EXTRACT_CHARS; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .trim();
      page.cleanup();
      if (text) {
        parts.push(`[Page ${i}]\n${text}`);
        size += text.length;
      }
    }
    return parts.join("\n\n");
  } finally {
    pdf.destroy().catch(() => {});
  }
}

const zipPath = (p: string) => {
  let s = p.replace(/\\/g, "/").split("#")[0].split("?")[0];
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep as-is */
  }
  const out: string[] = [];
  for (const seg of s.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
};

async function extractEpubText(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const files = new Map<string, string>();
  for (const name of Object.keys(zip.files)) files.set(zipPath(name).toLowerCase(), name);
  const read = (path: string) => {
    const name = files.get(zipPath(path).toLowerCase());
    return name ? zip.file(name)?.async("text") : undefined;
  };
  const parser = new DOMParser();

  const container = await read("META-INF/container.xml");
  const opfPath = container
    ? parser.parseFromString(container, "application/xml").getElementsByTagName("rootfile")[0]?.getAttribute("full-path")
    : null;
  const opf = opfPath ? await read(opfPath) : undefined;
  if (!opfPath || !opf) return "";
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const pkg = parser.parseFromString(opf, "application/xml");

  const manifest = new Map<string, string>();
  for (const item of Array.from(pkg.getElementsByTagName("item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, href);
  }

  const parts: string[] = [];
  let size = 0;
  for (const ref of Array.from(pkg.getElementsByTagName("itemref"))) {
    if (size >= MAX_EXTRACT_CHARS) break;
    const href = manifest.get(ref.getAttribute("idref") ?? "");
    const html = href ? await read(base + href) : undefined;
    if (!html) continue;
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script, style").forEach((el) => el.remove());
    // Keep paragraph breaks: textContent alone runs block elements together
    doc.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, br, tr, blockquote").forEach((el) => el.append("\n"));
    const text = normalizeText(doc.body?.textContent ?? "");
    if (text) {
      parts.push(text);
      size += text.length;
    }
  }
  return parts.join("\n\n");
}

async function extractPptxText(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(name.match(/^ppt\/slides\/slide(\d+)\.xml$/i)?.[1]) }))
    .filter((s) => s.n)
    .sort((a, b) => a.n - b.n);
  const parser = new DOMParser();
  const parts: string[] = [];
  for (const { name, n } of slides) {
    const xml = await zip.file(name)!.async("text");
    const doc = parser.parseFromString(xml, "application/xml");
    const text = Array.from(doc.getElementsByTagName("a:p"))
      .map((p) => Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent ?? "").join(""))
      .filter((line) => line.trim())
      .join("\n");
    if (text) parts.push(`[Slide ${n}]\n${text}`);
  }
  return parts.join("\n\n");
}

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T) =>
  Promise.race([promise, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))]);

const textCache = new Map<string, Promise<string>>();

/**
 * Best available plain text for a book. TXT/DOCX already store their text; PDF/EPUB/PPTX are read
 * from the cached file once per session (memoized per book id). Resolves to "" when nothing is readable.
 */
export function getBookText(book: BookItem): Promise<string> {
  if (!isPlaceholderContent(book.content)) return Promise.resolve(normalizeText(book.content!));
  const key = `${book.id}:${book.fileUrl ?? ""}`;
  const cached = textCache.get(key);
  if (cached) return cached;

  const task = (async () => {
    const type = (book.fileType ?? "").toLowerCase();
    if (!["pdf", "epub", "pptx"].includes(type)) return "";
    const blob = await loadBookBlob(book);
    if (!blob) return "";
    const data = await blob.arrayBuffer();
    const raw = type === "pdf" ? await extractPdfText(data) : type === "epub" ? await extractEpubText(data) : await extractPptxText(data);
    return normalizeText(raw).slice(0, MAX_EXTRACT_CHARS);
  })().catch((error) => {
    console.warn(`Could not extract text from "${book.title}":`, error);
    return "";
  });

  const guarded = withTimeout(task, EXTRACT_TIMEOUT_MS, "");
  textCache.set(key, guarded);
  // Failures are retried on the next send instead of being cached as "no text"
  guarded.then((text) => { if (!text) textCache.delete(key); });
  return guarded;
}

/** Splits `total` fairly: short texts take what they need and the rest is shared by longer ones. */
export function allocateBudgets(lengths: number[], total: number): number[] {
  const budgets = new Array<number>(lengths.length).fill(0);
  const order = lengths.map((len, i) => ({ len, i })).sort((a, b) => a.len - b.len);
  let remaining = total;
  order.forEach(({ len, i }, k) => {
    const share = Math.floor(remaining / (order.length - k));
    budgets[i] = Math.min(len, share);
    remaining -= budgets[i];
  });
  return budgets;
}

const STOPWORDS = new Set(
  "about above after again also among and any are because been before being between both but can could did does doing down during each from further had has have having her here hers him his how into its itself just more most much myself not now off once only other our ours over own same she should some such than that the their theirs them then there these they this those through too under until very was were what when where which while who whom why will with would you your yours tell book books chapter explain summarise summarize mean means".split(" "),
);

const queryTerms = (query: string) =>
  Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/@"[^"]*"/g, " ")
        .match(/[\p{L}\p{N}']{3,}/gu) ?? [],
    ),
  ).filter((t) => !STOPWORDS.has(t));

/**
 * Fits `text` into `budget` characters. When it is too long, keeps the opening (for orientation) plus
 * the passages that best match the question, in reading order.
 */
export function selectExcerpt(text: string, budget: number, query: string): { text: string; truncated: boolean } {
  if (text.length <= budget) return { text, truncated: false };
  const terms = queryTerms(query);
  if (!terms.length || budget < 3_000) return { text: text.slice(0, budget), truncated: true };

  const CHUNK = 1_200;
  const chunks: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length > CHUNK) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${para}` : para;
    while (current.length > CHUNK * 2) {
      chunks.push(current.slice(0, CHUNK));
      current = current.slice(CHUNK);
    }
  }
  if (current) chunks.push(current);

  const scored = chunks.map((chunk, i) => {
    const lower = chunk.toLowerCase();
    const score = terms.reduce((sum, t) => sum + (lower.includes(t) ? 1 + Math.min(4, lower.split(t).length - 2) * 0.25 : 0), 0);
    return { i, score };
  });

  const GAP = "\n[…]\n";
  const picked = new Set<number>([0]);
  let used = chunks[0].length;
  for (const { i, score } of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (score <= 0) break;
    if (picked.has(i) || used + chunks[i].length + GAP.length > budget) continue;
    picked.add(i);
    used += chunks[i].length + GAP.length;
  }
  // No passage matched the question: plain opening is the most useful fallback
  if (picked.size === 1) return { text: text.slice(0, budget), truncated: true };
  // Spend what's left of the budget on continuous text from the opening
  for (let i = 1; i < chunks.length; i++) {
    if (picked.has(i)) continue;
    if (used + chunks[i].length + GAP.length > budget) break;
    picked.add(i);
    used += chunks[i].length + GAP.length;
  }

  const ordered = [...picked].sort((a, b) => a - b);
  const out = ordered.map((i, k) => (k > 0 && ordered[k - 1] !== i - 1 ? GAP : k > 0 ? "\n\n" : "") + chunks[i]).join("");
  return { text: out.slice(0, budget), truncated: true };
}

export interface TaggedBookText {
  book: Pick<BookItem, "id" | "title" | "author">;
  text: string;
}

/**
 * System messages for the open book (the `context` string, unchanged format) and each tagged book.
 * With no tagged books the open book gets the full budget, exactly as before.
 */
export function buildBookContextMessages({
  currentContext,
  currentBookId,
  tagged,
  query,
}: {
  currentContext: string;
  currentBookId?: string;
  tagged: TaggedBookText[];
  query: string;
}): ChatMessage[] {
  const isCurrentTagged = !!currentBookId && tagged.some((t) => t.book.id === currentBookId);
  // A tagged copy of the open book carries the same (or better, extracted) text; don't send it twice
  const current = isCurrentTagged ? "" : currentContext.trim();
  const usable = tagged.filter((t) => t.text.trim());
  const lengths = [...(current ? [current.length] : []), ...usable.map((t) => t.text.length)];
  const budgets = allocateBudgets(lengths, MAX_BOOK_CONTEXT_CHARS);

  const messages: ChatMessage[] = [];
  let b = 0;
  if (current) {
    const budget = budgets[b++];
    messages.push({
      role: "system",
      content: `Context from current book:\n${current.slice(0, budget)}${current.length > budget ? "\n[Book context truncated; later passages are not included.]" : ""}`,
    });
  }
  for (const { book, text } of tagged) {
    const label = `Context from tagged book "${book.title}" by ${book.author || "Unknown author"}${book.id === currentBookId ? " (currently open)" : ""}:`;
    if (!text.trim()) {
      messages.push({ role: "system", content: `${label}\n${NO_TEXT_NOTE}` });
      continue;
    }
    const excerpt = selectExcerpt(text, budgets[b++], query);
    messages.push({
      role: "system",
      content: `${label}\n${excerpt.text}${excerpt.truncated ? "\n[truncated: only part of this book fits; the opening and the passages most relevant to the question are included]" : ""}`,
    });
  }
  return messages;
}
