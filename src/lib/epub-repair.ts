import JSZip from "jszip";

/* epub.js never rejects when an EPUB is slightly broken — a manifest entry whose file
   is missing from the zip, or a TOC that doesn't exist, leaves `book.ready`/`book.opened`
   pending forever and the reader shows a failure. Converted and self-published books do
   this a lot. This pass checks the package against the archive and drops the references
   that can't be satisfied, so the spine that *is* there can render. */

export interface EpubPreflight {
  data: ArrayBuffer;
  /** Human-readable notes about what was fixed; empty when the file was fine. */
  repaired: string[];
}

const normalize = (p: string) => {
  let s = p.replace(/\\/g, "/").replace(/^\.?\//, "").split("#")[0].split("?")[0];
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
const dirname = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
const parseXml = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("malformed XML");
  return doc;
};

export async function preflightEpub(data: ArrayBuffer): Promise<EpubPreflight> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("the file isn't a zip archive");
  }
  const repaired: string[] = [];
  const entries = new Map<string, string>(); // normalized → actual zip name
  const lower = new Map<string, string>();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const n = normalize(name);
    entries.set(n, name);
    lower.set(n.toLowerCase(), name);
  }
  const find = (path: string): string | undefined => {
    const n = normalize(path);
    return entries.get(n) ?? lower.get(n.toLowerCase());
  };
  const read = (name: string) => zip.file(name)!.async("text");

  // 1. container.xml → package path
  let opfPath: string | undefined;
  const containerName = find("META-INF/container.xml");
  if (containerName) {
    try {
      const doc = parseXml(await read(containerName));
      const rootfile = Array.from(doc.getElementsByTagName("*")).find((el) => el.localName === "rootfile");
      const full = rootfile?.getAttribute("full-path");
      if (full && find(full)) opfPath = find(full);
    } catch {
      /* rebuilt below */
    }
  }
  if (!opfPath) {
    const candidate = Array.from(entries.values()).find((n) => n.toLowerCase().endsWith(".opf"));
    if (!candidate) throw new Error("no package (.opf) file inside the archive");
    opfPath = candidate;
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    );
    repaired.push("rebuilt container.xml");
  }

  // 2. Manifest ↔ archive
  let doc: Document;
  try {
    doc = parseXml(await read(opfPath));
  } catch {
    throw new Error("the package file is malformed");
  }
  const base = dirname(normalize(opfPath));
  const all = Array.from(doc.getElementsByTagName("*"));
  const items = all.filter((el) => el.localName === "item" && el.parentElement?.localName === "manifest");
  const missing = new Set<string>();
  for (const item of items) {
    const href = item.getAttribute("href");
    const id = item.getAttribute("id") ?? "";
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue; // absolute URLs are fine to leave
    const actual = find(base + href);
    if (!actual) {
      missing.add(id);
      item.parentNode?.removeChild(item);
    } else if (normalize(actual) !== normalize(base + href)) {
      // Case or encoding mismatch: point the manifest at the real name
      const rel = normalize(actual).slice(base.length);
      item.setAttribute("href", rel.split("/").map(encodeURIComponent).join("/"));
      repaired.push(`fixed path for ${id || href}`);
    }
  }
  if (missing.size) repaired.push(`${missing.size} missing file${missing.size === 1 ? "" : "s"} removed from the manifest`);

  const spine = all.find((el) => el.localName === "spine");
  if (!spine) throw new Error("the package has no spine");
  for (const ref of Array.from(spine.children)) {
    if (ref.localName === "itemref" && missing.has(ref.getAttribute("idref") ?? "")) spine.removeChild(ref);
  }
  if (!Array.from(spine.children).some((c) => c.localName === "itemref")) {
    throw new Error("none of the book's content files are present in the archive");
  }
  const tocId = spine.getAttribute("toc");
  if (tocId && missing.has(tocId)) {
    spine.removeAttribute("toc");
    repaired.push("dropped missing table of contents");
  }

  if (!repaired.length) return { data, repaired };

  zip.file(opfPath, new XMLSerializer().serializeToString(doc));
  // mimetype must be stored uncompressed; untouched entries keep their existing deflate data
  if (find("mimetype")) zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  const out = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
  return { data: out, repaired };
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "unknown error");
