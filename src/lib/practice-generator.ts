import { loadPdfjs } from "@/lib/pdf";
import { extractDocxContent } from "@/lib/docx";
import JSZip from "jszip";
import { getBookText, isPlaceholderContent } from "@/lib/book-context";
import { getBookFile } from "@/lib/fileCache";
import type { BookItem } from "@/hooks/use-books";
import type { PracticeQuestion, PracticeSet, QuestionType } from "@/types/practice";

const MAX_PRACTICE_CHARS = 60_000;
const MAX_PDF_PAGES = 200;

/* ───── Text helpers ───── */

function cleanText(text: string): string {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

async function extractEpubBuffer(data: ArrayBuffer): Promise<string> {
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
    if (size >= MAX_PRACTICE_CHARS) break;
    const href = manifest.get(ref.getAttribute("idref") ?? "");
    const html = href ? await read(base + href) : undefined;
    if (!html) continue;
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script, style").forEach((el) => el.remove());
    doc.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, br, tr, blockquote").forEach((el) => el.append("\n"));
    const text = cleanText(doc.body?.textContent ?? "");
    if (text) {
      parts.push(text);
      size += text.length;
    }
  }
  return parts.join("\n\n");
}

/* ───── File text extraction (zero AI needed) ───── */

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (["txt", "text", "md", "markdown"].includes(ext)) {
    return cleanText(await file.text());
  }

  if (ext === "docx") {
    const buffer = await file.arrayBuffer();
    const doc = await extractDocxContent(buffer);
    return cleanText(doc.text);
  }

  if (ext === "epub") {
    const buffer = await file.arrayBuffer();
    return cleanText(await extractEpubBuffer(buffer));
  }

  if (ext === "pdf") {
    const pdfjs = await loadPdfjs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    try {
      const parts: string[] = [];
      const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
      let totalLength = 0;
      for (let i = 1; i <= pages && totalLength < MAX_PRACTICE_CHARS; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
          .join("")
          .trim();
        page.cleanup();
        if (text) {
          parts.push(`[Page ${i}]\n${text}`);
          totalLength += text.length;
        }
      }
      return cleanText(parts.join("\n\n"));
    } finally {
      pdf.destroy().catch(() => {});
    }
  }

  if (ext === "pptx") {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
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
        .map((p) =>
          Array.from(p.getElementsByTagName("a:t"))
            .map((t) => t.textContent ?? "")
            .join("")
        )
        .filter((line) => line.trim())
        .join("\n");
      if (text) parts.push(`[Slide ${n}]\n${text}`);
    }
    return cleanText(parts.join("\n\n"));
  }

  try {
    return cleanText(await file.text());
  } catch {
    throw new Error(`Unsupported format .${ext}. Upload a PDF, DOCX, EPUB, PPTX, or TXT file.`);
  }
}

export async function extractTextFromBook(book: BookItem): Promise<string> {
  const text = await getBookText(book);
  if (text && text.trim().length > 0) {
    return cleanText(text);
  }
  if (book.content && !isPlaceholderContent(book.content) && book.content.trim().length > 20) {
    return cleanText(book.content);
  }
  if (book.fileUrl) {
    const resolved = await getBookFile(book.fileUrl);
    if (resolved) {
      try {
        const res = await fetch(resolved);
        if (res.ok) {
          const blob = await res.blob();
          const ext = (book.fileType || "txt").toLowerCase();
          const file = new File([blob], `${book.title}.${ext}`, { type: blob.type });
          const extracted = await extractTextFromFile(file);
          if (extracted.trim().length > 0) return extracted;
        }
      } finally {
        if (resolved.startsWith("blob:")) URL.revokeObjectURL(resolved);
      }
    }
  }
  throw new Error(`Could not read text from "${book.title}". Make sure the file is uploaded and not a scanned image.`);
}

/* ───────────────────────────────────────────────────────────────────
   LOCAL question generation — zero AI credits
   Extracts key sentences and definitions from the material, then
   builds fill-in-the-blank, true/false, and flashcard questions
   purely offline.
   ─────────────────────────────────────────────────────────────────── */

export interface GenerateOptions {
  materialText: string;
  materialTitle: string;
  mockQuestionsText?: string;
  questionCount?: number;
  questionType?: "multiple-choice" | "true-false" | "mixed" | "flashcard";
  difficulty?: "easy" | "medium" | "hard" | "comprehensive";
  topicFocus?: string;
}

const STOPWORDS = new Set([
  "the", "this", "that", "these", "those", "there", "their", "where", "when", "what", "which",
  "how", "while", "after", "before", "because", "since", "during", "however", "although", "also",
  "about", "would", "could", "should", "being", "between", "through", "under", "above", "below",
  "other", "another", "every", "several", "many", "most", "some", "such", "only", "very", "more",
  "than", "then", "into", "from", "with", "without", "within", "using", "based", "called",
]);

/** Sentences & bullet facts worth turning into questions */
function extractKeySentences(text: string): string[] {
  const clean = text.replace(/\[(?:Page|Slide)\s+\d+\]/gi, "").trim();

  // Split by sentence endings OR newlines (handles slides, study guides, bullet lists)
  const rawChunks = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•*\d.)]+\s+/, "").trim())
    .filter((s) => s.length >= 24 && s.length <= 420)
    .filter((s) => !/https?:\/\//i.test(s))
    .filter((s) => !(/^[A-Z\s\d:_-]+$/.test(s) && s.length < 70)); // skip short all-caps headings

  // Deduplicate similar lines
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of rawChunks) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  // Prefer sentences with clear relational/factual verbs, fall back to all clean chunks
  const factual = unique.filter((s) =>
    /\b(is|are|was|were|has|have|had|can|will|do|does|did|means|refers|causes|produces|contains|consists|includes|defines|represents|occurs|requires|forms)\b/i.test(s)
  );
  return factual.length >= 3 ? factual : unique;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pick a key term or number from a sentence for blanking out */
function pickBlankTarget(sentence: string): { phrase: string; index: number; kind: "number" | "proper" | "term" } | null {
  // 1. Quoted terms
  const quoted = [...sentence.matchAll(/"([^"]{3,30})"/g)];
  if (quoted.length > 0) {
    const pick = quoted[Math.floor(Math.random() * quoted.length)];
    return { phrase: pick[1], index: pick.index! + 1, kind: "term" };
  }

  // 2. Key proper noun phrases (skip sentence-initial common starters)
  const proper = [...sentence.matchAll(/\b([A-Z][a-zA-Z]{2,}(?:\s[A-Z][a-zA-Z]+){0,2})\b/g)].filter(
    (m) => !STOPWORDS.has(m[1].toLowerCase()) && m.index! > 0
  );
  if (proper.length > 0) {
    const pick = proper[Math.floor(Math.random() * proper.length)];
    return { phrase: pick[1], index: pick.index!, kind: "proper" };
  }

  // 3. Significant content words (6+ chars, non-stopword)
  const words = [...sentence.matchAll(/\b([a-zA-Z]{5,})\b/g)].filter(
    (m) => !STOPWORDS.has(m[1].toLowerCase())
  );
  if (words.length > 0) {
    // Prefer longer domain terms
    words.sort((a, b) => b[1].length - a[1].length);
    const pool = words.slice(0, Math.min(3, words.length));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { phrase: pick[1], index: pick.index!, kind: "term" };
  }

  // 4. Meaningful numbers / years
  const nums = [...sentence.matchAll(/\b(\d{2,4}(?:\.\d+)?%?)\b/g)];
  if (nums.length > 0) {
    const pick = nums[Math.floor(Math.random() * nums.length)];
    return { phrase: pick[1], index: pick.index!, kind: "number" };
  }

  return null;
}

/** Generate unique distractors from the material (case-insensitive deduplication) */
function generateDistractors(correct: string, allSentences: string[], count = 3): string[] {
  const seenLower = new Set<string>([correct.toLowerCase()]);
  const candidates: string[] = [];

  const tryAdd = (val: string) => {
    const clean = val.trim();
    const low = clean.toLowerCase();
    if (clean.length < 3 || seenLower.has(low) || STOPWORDS.has(low)) return;
    seenLower.add(low);
    candidates.push(clean);
  };

  for (const s of allSentences) {
    for (const m of s.matchAll(/\b([A-Z][a-zA-Z]{2,}(?:\s[A-Z][a-zA-Z]+){0,2})\b/g)) {
      tryAdd(m[1]);
    }
    if (candidates.length >= 30) break;
  }

  if (candidates.length < count) {
    for (const s of allSentences) {
      for (const m of s.matchAll(/\b([a-zA-Z]{5,})\b/g)) {
        tryAdd(m[1]);
      }
      if (candidates.length >= 40) break;
    }
  }

  return shuffleArray(candidates).slice(0, count);
}

/** Build a multiple-choice question from a sentence */
function buildMCQ(sentence: string, allSentences: string[], idx: number, title: string): PracticeQuestion | null {
  const target = pickBlankTarget(sentence);
  if (!target) return null;
  const distractors = generateDistractors(target.phrase, allSentences, 3);
  if (distractors.length < 3) return null;

  const blankSentence =
    sentence.slice(0, target.index) + "________" + sentence.slice(target.index + target.phrase.length);

  const options = shuffleArray([target.phrase, ...distractors]);
  const labels = ["A", "B", "C", "D"];
  const correctLabel = labels[options.indexOf(target.phrase)];

  return {
    id: `q-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "multiple-choice",
    question: `Complete the statement from the material:\n"${blankSentence}"`,
    options: options.map((text, i) => ({ id: labels[i], text })),
    correctAnswer: correctLabel,
    explanation: `In the study material, the complete statement reads: "${sentence}"`,
    sourceExcerpt: sentence,
    difficulty: sentence.length > 150 ? "hard" : sentence.length > 80 ? "medium" : "easy",
    topic: title,
  };
}

/** Build a true/false question */
function buildTrueFalse(sentence: string, allSentences: string[], idx: number, title: string): PracticeQuestion | null {
  const makeTrue = Math.random() > 0.5;

  if (makeTrue) {
    return {
      id: `q-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "true-false",
      question: `True or False: "${sentence}"`,
      options: [
        { id: "True", text: "True" },
        { id: "False", text: "False" },
      ],
      correctAnswer: "True",
      explanation: `This statement accurately reflects the provided study material.`,
      sourceExcerpt: sentence,
      difficulty: "easy",
      topic: title,
    };
  }

  const target = pickBlankTarget(sentence);
  if (!target) {
    return {
      id: `q-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "true-false",
      question: `True or False: "${sentence}"`,
      options: [
        { id: "True", text: "True" },
        { id: "False", text: "False" },
      ],
      correctAnswer: "True",
      explanation: `This statement accurately reflects the provided study material.`,
      sourceExcerpt: sentence,
      difficulty: "easy",
      topic: title,
    };
  }

  const distractors = generateDistractors(target.phrase, allSentences, 1);
  if (distractors.length === 0) return null;

  const falseSentence =
    sentence.slice(0, target.index) + distractors[0] + sentence.slice(target.index + target.phrase.length);
  return {
    id: `q-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "true-false",
    question: `True or False: "${falseSentence}"`,
    options: [
      { id: "True", text: "True" },
      { id: "False", text: "False" },
    ],
    correctAnswer: "False",
    explanation: `The study material actually states "${target.phrase}" rather than "${distractors[0]}".`,
    sourceExcerpt: sentence,
    difficulty: "medium",
    topic: title,
  };
}

/** Build a flashcard */
function buildFlashcard(sentence: string, idx: number, title: string): PracticeQuestion {
  const target = pickBlankTarget(sentence);
  const prompt = target
    ? `Fill in and explain the missing concept:\n"${sentence.slice(0, target.index)}________${sentence.slice(target.index + target.phrase.length)}"`
    : `Explain this concept from ${title}:\n"${sentence.slice(0, 90)}${sentence.length > 90 ? "..." : ""}"`;

  return {
    id: `q-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "flashcard",
    question: prompt,
    options: [],
    correctAnswer: target ? target.phrase : sentence,
    explanation: `Full context from the material: "${sentence}"`,
    sourceExcerpt: sentence,
    difficulty: "medium",
    topic: title,
  };
}

/* ───── Mock question parser (paste-in format) ───── */

interface ParsedMock {
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
}

function parseMockQuestions(raw: string): ParsedMock[] {
  const questions: ParsedMock[] = [];
  const blocks = raw.split(/(?:^|\n)(?=\s*(?:\d+[.)]\s|Q\d+[.:)]\s|Question\s+\d+[.:]\s))/i).filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let questionText = lines[0]
      .replace(/^(?:\d+[.)]\s*|Q\d+[.:)]\s*|Question\s+\d+[.:]\s*)/i, "")
      .trim();
    const options: { id: string; text: string }[] = [];
    let answer = "";
    let explanation = "";

    for (let i = 1; i < lines.length; i++) {
      const optMatch = lines[i].match(/^(?:\(([A-Da-d])\)|([A-Da-d])[.)\]])\s*(.+)/);
      if (optMatch) {
        const letter = (optMatch[1] || optMatch[2]).toUpperCase();
        options.push({ id: letter, text: optMatch[3].trim() });
        continue;
      }
      const ansMatch = lines[i].match(/^(?:Answer|Ans|Correct(?:\s+Answer)?|Key)[:\s]*([A-Da-d]|True|False)\b/i);
      if (ansMatch) {
        const val = ansMatch[1];
        answer = val.length === 1 ? val.toUpperCase() : val[0].toUpperCase() + val.slice(1).toLowerCase();
        continue;
      }
      const expMatch = lines[i].match(/^(?:Explanation|Note|Reason)[:\s]*(.+)/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }
      if (options.length === 0) {
        questionText += " " + lines[i];
      }
    }

    if (questionText.length > 3) {
      const isTF = options.length === 0 && /^(True|False)$/i.test(answer);
      const finalOptions =
        options.length > 0
          ? options
          : isTF
          ? [
              { id: "True", text: "True" },
              { id: "False", text: "False" },
            ]
          : [];

      questions.push({
        question: questionText,
        options: finalOptions,
        correctAnswer: answer || (finalOptions.length > 0 ? finalOptions[0].id : "See notes"),
        explanation: explanation || undefined,
      });
    }
  }
  return questions;
}

/* ───── Main generator function ───── */

export async function generatePracticeQuestions(options: GenerateOptions): Promise<PracticeQuestion[]> {
  const {
    materialText,
    materialTitle,
    mockQuestionsText,
    questionCount = 10,
    questionType = "multiple-choice",
    difficulty = "medium",
    topicFocus,
  } = options;

  const isMockImport = !!mockQuestionsText && mockQuestionsText.trim().length > 5;

  /* ── Path A: student's own mock questions (zero random questions) ── */
  if (isMockImport) {
    const parsed = parseMockQuestions(mockQuestionsText!);
    if (parsed.length === 0) {
      throw new Error(
        "Could not parse your questions. Format each like:\n1. Your question text\nA) Choice one\nB) Choice two\nAnswer: A"
      );
    }
    return parsed.map((p, idx) => ({
      id: `q-mock-${idx + 1}-${Date.now()}`,
      type: (p.options.length === 2 && p.options[0].id === "True"
        ? "true-false"
        : p.options.length > 0
        ? "multiple-choice"
        : "flashcard") as QuestionType,
      question: p.question,
      options: p.options,
      correctAnswer: p.correctAnswer,
      explanation:
        p.explanation ||
        (materialText
          ? "Imported from your mock test. Cross-check with your study material for full context."
          : "Imported directly from your mock question sheet."),
      sourceExcerpt: undefined,
      difficulty: "medium" as const,
      topic: topicFocus || materialTitle,
    }));
  }

  /* ── Path B: offline generation strictly from the material text ── */
  if (!materialText || materialText.trim().length < 40) {
    throw new Error(
      "Not enough readable text in this document. Upload a longer document (PDF, DOCX, PPTX, EPUB, TXT) with selectable text."
    );
  }

  let allSentences = extractKeySentences(materialText);

  if (topicFocus) {
    const keywords = topicFocus.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = allSentences.filter((s) => keywords.some((kw) => s.toLowerCase().includes(kw)));
    if (filtered.length >= 2) allSentences = filtered;
  }

  if (allSentences.length === 0) {
    throw new Error(
      "Could not extract enough sentences from this document. Make sure the file is not an image-only scan."
    );
  }

  const picked = shuffleArray(allSentences);
  const questions: PracticeQuestion[] = [];
  let idx = 0;

  for (const sentence of picked) {
    if (questions.length >= questionCount) break;
    idx++;

    let q: PracticeQuestion | null = null;
    const effectiveType =
      questionType === "mixed"
        ? (["multiple-choice", "true-false", "multiple-choice"] as const)[idx % 3]
        : questionType;

    if (effectiveType === "true-false") {
      q = buildTrueFalse(sentence, allSentences, idx, topicFocus || materialTitle);
    } else if (effectiveType === "flashcard") {
      q = buildFlashcard(sentence, idx, topicFocus || materialTitle);
    } else {
      // Try MCQ first; if not enough unique distractors in short doc, gracefully fall back to True/False
      q =
        buildMCQ(sentence, allSentences, idx, topicFocus || materialTitle) ||
        buildTrueFalse(sentence, allSentences, idx, topicFocus || materialTitle);
    }

    if (q) {
      if (difficulty !== "comprehensive") q.difficulty = difficulty;
      questions.push(q);
    }
  }

  if (questions.length === 0) {
    throw new Error("Could not generate practice questions from this content. Try uploading a document with more descriptive paragraphs.");
  }

  return questions;
}

/* ───── Helper to create a ready-to-use PracticeSet container ───── */

export function createPracticeSet(
  title: string,
  sourceType: PracticeSet["sourceType"],
  sourceName: string,
  questions: PracticeQuestion[],
  bookId?: string
): PracticeSet {
  const now = Date.now();
  return {
    id: `set-${now}-${Math.random().toString(36).substring(2, 7)}`,
    title: title || `${sourceName} Practice`,
    sourceType,
    sourceName,
    bookId,
    createdAt: now,
    updatedAt: now,
    questions,
  };
}
