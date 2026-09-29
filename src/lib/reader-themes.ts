/* Apple Books–style reader appearance: six themes, book faces, settings shape,
   and the CSS handed to epub.js. Also consumed by the shell outside the iframe. */

export type ThemeId = "original" | "quiet" | "paper" | "bold" | "calm" | "focus";
export type PageTurnMode = "curl" | "slide" | "none" | "scroll";

export interface ReaderTheme {
  id: ThemeId;
  label: string;
  bg: string;
  fg: string;
  muted: string;
  link: string;
  selection: string;
  /** Chrome (bars, sheets) sits on this */
  chrome: string;
  dark: boolean;
  /** Bold theme forces heavier text */
  weight?: number;
}

export const THEMES: Record<ThemeId, ReaderTheme> = {
  original: { id: "original", label: "Original", bg: "#FFFFFF", fg: "#111111", muted: "#6B6B6B", link: "#0A66C2", selection: "rgba(10,102,194,.22)", chrome: "#F5F5F5", dark: false },
  quiet:    { id: "quiet",    label: "Quiet",    bg: "#EDEDED", fg: "#3A3A3A", muted: "#7A7A7A", link: "#3E5C8A", selection: "rgba(62,92,138,.22)", chrome: "#E2E2E2", dark: false },
  paper:    { id: "paper",    label: "Paper",    bg: "#F6EEDC", fg: "#3E3428", muted: "#8A7B66", link: "#8A5A2B", selection: "rgba(138,90,43,.22)", chrome: "#EEE4CE", dark: false },
  bold:     { id: "bold",     label: "Bold",     bg: "#FFFFFF", fg: "#000000", muted: "#444444", link: "#0A4FA0", selection: "rgba(10,79,160,.25)", chrome: "#F2F2F2", dark: false, weight: 700 },
  calm:     { id: "calm",     label: "Calm",     bg: "#2B2723", fg: "#D9CFC1", muted: "#9A8F80", link: "#D7A76B", selection: "rgba(215,167,107,.28)", chrome: "#352F2A", dark: true },
  focus:    { id: "focus",    label: "Focus",    bg: "#000000", fg: "#EDEDED", muted: "#9A9A9A", link: "#7FB3FF", selection: "rgba(127,179,255,.3)", chrome: "#121212", dark: true },
};

export const THEME_ORDER: ThemeId[] = ["original", "quiet", "paper", "bold", "calm", "focus"];

export interface ReaderFont {
  id: string;
  label: string;
  family: string;
  /** Self-hosted faces: [weight, style, file] */
  faces?: Array<[number, "normal" | "italic", string]>;
  sample?: string;
}

export const FONTS: ReaderFont[] = [
  { id: "publisher", label: "Original", family: "", sample: "Publisher's font" },
  { id: "literata", label: "Literata", family: '"Literata", Georgia, serif', faces: [[400, "normal", "Literata-400-normal.woff2"], [400, "italic", "Literata-400-italic.woff2"], [700, "normal", "Literata-700-normal.woff2"]] },
  { id: "charis", label: "Charis", family: '"Charis SIL", "Charter", Georgia, serif', faces: [[400, "normal", "CharisSIL-400-normal.woff2"], [400, "italic", "CharisSIL-400-italic.woff2"], [700, "normal", "CharisSIL-700-normal.woff2"]] },
  { id: "newsreader", label: "Newsreader", family: '"Newsreader", "Iowan Old Style", Baskerville, serif', faces: [[400, "normal", "Newsreader-400-normal.woff2"], [400, "italic", "Newsreader-400-italic.woff2"], [700, "normal", "Newsreader-700-normal.woff2"]] },
  { id: "sourceserif", label: "Source Serif", family: '"Source Serif 4", "Athelas", Georgia, serif', faces: [[400, "normal", "SourceSerif4-400-normal.woff2"], [400, "italic", "SourceSerif4-400-italic.woff2"], [700, "normal", "SourceSerif4-700-normal.woff2"]] },
  { id: "georgia", label: "Georgia", family: 'Georgia, "Times New Roman", serif' },
  { id: "palatino", label: "Palatino", family: '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", serif' },
  { id: "times", label: "Times New Roman", family: '"Times New Roman", Times, serif' },
  { id: "inter", label: "Inter", family: '"Inter", -apple-system, "Segoe UI", system-ui, sans-serif', faces: [[400, "normal", "Inter-400-normal.woff2"], [700, "normal", "Inter-700-normal.woff2"]] },
  { id: "system", label: "System", family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif' },
];

export interface ReaderSettings {
  theme: ThemeId;
  autoNight: boolean;
  fontId: string;
  fontSize: number; // px
  bold: boolean;
  lineHeight: number;
  letterSpacing: number; // px
  wordSpacing: number; // px
  justify: boolean;
  hyphenation: boolean;
  pageTurn: PageTurnMode;
  brightness: number; // 0.3 – 1
  margins: "narrow" | "normal" | "wide";
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "original",
  autoNight: false,
  fontId: "literata",
  fontSize: 18,
  bold: false,
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0,
  justify: false,
  hyphenation: true,
  pageTurn: "curl",
  brightness: 1,
  margins: "normal",
};

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 32;

export const fontById = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];

/** Night-time heuristic: OS dark scheme, or 19:00–07:00 local. No geolocation. */
export function isNightNow(now = new Date()) {
  const osDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const h = now.getHours();
  return osDark || h >= 19 || h < 7;
}

/** Theme to actually render, honouring Auto-Night. */
export function resolveTheme(s: ReaderSettings, night = isNightNow()): ReaderTheme {
  if (s.autoNight && night && !THEMES[s.theme].dark) return THEMES[s.theme === "paper" ? "calm" : "focus"];
  return THEMES[s.theme];
}

/** @font-face rules for self-hosted faces, absolute so they resolve inside the EPUB iframe. */
export function fontFaceCss(origin = typeof location !== "undefined" ? location.origin : "") {
  return FONTS.flatMap((f) =>
    (f.faces ?? []).map(
      ([w, st, file]) =>
        `@font-face{font-family:${f.family.split(",")[0]};font-style:${st};font-weight:${w};font-display:swap;src:url(${origin}/fonts/${file}) format("woff2")}`,
    ),
  ).join("\n");
}

const MARGINS = { narrow: "4%", normal: "8%", wide: "14%" } as const;

/** Rule set for epub.js `rendition.themes.register(name, rules)`. */
export function themeToEpubRules(theme: ReaderTheme, s: ReaderSettings) {
  const font = fontById(s.fontId);
  const weight = s.bold || theme.weight ? "700" : "";
  const body: Record<string, string> = {
    background: `${theme.bg} !important`,
    color: `${theme.fg} !important`,
    "font-size": `${s.fontSize}px !important`,
    "line-height": `${s.lineHeight} !important`,
    "letter-spacing": `${s.letterSpacing}px !important`,
    "word-spacing": `${s.wordSpacing}px !important`,
    "text-align": `${s.justify ? "justify" : "left"} !important`,
    hyphens: `${s.hyphenation ? "auto" : "manual"} !important`,
    "-webkit-hyphens": `${s.hyphenation ? "auto" : "manual"} !important`,
    "padding-left": `${MARGINS[s.margins]} !important`,
    "padding-right": `${MARGINS[s.margins]} !important`,
    "-webkit-text-size-adjust": "100%",
  };
  if (font.family) body["font-family"] = `${font.family} !important`;
  if (weight) body["font-weight"] = `${weight} !important`;

  const text: Record<string, string> = { color: `${theme.fg} !important` };
  if (font.family) text["font-family"] = "inherit !important";
  if (weight) text["font-weight"] = `${weight} !important`;

  return {
    body,
    "p, li, blockquote, dd, dt, span, div": text,
    "h1, h2, h3, h4, h5, h6": { color: `${theme.fg} !important`, ...(font.family ? { "font-family": "inherit !important" } : {}) },
    a: { color: `${theme.link} !important`, "text-decoration-color": `${theme.link} !important` },
    "::selection": { background: theme.selection },
    img: { "max-width": "100% !important", height: "auto !important", filter: theme.dark ? "brightness(.85)" : "none" },
    "hr": { "border-color": `${theme.muted} !important` },
  };
}

export const HIGHLIGHT_COLORS: Record<string, { fill: string; label: string }> = {
  yellow: { fill: "#FFD60A", label: "Yellow" },
  green: { fill: "#30D158", label: "Green" },
  blue: { fill: "#64D2FF", label: "Blue" },
  pink: { fill: "#FF6482", label: "Pink" },
  purple: { fill: "#BF5AF2", label: "Purple" },
  underline: { fill: "#FF453A", label: "Underline" },
};
