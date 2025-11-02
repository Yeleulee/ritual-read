import JSZip from "jszip";

export interface DocxContent {
  paragraphs: string[];
  text: string;
}

const DEFAULT_WORDS_PER_PAGE = 350;

function ensureDomParser(): DOMParser {
  if (typeof DOMParser === "undefined") {
    throw new Error("DOCX parsing requires DOMParser support in this environment");
  }
  return new DOMParser();
}

export async function extractDocxContent(arrayBuffer: ArrayBuffer): Promise<DocxContent> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("Invalid DOCX file: missing document.xml");
  }

  const documentXml = await documentFile.async("text");
  const parser = ensureDomParser();
  const xmlDoc = parser.parseFromString(documentXml, "application/xml");

  if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Unable to parse DOCX XML");
  }

  const paragraphNodes = Array.from(xmlDoc.getElementsByTagName("w:p"));
  const paragraphs: string[] = [];

  for (const node of paragraphNodes) {
    const textNodes = Array.from(node.getElementsByTagName("w:t"));
    const paragraph = textNodes
      .map((t) => (t.textContent ?? "").replace(/\u00A0/g, " "))
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    if (paragraph) {
      paragraphs.push(paragraph);
    }
  }

  const text = paragraphs.join("\n\n").trim();
  return { paragraphs, text };
}

export function estimateDocxPages(text: string, wordsPerPage: number = DEFAULT_WORDS_PER_PAGE): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / Math.max(1, wordsPerPage)));
}
