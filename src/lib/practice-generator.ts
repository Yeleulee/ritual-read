import { loadPdfjs } from "@/lib/pdf";
import { extractDocxContent } from "@/lib/docx";
import JSZip from "jszip";
import { getBookText, isPlaceholderContent } from "@/lib/book-context";
import { getBookFile } from "@/lib/fileCache";
import { chat } from "@/lib/ai";
import type { BookItem } from "@/hooks/use-books";
import type { PracticeOption, PracticeQuestion, PracticeSet, QuestionType } from "@/types/practice";

const MAX_PRACTICE_CHARS = 60_000;
const MAX_PDF_PAGES = 200;

/* ───── Text helpers & cleaners ───── */

export function cleanText(text: string): string {
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

/* ───── File text extraction ───── */

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

/* ───── Sanitization & Front-Matter Stripper ───── */

const METADATA_LINE_REGEX =
  /^(?:isbn|copyright|all rights reserved|published by|printed in|library of congress|cataloging-in-publication|first edition|paperback|hardcover|ebook|editorial|translated by|cover design|typeset|table of contents|contents|acknowledgments?|dedication|about the author|author:|edited by|foreword|preface)/i;

export const FORBIDDEN_METADATA_REGEX =
  /\b(who (?:is the author|wrote|published|translated)|author(?:'s)? name|written by|published by|publisher|publication date|copyright|isbn|dedicat|acknowledgment)\b/i;

/** Strip publishing info, copyright blurbs, front matter, and pagination markers */
export function sanitizeStudyMaterial(rawText: string): string {
  let text = cleanText(rawText);
  // Strip page/slide markers
  text = text.replace(/\[(?:Page|Slide)\s+\d+\]/gi, "");

  const lines = text.split("\n");
  const cleanLines: string[] = [];
  let inPreamble = true;
  let substantiveFound = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (inPreamble) {
      if (METADATA_LINE_REGEX.test(trimmed)) continue;
      // If we encounter a substantive conceptual sentence (> 50 chars with common analytical verbs)
      if (trimmed.length > 50 && /\b(is|are|was|were|can|will|has|have|do|does|means|refers|describes|functions|occurs|requires)\b/i.test(trimmed)) {
        substantiveFound++;
        if (substantiveFound >= 2) inPreamble = false;
      }
    }

    if (!inPreamble && !METADATA_LINE_REGEX.test(trimmed)) {
      cleanLines.push(trimmed);
    }
  }

  const result = cleanLines.join("\n\n").trim();
  return result.length > 300 ? result : text;
}

/* ───────────────────────────────────────────────────────────────────
   AI-POWERED QUESTION GENERATION (Strictly Grounded, Exam-Grade)
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

const AI_EXAM_SYSTEM_PROMPT = `You are a distinguished university professor and academic examination director.
Your sole mission is to create authentic, rigorous, intellectually substantive practice questions strictly grounded in the provided study material.

CRITICAL NEGATIVE CONSTRAINTS (ZERO TOLERANCE):
- NEVER ask who wrote the text, the author's name, author background, or author biography.
- NEVER ask about the publisher, publishing house, publication year, copyright date, ISBN, edition, editor, or translator.
- NEVER ask about book dedications, acknowledgments, preface trivia, or table of contents.
- NEVER use simplistic Mad-Libs sentence-completion (e.g. "Complete the statement: '________ was...'").
Any question violating these constraints is completely worthless to students and must NEVER be generated.

CORE ACADEMIC STANDARDS:
- Focus 100% on core concepts, fundamental theories, key definitions, causal mechanisms, scientific processes, empirical relationships, and analytical distinctions from the material.
- For Multiple Choice:
  * Provide an articulate, conceptual question stem testing comprehension, analysis, or application.
  * Provide EXACTLY 4 distinct, plausible options: A, B, C, D. All distractors must be realistic domain concepts (no trivial, nonsensical, or joke options).
  * Assign 'correctAnswer' to the correct option ID ("A", "B", "C", or "D").
- For True / False:
  * Provide a clear, nuanced conceptual statement testing a foundational principle.
  * Options: [{"id": "True", "text": "True"}, {"id": "False", "text": "False"}].
  * Assign 'correctAnswer' to "True" or "False".
- For Flashcard:
  * Question: A key term, mechanism, theorem, or question to define or explain.
  * Options: [].
  * correctAnswer: A concise, precise explanation / definition of the concept.
- For all questions:
  * Include a thorough 'explanation' (2-4 sentences) explaining WHY the correct answer is right and clarifying key nuances.
  * Include a brief 'sourceExcerpt' (1-2 sentences) directly showing the context in the text.
  * Assign 'difficulty': "easy", "medium", or "hard".
  * Assign 'topic': The specific subject or theme tested.

OUTPUT FORMAT:
Return ONLY a valid JSON array of question objects without markdown code fences or conversational prose.
Schema:
[
  {
    "type": "multiple-choice",
    "question": "Which mechanism primarily drives...",
    "options": [
      {"id": "A", "text": "..."},
      {"id": "B", "text": "..."},
      {"id": "C", "text": "..."},
      {"id": "D", "text": "..."}
    ],
    "correctAnswer": "A",
    "explanation": "...",
    "sourceExcerpt": "...",
    "difficulty": "medium",
    "topic": "..."
  }
]`;

/** Safely parse JSON from LLM output even if wrapped in markdown blocks */
function parseJsonArray(raw: string): any[] {
  let str = raw.trim();
  const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    str = codeBlockMatch[1].trim();
  }
  const firstBracket = str.indexOf("[");
  const lastBracket = str.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    str = str.slice(firstBracket, lastBracket + 1);
  }
  const parsed = JSON.parse(str);
  return Array.isArray(parsed) ? parsed : [];
}

/** Normalize raw AI output into validated PracticeQuestion items */
function normalizeAiQuestions(
  rawList: any[],
  defaultTopic: string,
  defaultDifficulty: "easy" | "medium" | "hard",
  requestedType?: QuestionType | "mixed"
): PracticeQuestion[] {
  const result: PracticeQuestion[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== "object") continue;

    const questionText = (item.question || item.prompt || "").toString().trim();
    if (questionText.length < 10) continue;

    // Safety filter: discard if question or answer asks about author, publisher, or metadata
    const combinedCheck = `${questionText} ${item.correctAnswer || item.answer || ""}`;
    if (FORBIDDEN_METADATA_REGEX.test(combinedCheck)) {
      continue;
    }

    let rawType = (item.type || "").toString().toLowerCase().replace(/[_\s]/g, "-");
    let type: QuestionType = "multiple-choice";
    if (rawType.includes("true") || rawType.includes("false") || rawType === "tf") {
      type = "true-false";
    } else if (rawType.includes("flash") || rawType.includes("card")) {
      type = "flashcard";
    } else if (rawType.includes("choice") || rawType.includes("mcq")) {
      type = "multiple-choice";
    } else if (requestedType && requestedType !== "mixed") {
      type = requestedType;
    }

    // Normalize options
    let options: PracticeOption[] = [];
    if (type === "multiple-choice") {
      if (Array.isArray(item.options)) {
        options = item.options.map((opt: any, idx: number) => {
          const fallbackLetter = ["A", "B", "C", "D"][idx] || String.fromCharCode(65 + idx);
          if (typeof opt === "string") {
            const m = opt.match(/^(?:\(?([A-Da-d])\)?(?:[.:)]|\s+-)?\s+)?(.*)$/);
            const letter = (m && m[1] ? m[1].toUpperCase() : fallbackLetter);
            const rawText = (m && m[2] ? m[2] : opt).trim();
            return { id: letter, text: rawText || opt.trim() };
          }
          const id = (opt.id || fallbackLetter).toString().toUpperCase().trim();
          let text = (opt.text || opt.label || "").toString().trim();
          text = text.replace(/^(?:\(?[A-Da-d]\)?[.:-]?\s+)/, "").trim();
          return { id, text };
        });
      } else if (item.options && typeof item.options === "object") {
        options = Object.entries(item.options).map(([k, v]) => {
          let text = String(v).trim();
          text = text.replace(/^(?:\(?[A-Da-d]\)?[.:-]?\s+)/, "").trim();
          return {
            id: k.toUpperCase().trim(),
            text,
          };
        });
      }

      if (options.length < 2) continue;
    } else if (type === "true-false") {
      options = [
        { id: "True", text: "True" },
        { id: "False", text: "False" },
      ];
    } else {
      options = [];
    }

    // Normalize correctAnswer
    let correctAnswer = (item.correctAnswer ?? item.answer ?? item.correct ?? "").toString().trim();
    if (type === "true-false") {
      correctAnswer = /^t(?:rue)?$/i.test(correctAnswer) ? "True" : "False";
    } else if (type === "multiple-choice") {
      // If correctAnswer starts with a letter like "B)" or "B: "
      const letterMatch = correctAnswer.match(/^[(\[]?([A-Da-d])[)\]:.]?/);
      if (letterMatch && options.some((o) => o.id === letterMatch[1].toUpperCase())) {
        correctAnswer = letterMatch[1].toUpperCase();
      } else {
        // If the answer matches the text of an option
        const matchedOpt = options.find(
          (o) => o.text.toLowerCase().trim() === correctAnswer.toLowerCase().trim()
        );
        if (matchedOpt) {
          correctAnswer = matchedOpt.id;
        } else if (correctAnswer.length > 0) {
          correctAnswer = correctAnswer.slice(0, 1).toUpperCase();
        } else if (options.length > 0) {
          correctAnswer = options[0].id;
        }
      }
    }

    const explanation =
      (item.explanation || item.rationale || item.reason || "").toString().trim() ||
      "Verified directly against the key concepts and mechanisms in your study material.";

    const sourceExcerpt = (item.sourceExcerpt || item.excerpt || "").toString().trim() || undefined;

    const diff = (item.difficulty || defaultDifficulty).toString().toLowerCase();
    const finalDiff = (["easy", "medium", "hard"].includes(diff) ? diff : defaultDifficulty) as
      | "easy"
      | "medium"
      | "hard";

    result.push({
      id: `q-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      question: questionText,
      options,
      correctAnswer,
      explanation,
      sourceExcerpt,
      difficulty: finalDiff,
      topic: item.topic?.toString().trim() || defaultTopic,
    });
  }

  return result;
}

/** Divide material text into balanced substantive slices for high question counts */
function extractSubstantiveChunks(text: string, questionCount: number, topicFocus?: string): string[] {
  if (topicFocus) {
    const keywords = topicFocus.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 60);
    const matched = paragraphs.filter((p) => keywords.some((kw) => p.toLowerCase().includes(kw)));
    if (matched.length >= 2) {
      return [matched.join("\n\n").slice(0, 16_000)];
    }
  }

  const length = text.length;
  // If short text, return as one chunk
  if (length <= 12_000 || questionCount <= 10) {
    return [text.slice(0, 16_000)];
  }

  // Determine number of chunks based on questionCount and text length
  const numChunks = questionCount > 50 ? 4 : questionCount > 20 ? 3 : 2;
  const chunkSize = Math.min(14_000, Math.floor(length / numChunks));
  const chunks: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = Math.floor(i * (length / numChunks));
    const slice = text.slice(start, start + chunkSize).trim();
    if (slice.length > 200) {
      chunks.push(slice);
    }
  }

  return chunks.length > 0 ? chunks : [text.slice(0, 16_000)];
}

/** Generate questions using our LLM engine via /api/ai-chat */
async function generateAiQuestions(options: GenerateOptions): Promise<PracticeQuestion[]> {
  const {
    materialText,
    materialTitle,
    questionCount = 10,
    questionType = "multiple-choice",
    difficulty = "medium",
    topicFocus,
  } = options;

  const sanitized = sanitizeStudyMaterial(materialText);
  if (sanitized.length < 50) {
    throw new Error("Material does not contain enough text to generate questions.");
  }

  const chunks = extractSubstantiveChunks(sanitized, questionCount, topicFocus);
  const questionsPerChunk = Math.ceil(questionCount / chunks.length);
  const defaultDiff = difficulty === "comprehensive" ? "medium" : difficulty;

  const tasks = chunks.map(async (chunk, chunkIdx) => {
    let formatInstruction = "";
    if (questionType === "multiple-choice") {
      formatInstruction = "Format: 100% Multiple Choice questions with 4 options (A, B, C, D).";
    } else if (questionType === "true-false") {
      formatInstruction = "Format: 100% True / False questions testing conceptual accuracy.";
    } else if (questionType === "flashcard") {
      formatInstruction = "Format: 100% Flashcards with high-yield concepts on the front and concise definitions on the back.";
    } else {
      formatInstruction = "Format: A balanced mix of Multiple Choice (approx 60%), True/False (approx 20%), and Flashcards (approx 20%).";
    }

    const userPrompt = `Material Title: "${materialTitle}"
Target Topic / Chapter Focus: ${topicFocus || "Comprehensive coverage of core concepts"}
Target Difficulty: ${difficulty}
Required Question Count: Generate ${questionsPerChunk} rigorous questions.
${formatInstruction}

REMINDER: ABSOLUTELY ZERO QUESTIONS ABOUT AUTHORS, WRITERS, PUBLISHERS, TRANSLATORS, ISBN, OR PUBLICATION DATES.
Test ONLY the substantive knowledge, theories, causal mechanisms, definitions, and principles in this excerpt:

--- STUDY MATERIAL EXCERPT (Part ${chunkIdx + 1} of ${chunks.length}) ---
${chunk}
--- END EXCERPT ---

Return ONLY a valid JSON array of questions conforming to the schema.`;

    const reply = await chat({
      messages: [
        { role: "system", content: AI_EXAM_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      model: "gemini-2.5-flash",
    });

    const parsed = parseJsonArray(reply);
    return normalizeAiQuestions(parsed, topicFocus || materialTitle, defaultDiff, questionType);
  });

  const results = await Promise.all(tasks);
  const allQuestions = results.flat();

  // Deduplicate by question text
  const seen = new Set<string>();
  const uniqueQuestions: PracticeQuestion[] = [];
  for (const q of allQuestions) {
    const key = q.question.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueQuestions.push(q);
    }
  }

  return uniqueQuestions.slice(0, questionCount);
}

/* ───────────────────────────────────────────────────────────────────
   UPGRADED LOCAL FALLBACK (Offline / No Network Fail-Safe)
   Guaranteed ZERO metadata or author trivia.
   ─────────────────────────────────────────────────────────────────── */

const STOPWORDS = new Set([
  "the", "this", "that", "these", "those", "there", "their", "where", "when", "what", "which",
  "how", "while", "after", "before", "because", "since", "during", "however", "although", "also",
  "about", "would", "could", "should", "being", "between", "through", "under", "above", "below",
  "other", "another", "every", "several", "many", "most", "some", "such", "only", "very", "more",
  "than", "then", "into", "from", "with", "without", "within", "using", "based", "called",
]);

function extractSubstantiveSentences(text: string): string[] {
  const clean = sanitizeStudyMaterial(text);

  const rawChunks = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•*\d.)]+\s+/, "").trim())
    .filter((s) => s.length >= 40 && s.length <= 420)
    .filter((s) => !/https?:\/\//i.test(s))
    .filter((s) => !METADATA_LINE_REGEX.test(s))
    .filter((s) => !FORBIDDEN_METADATA_REGEX.test(s))
    .filter((s) => !(/^[A-Z\s\d:_-]+$/.test(s) && s.length < 70));

  // Deduplicate
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of rawChunks) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  // Prefer sentences with clear relational / explanatory verbs
  const conceptual = unique.filter((s) =>
    /\b(is defined as|refers to|consists of|results from|leads to|causes|functions to|is responsible for|characterizes|produces|requires|represents|indicates|differs from)\b/i.test(s)
  );

  return conceptual.length >= 5 ? conceptual : unique;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickKeyTerm(sentence: string): { term: string; index: number } | null {
  // Look for quoted terms
  for (const m of sentence.matchAll(/"([^"]{3,30})"/g)) {
    if (!STOPWORDS.has(m[1].toLowerCase()) && !FORBIDDEN_METADATA_REGEX.test(m[1])) {
      return { term: m[1], index: m.index! + 1 };
    }
  }
  // Look for capitalized technical concepts
  for (const m of sentence.matchAll(/\b([A-Z][a-zA-Z]{3,}(?:\s[A-Z][a-zA-Z]+)?)\b/g)) {
    if (!STOPWORDS.has(m[1].toLowerCase()) && m.index! > 0 && !FORBIDDEN_METADATA_REGEX.test(m[1])) {
      return { term: m[1], index: m.index! };
    }
  }
  // Look for longer domain terms
  for (const m of sentence.matchAll(/\b([a-zA-Z]{6,})\b/g)) {
    if (!STOPWORDS.has(m[1].toLowerCase()) && !FORBIDDEN_METADATA_REGEX.test(m[1])) {
      return { term: m[1], index: m.index! };
    }
  }
  return null;
}

function generateLocalDistractors(correctTerm: string, allSentences: string[]): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>([correctTerm.toLowerCase()]);

  for (const s of allSentences) {
    for (const m of s.matchAll(/\b([A-Z][a-zA-Z]{3,}(?:\s[A-Z][a-zA-Z]+)?)\b/g)) {
      const w = m[1].trim();
      const low = w.toLowerCase();
      if (!seen.has(low) && !STOPWORDS.has(low) && !FORBIDDEN_METADATA_REGEX.test(w) && w.length >= 4) {
        seen.add(low);
        candidates.push(w);
      }
    }
    if (candidates.length >= 20) break;
  }

  if (candidates.length < 3) {
    for (const s of allSentences) {
      for (const m of s.matchAll(/\b([a-zA-Z]{6,})\b/g)) {
        const w = m[1].trim();
        const low = w.toLowerCase();
        if (!seen.has(low) && !STOPWORDS.has(low) && !FORBIDDEN_METADATA_REGEX.test(w)) {
          seen.add(low);
          candidates.push(w);
        }
      }
      if (candidates.length >= 25) break;
    }
  }

  return shuffleArray(candidates).slice(0, 3);
}

function buildLocalMCQ(
  sentence: string,
  allSentences: string[],
  idx: number,
  topic: string
): PracticeQuestion | null {
  const target = pickKeyTerm(sentence);
  if (!target) return null;

  const distractors = generateLocalDistractors(target.term, allSentences);
  if (distractors.length < 3) return null;

  const blanked =
    sentence.slice(0, target.index) + "________" + sentence.slice(target.index + target.term.length);

  const options = shuffleArray([target.term, ...distractors]);
  const labels = ["A", "B", "C", "D"];
  const correctLabel = labels[options.indexOf(target.term)];

  return {
    id: `q-local-${idx}-${Date.now()}`,
    type: "multiple-choice",
    question: `According to the study material, which concept or term correctly completes the following principle?\n\n"${blanked}"`,
    options: options.map((text, i) => ({ id: labels[i], text })),
    correctAnswer: correctLabel,
    explanation: `From the source material: "${sentence}"`,
    sourceExcerpt: sentence,
    difficulty: "medium",
    topic,
  };
}

function buildLocalTrueFalse(sentence: string, idx: number, topic: string): PracticeQuestion {
  return {
    id: `q-local-tf-${idx}-${Date.now()}`,
    type: "true-false",
    question: `Based on the provided material, is the following statement accurate?\n\n"${sentence}"`,
    options: [
      { id: "True", text: "True" },
      { id: "False", text: "False" },
    ],
    correctAnswer: "True",
    explanation: `This statement accurately reflects the principles documented in your study text: "${sentence}"`,
    sourceExcerpt: sentence,
    difficulty: "easy",
    topic,
  };
}

function buildLocalFlashcard(sentence: string, idx: number, topic: string): PracticeQuestion {
  const target = pickKeyTerm(sentence);
  const front = target
    ? `Define the principle and role of '${target.term}' based on your study material:`
    : `Explain this key concept from ${topic}:`;

  return {
    id: `q-local-fc-${idx}-${Date.now()}`,
    type: "flashcard",
    question: front,
    options: [],
    correctAnswer: sentence,
    explanation: `Key excerpt from text: "${sentence}"`,
    sourceExcerpt: sentence,
    difficulty: "medium",
    topic,
  };
}

function generateLocalFallbackQuestions(options: GenerateOptions): PracticeQuestion[] {
  const { materialText, materialTitle, questionCount = 10, questionType = "multiple-choice", topicFocus } = options;
  const sentences = extractSubstantiveSentences(materialText);
  if (sentences.length === 0) {
    throw new Error("Could not extract enough readable sentences from this document.");
  }

  const picked = shuffleArray(sentences);
  const questions: PracticeQuestion[] = [];
  const topic = topicFocus || materialTitle;

  for (let i = 0; i < picked.length && questions.length < questionCount; i++) {
    const s = picked[i];
    let q: PracticeQuestion | null = null;

    if (questionType === "true-false") {
      q = buildLocalTrueFalse(s, i, topic);
    } else if (questionType === "flashcard") {
      q = buildLocalFlashcard(s, i, topic);
    } else {
      q = buildLocalMCQ(s, sentences, i, topic) || buildLocalTrueFalse(s, i, topic);
    }

    if (q) questions.push(q);
  }

  return questions;
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

/* ───── AI Mock Question Verifier & Error Corrector ───── */

const AI_MOCK_VERIFIER_SYSTEM_PROMPT = `You are a master academic tutor and examination verification specialist.
The student has provided their own list of practice / mock test questions.

YOUR OBJECTIVE:
1. FAITHFULLY ADOPT THE USER'S QUESTIONS:
   - Retain the student's exact questions, concepts, and options. Do NOT discard or replace them with completely unrelated questions.
   - Standardize formatting: ensure each Multiple Choice question has clear options (A, B, C, D) and True/False has True/False options.

2. FACT-CHECK AND CORRECT ALL MISTAKES IN THE ANSWER KEY:
   - Carefully solve each question using rigorous academic facts and the provided study context (if any).
   - If the student's pasted text included an answer key that is INCORRECT:
     * Set 'correctAnswer' to the true, factually and scientifically correct option ID (e.g. 'A', 'B', 'C', 'D' or 'True'/'False').
     * In 'explanation', EXPLICITLY state the correction and diagnose the error:
       "Correction: The provided answer key indicated [X], but the correct answer is [Y] because [detailed explanation of the underlying principle and why option X is a misconception]."
   - If the student's question had NO answer key (e.g. past exam questions without answers):
     * Determine the accurate correct answer.
     * Write a comprehensive, step-by-step pedagogical explanation.
   - If an MCQ only had 2 or 3 options, supply realistic domain distractors.

3. STRICT NEGATIVE CONSTRAINT:
   - Never generate author/publisher metadata trivia.

OUTPUT FORMAT:
Return ONLY a valid JSON array of question objects without markdown code fences.`;

async function generateAiMockQuestions(
  mockText: string,
  materialText?: string,
  materialTitle?: string,
  topicFocus?: string
): Promise<PracticeQuestion[]> {
  const contextBlock =
    materialText && materialText.trim().length > 60
      ? `\n\n--- REFERENCE STUDY MATERIAL ---\n${materialText.slice(0, 8000)}\n--- END REFERENCE MATERIAL ---`
      : "";

  const userPrompt = `Below are the practice / mock test questions provided by the student:

--- STUDENT PASTED QUESTIONS ---
${mockText}
--- END QUESTIONS ---
${contextBlock}

Please parse and verify every question above. Strictly keep the student's questions, verify and correct all mistakes in the answers with clear explanatory corrections, and return a valid JSON array.`;

  const reply = await chat({
    messages: [
      { role: "system", content: AI_MOCK_VERIFIER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    model: "gemini-2.5-flash",
  });

  const parsed = parseJsonArray(reply);
  return normalizeAiQuestions(parsed, topicFocus || materialTitle || "Custom Mock Exam", "medium");
}

/* ───── Main Generator Entry Point ───── */

export async function generatePracticeQuestions(options: GenerateOptions): Promise<PracticeQuestion[]> {
  const { materialText, materialTitle, mockQuestionsText, topicFocus } = options;

  /* Path A: student's own imported mock exam questions */
  if (mockQuestionsText && mockQuestionsText.trim().length > 5) {
    // 1. Try AI-powered verification & error correction first
    try {
      const verified = await generateAiMockQuestions(
        mockQuestionsText,
        materialText,
        materialTitle,
        topicFocus
      );
      if (verified.length > 0) {
        return verified;
      }
    } catch (err) {
      console.warn("AI mock question verification encountered an issue, using offline parser:", err);
    }

    // 2. Fallback to local parser if offline
    const parsed = parseMockQuestions(mockQuestionsText);
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

  /* Path B: Generate strictly from study material */
  if (!materialText || materialText.trim().length < 40) {
    throw new Error(
      "Not enough readable text in this document. Upload a document (PDF, DOCX, PPTX, EPUB, TXT) with selectable text."
    );
  }

  // 1. Try Exam-Grade AI Generation first
  try {
    const aiQuestions = await generateAiQuestions(options);
    if (aiQuestions.length > 0) {
      return aiQuestions;
    }
  } catch (aiErr) {
    console.warn("AI question generation encountered an issue, invoking metadata-stripped fallback:", aiErr);
  }

  // 2. Safe Fallback (purely substantive principles, 0% author/metadata trivia)
  const fallbackQuestions = generateLocalFallbackQuestions(options);
  if (fallbackQuestions.length === 0) {
    throw new Error(
      "Could not generate practice questions from this content. Please ensure the document contains descriptive conceptual text."
    );
  }

  return fallbackQuestions;
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
