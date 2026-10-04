import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bookmark, BookOpen, Check, ChevronLeft, ChevronRight, List, Minus, Moon, Music2, Plus, Search, Settings2, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { Bookmark as ReaderBookmark, Highlight } from "@/hooks/use-reader-store";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, FONTS, HIGHLIGHT_COLORS, THEME_ORDER, THEMES, type ReaderSettings, type ThemeId } from "@/lib/reader-themes";
import type { ReaderApi, SearchHit, TocItem } from "@/components/readers/EpubReader";
import { InlineRitualAudioControls } from "@/components/InlineRitualAudioControls";
import { RitualMusicSearch } from "@/components/RitualMusicSearch";

type Relocation = { page: number; totalPages: number; percent: number; pagesLeftInChapter: number; chapter?: { label: string; href?: string } };
// 44px: comfortable thumb target on phones; the icon stays 18–20px inside it
const iconButton = "inline-flex h-11 w-11 items-center justify-center rounded-full text-current transition-colors hover:bg-black/10 active:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:pointer-events-none";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/* The sheets are hand-built (they must follow the reader theme, not the app tokens), so they get the
   dialog behaviour Radix would otherwise provide: initial focus, Tab trapping, Escape, focus restore. */
function useDialogFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>("[autofocus]") ?? focusables()[0] ?? el).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("keydown", onKey); previous?.focus?.({ preventScroll: true }); };
  }, [open]);
  return ref;
}

export function ReaderTopBar({ title, author, theme, visible, bookmarked, musicPlaying, onClose, onBookmark, onContents, onSettings, onMusic }: { title: string; author: string; theme: (typeof THEMES)[ThemeId]; visible: boolean; bookmarked: boolean; musicPlaying?: boolean; onClose: () => void; onBookmark: () => void; onContents: () => void; onSettings: () => void; onMusic: () => void }) {
  return <div className={`absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-1 px-2 pt-[max(6px,env(safe-area-inset-top))] pb-5 transition-all duration-200 sm:px-4 ${visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"}`} style={{ color: theme.fg, background: `linear-gradient(${theme.bg}f2,${theme.bg}00)` }}>
    <div className="flex shrink-0 items-center">
      <button className={iconButton} onClick={onClose} aria-label="Close book"><X size={20} /></button>
      <button className={iconButton} onClick={onContents} aria-label="Contents and chapters" title="Contents (C)"><List size={20} /></button>
    </div>
    <div className="min-w-0 flex-1 px-1 text-center"><p className="truncate text-sm font-medium">{title}</p><p className="truncate text-xs opacity-60">{author}</p></div>
    <div className="flex shrink-0 items-center">
      <button className={`${iconButton} relative`} onClick={onMusic} aria-label={musicPlaying ? "Music for reading (playing)" : "Music for reading"} title="Music (M)"><Music2 size={19} />{musicPlaying && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full" style={{ background: theme.link }} aria-hidden />}</button>
      <button className={iconButton} onClick={onSettings} aria-label="Themes and settings" title="Settings (T)"><Settings2 size={19} /></button>
      <button className={`${iconButton} ${bookmarked ? "text-amber-600" : ""}`} onClick={onBookmark} aria-label={bookmarked ? "Remove bookmark" : "Bookmark this page"} aria-pressed={bookmarked}><Bookmark size={19} fill={bookmarked ? "currentColor" : "none"} /></button>
    </div>
  </div>;
}

export function ReaderFooter({ theme, visible, location, relocation, onSeek, onMenu, canPrevChapter, canNextChapter, onChapter, zoom }: { theme: (typeof THEMES)[ThemeId]; visible: boolean; location: string | null; relocation: Relocation; onSeek: (percent: number) => void; onMenu: () => void; canPrevChapter: boolean; canNextChapter: boolean; onChapter: (dir: 1 | -1) => void; zoom?: { value: number; onChange: (zoom: number) => void } }) {
  const [labelMode, setLabelMode] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seek, setSeek] = useState(relocation.percent * 100);
  useEffect(() => { if (!seeking) setSeek(relocation.percent * 100); }, [relocation.percent, seeking]);
  const label = labelMode === 0 ? `${relocation.pagesLeftInChapter} pages left in this chapter` : labelMode === 1 ? `Page ${relocation.page}${relocation.totalPages ? ` of ${relocation.totalPages}` : ""}` : `${Math.round(relocation.percent * 100)}% read`;
  return <div className={`absolute inset-x-0 bottom-0 z-50 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-8 transition-all duration-200 sm:px-4 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`} style={{ color: theme.fg, background: `linear-gradient(${theme.bg}00,${theme.bg}f5 32%)` }}>
    <input aria-label="Reading position" className="reader-scrubber block h-7 w-full cursor-pointer appearance-none bg-transparent" type="range" min="0" max="100" step="0.1" value={seeking ? seek : relocation.percent * 100} onPointerDown={() => setSeeking(true)} onChange={(e) => { setSeeking(true); setSeek(Number(e.target.value)); }} onPointerUp={() => { setSeeking(false); onSeek(seek / 100); }} onKeyUp={() => { setSeeking(false); onSeek(seek / 100); }} style={{ "--reader-progress": `${seeking ? seek : relocation.percent * 100}%`, "--reader-muted": theme.muted } as CSSProperties} />
    <div className="flex items-center justify-between gap-1">
      {/* Chapter stepping lives next to the chapter name so the whole row reads as one control */}
      <button className={iconButton} onClick={() => onChapter(-1)} disabled={!canPrevChapter} aria-label="Previous chapter" title="Previous chapter"><ChevronLeft size={20} /></button>
      <button className="min-w-0 flex-1 truncate py-2 text-center text-xs opacity-80 hover:opacity-100" onClick={() => setLabelMode((x) => (x + 1) % 3)} title="Change progress display">{relocation.chapter?.label && <span className="mr-2 font-medium opacity-80">{relocation.chapter.label}</span>}<span className="opacity-70">{label}</span></button>
      <button className={iconButton} onClick={() => onChapter(1)} disabled={!canNextChapter} aria-label="Next chapter" title="Next chapter"><ChevronRight size={20} /></button>
      {zoom && <>
        <span className="mx-1 h-5 w-px opacity-20" style={{ background: theme.fg }} aria-hidden />
        <button className={iconButton} onClick={() => zoom.onChange(zoom.value - 0.5)} disabled={zoom.value <= 1} aria-label="Zoom out"><ZoomOut size={19} /></button>
        <button className="min-w-11 px-1 py-2 text-xs tabular-nums opacity-80 hover:opacity-100 disabled:opacity-40" onClick={() => zoom.onChange(1)} disabled={zoom.value <= 1} aria-label="Fit page to screen">{Math.round(zoom.value * 100)}%</button>
        <button className={iconButton} onClick={() => zoom.onChange(zoom.value + 0.5)} disabled={zoom.value >= 4} aria-label="Zoom in"><ZoomIn size={19} /></button>
      </>}
      <button className={iconButton} onClick={onMenu} aria-label="Reader menu"><BookOpen size={19} /></button>
    </div>
    <span className="sr-only">Current location: {location ?? "not available"}</span>
  </div>;
}

/* Stays on screen while the bars are tucked away so touch users always have a visible, 44px way
   back to the controls (the centre-tap gesture is otherwise undiscoverable). */
export function ReaderChromeHandle({ theme, visible, musicPlaying, onShow }: { theme: (typeof THEMES)[ThemeId]; visible: boolean; musicPlaying?: boolean; onShow: () => void }) {
  return <button type="button" onClick={onShow} aria-label="Show reading controls" className={`absolute bottom-[max(4px,env(safe-area-inset-bottom))] left-1/2 z-50 flex h-11 min-w-[88px] -translate-x-1/2 items-center justify-center gap-2 rounded-full px-4 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`} style={{ color: theme.fg }}>
    <span className="h-1 w-10 rounded-full opacity-30" style={{ background: theme.fg }} aria-hidden />
    {musicPlaying && <Music2 size={12} className="opacity-45" aria-hidden />}
  </button>;
}

export function ReaderMenu({ open, onClose, onContents, onSearch, onSettings, onMusic, onFullscreen, onAssistant, theme }: { open: boolean; onClose: () => void; onContents: () => void; onSearch: () => void; onSettings: () => void; onMusic: () => void; onFullscreen: () => void; onAssistant: () => void; theme: (typeof THEMES)[ThemeId] }) {
  const ref = useDialogFocus<HTMLDivElement>(open, onClose);
  if (!open) return null;
  const actions = [[List, "Contents & bookmarks", onContents], [Search, "Search book", onSearch], [Settings2, "Themes & settings", onSettings], [Music2, "Music for reading", onMusic], [Moon, "Fullscreen", onFullscreen], [BookOpen, "Ask about this book", onAssistant]] as const;
  return <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/25 p-4 pb-[max(16px,env(safe-area-inset-bottom))]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-label="Reader menu" tabIndex={-1} className="w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl outline-none" style={{ color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}50` }}>
    <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: `${theme.muted}35` }}><span className="text-sm font-medium">Reader</span><button className={iconButton} onClick={onClose} aria-label="Close menu"><X size={18} /></button></div>
    {actions.map(([Icon, label, action]) => <button key={label} className="flex min-h-[48px] w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-black/5 active:bg-black/10" onClick={action}><Icon size={18} className="opacity-65" />{label}</button>)}
  </div></div>;
}

/* Music lives in the app header, which the fullscreen reader covers; this sheet brings the same
   controls into the reader so a track can be started or changed without leaving the page. */
export function MusicSheet({ open, onClose, theme }: { open: boolean; onClose: () => void; theme: (typeof THEMES)[ThemeId] }) {
  const ref = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;
  return <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/35" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Music for reading" className="flex max-h-[88%] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border shadow-2xl outline-none" style={{ color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}40` }}>
    <div className="flex items-center justify-between px-5 pt-3 pb-1"><div className="mx-auto mb-2 h-1 w-10 rounded-full opacity-25" style={{ background: theme.fg }} /></div>
    <div className="flex items-center justify-between px-5 pb-3"><h2 className="text-lg font-semibold">Music for reading</h2><button className={iconButton} onClick={onClose} aria-label="Close music"><X size={19} /></button></div>
    {/* The shared controls use the app's design tokens, so they sit on an app-coloured surface inside the themed sheet */}
    <div className={`min-h-0 flex-1 overflow-y-auto bg-background text-foreground pb-[max(16px,env(safe-area-inset-bottom))] ${theme.dark ? "dark" : ""}`}>
      <InlineRitualAudioControls />
      <RitualMusicSearch />
    </div>
  </section></div>;
}

export interface SettingsCapabilities {
  /** Font, size, spacing, justification and margins apply to this reader */
  typography: boolean;
  /** Continuous scroll is an available page-turn mode */
  scroll: boolean;
  theme: boolean;
}
const ALL_CAPABILITIES: SettingsCapabilities = { typography: true, scroll: true, theme: true };

export function ThemesSettingsSheet({ open, onClose, settings, update, theme, capabilities = ALL_CAPABILITIES, formatLabel }: { open: boolean; onClose: () => void; settings: ReaderSettings; update: (patch: Partial<ReaderSettings>) => void; theme: (typeof THEMES)[ThemeId]; capabilities?: SettingsCapabilities; formatLabel?: string }) {
  const [customize, setCustomize] = useState(false);
  const ref = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;
  const set = <K extends keyof ReaderSettings,>(key: K, value: ReaderSettings[K]) => update({ [key]: value } as Partial<ReaderSettings>);
  const turnModes = (["curl", "slide", "scroll"] as const).filter((m) => m !== "scroll" || capabilities.scroll);
  // "none" was retired (a tap already turns instantly in every mode); older saves fall back to slide
  const activeTurn = settings.pageTurn === "none" || (settings.pageTurn === "scroll" && !capabilities.scroll) ? "slide" : settings.pageTurn;
  // Native <select> popups use the OS colour scheme, so a transparent select on a dark theme opens a white list with light text
  const selectStyle = { color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}66`, colorScheme: theme.dark ? "dark" : "light" } as const;
  const optionStyle = { color: theme.fg, background: theme.chrome } as const;
  return <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/35" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Themes and settings" className="max-h-[88%] w-full max-w-2xl overflow-y-auto rounded-t-2xl border px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none sm:px-8" style={{ color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}40` }}>
    <div className="mx-auto mb-4 h-1 w-10 rounded-full opacity-25" style={{ background: theme.fg }} /><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Themes &amp; Settings</h2><button className={iconButton} onClick={onClose} aria-label="Close settings"><X size={19} /></button></div>
    {capabilities.typography && <div className="mt-6 flex items-center gap-3"><button className={iconButton} onClick={() => set("fontSize", Math.max(FONT_SIZE_MIN, settings.fontSize - 1))} aria-label="Decrease text size"><Minus size={18} /></button><input aria-label="Text size" type="range" min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} value={settings.fontSize} onChange={(e) => set("fontSize", Number(e.target.value))} className="reader-setting-range flex-1" /><button className={iconButton} onClick={() => set("fontSize", Math.min(FONT_SIZE_MAX, settings.fontSize + 1))} aria-label="Increase text size"><Plus size={18} /></button><span className="w-10 text-right text-xs tabular-nums opacity-70">{settings.fontSize}px</span></div>}
    {!capabilities.typography && <p className="mt-4 text-xs opacity-60">{formatLabel ?? "This"} pages keep their own layout, so font and spacing settings don't apply here. They still shape your EPUB and text books.</p>}
    <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">{THEME_ORDER.map((id) => { const swatch = THEMES[id]; const selected = settings.theme === id; return <button key={id} onClick={() => set("theme", id)} className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-transform ${selected ? "ring-2 ring-current scale-[1.02]" : "hover:scale-[1.02]"}`} style={{ color: swatch.fg, background: swatch.bg, borderColor: selected ? swatch.link : `${swatch.muted}66` }} aria-pressed={selected}><span className="flex h-11 w-full items-center justify-center rounded-md text-xs" style={{ background: swatch.chrome }}><span style={{ color: swatch.link }}>Aa</span></span><span className="text-[11px]">{swatch.label}</span></button>; })}</div>
    {capabilities.typography && <label className="mt-5 flex items-center justify-between border-t py-4 text-sm" style={{ borderColor: `${theme.muted}35` }}><span>Font</span><select value={settings.fontId} onChange={(e) => set("fontId", e.target.value)} className="max-w-[65%] rounded-md border px-3 py-2 text-sm" style={selectStyle}>{FONTS.map((font) => <option key={font.id} value={font.id} style={optionStyle}>{font.label}</option>)}</select></label>}
    <div className={`grid gap-3 border-y py-4 ${capabilities.typography ? "grid-cols-2" : "mt-5 grid-cols-1"}`} style={{ borderColor: `${theme.muted}35` }}>{capabilities.typography && <label className="flex items-center justify-between gap-3 text-sm"><span>Bold Text</span><input type="checkbox" checked={settings.bold} onChange={(e) => set("bold", e.target.checked)} /></label>}<label className="flex items-center justify-between gap-3 text-sm" title="Switches to a dark theme between 7 pm and 7 am, or whenever your device is in dark mode"><span>Auto-Night</span><input type="checkbox" checked={settings.autoNight} onChange={(e) => set("autoNight", e.target.checked)} /></label></div>
    {settings.autoNight && <p className="-mt-1 mb-1 text-xs opacity-55">Dark theme after 7 pm, or when your device is in dark mode.</p>}
    <div className="mt-4"><p className="mb-2 text-sm">Page Turning</p><div className={`grid gap-1 rounded-lg p-1 ${turnModes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} style={{ background: `${theme.muted}25` }}>{turnModes.map((mode) => <button key={mode} onClick={() => set("pageTurn", mode)} className={`rounded-md px-2 py-2 text-xs capitalize ${activeTurn === mode ? "shadow-sm" : "opacity-70"}`} style={activeTurn === mode ? { background: theme.bg, color: theme.fg } : undefined}>{mode}</button>)}</div>
      {(activeTurn === "curl" || activeTurn === "slide") && <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span>Turn speed</span><div className="grid grid-cols-3 gap-1 rounded-lg p-1" style={{ background: `${theme.muted}25` }}>{(["slow", "normal", "fast"] as const).map((s) => <button key={s} onClick={() => set("turnSpeed", s)} className={`rounded-md px-3 py-1.5 text-xs capitalize ${settings.turnSpeed === s ? "shadow-sm" : "opacity-70"}`} style={settings.turnSpeed === s ? { background: theme.bg, color: theme.fg } : undefined}>{s}</button>)}</div></div>}
      <p className="mt-2 text-xs opacity-55">Tap or click an edge to turn. Drag from an edge (or swipe anywhere on touch) to peel the page by hand.</p></div>
    <label className="mt-5 block text-sm">Brightness <span className="float-right tabular-nums opacity-60">{Math.round(settings.brightness * 100)}%</span><input className="reader-setting-range mt-3 w-full" type="range" min="0.3" max="1" step="0.01" value={settings.brightness} onChange={(e) => set("brightness", Number(e.target.value))} /></label>
    {capabilities.typography && <button className="mt-5 flex w-full items-center justify-between border-t py-4 text-sm font-medium" style={{ borderColor: `${theme.muted}35` }} onClick={() => setCustomize((x) => !x)}>Customize <span className="opacity-60">{customize ? "−" : "+"}</span></button>}
    {capabilities.typography && customize && <div className="space-y-4 pb-3"><label className="block text-sm">Line Spacing <span className="float-right opacity-60">{settings.lineHeight.toFixed(1)}</span><input className="reader-setting-range mt-3 w-full" type="range" min="1.2" max="2.4" step="0.1" value={settings.lineHeight} onChange={(e) => set("lineHeight", Number(e.target.value))} /></label><label className="block text-sm">Character Spacing <span className="float-right opacity-60">{settings.letterSpacing}px</span><input className="reader-setting-range mt-3 w-full" type="range" min="-1" max="3" step="0.25" value={settings.letterSpacing} onChange={(e) => set("letterSpacing", Number(e.target.value))} /></label><label className="block text-sm">Word Spacing <span className="float-right opacity-60">{settings.wordSpacing}px</span><input className="reader-setting-range mt-3 w-full" type="range" min="0" max="8" step="0.5" value={settings.wordSpacing} onChange={(e) => set("wordSpacing", Number(e.target.value))} /></label><div className="grid grid-cols-2 gap-3"><label className="flex items-center justify-between text-sm"><span>Justify</span><input type="checkbox" checked={settings.justify} onChange={(e) => set("justify", e.target.checked)} /></label><label className="flex items-center justify-between text-sm"><span>Hyphenation</span><input type="checkbox" checked={settings.hyphenation} onChange={(e) => set("hyphenation", e.target.checked)} /></label></div><label className="flex items-center justify-between text-sm"><span>Margins</span><select className="rounded-md border px-3 py-2" style={selectStyle} value={settings.margins} onChange={(e) => set("margins", e.target.value as ReaderSettings["margins"])}><option value="narrow" style={optionStyle}>Narrow</option><option value="normal" style={optionStyle}>Normal</option><option value="wide" style={optionStyle}>Wide</option></select></label></div>}
  </section></div>;
}

export function ContentsDrawer({ open, onClose, theme, toc, bookmarks, highlights, currentLocation, currentChapter, onNavigate, onRemoveBookmark, onRemoveHighlight }: { open: boolean; onClose: () => void; theme: (typeof THEMES)[ThemeId]; toc: TocItem[]; bookmarks: ReaderBookmark[]; highlights: Highlight[]; currentLocation: string | null; currentChapter?: { label: string; href?: string }; onNavigate: (location: string) => void; onRemoveBookmark: (id: string) => void; onRemoveHighlight: (id: string) => void }) {
  const [tab, setTab] = useState<"contents" | "bookmarks" | "notes">("contents");
  const ref = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;
  const flatten = (items: TocItem[], depth = 0): Array<{ item: TocItem; depth: number }> => items.flatMap((item) => [{ item, depth }, ...(item.subitems ? flatten(item.subitems, depth + 1) : [])]);
  const rows = flatten(toc);
  const base = (h = "") => h.split("#")[0];
  const isCurrent = (item: TocItem) => (item.cfi && item.cfi === currentLocation) || (!!currentChapter?.href && !!item.href && base(item.href) === base(currentChapter.href)) || (!currentChapter?.href && !!currentChapter?.label && item.label === currentChapter.label);
  return <div className="absolute inset-0 z-[80] flex justify-start bg-black/35" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Contents and bookmarks" className="flex h-full w-full flex-col border-r shadow-2xl outline-none sm:max-w-md" style={{ color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}44` }}>
    <header className="flex items-center justify-between border-b px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]" style={{ borderColor: `${theme.muted}35` }}><h2 className="font-serif text-xl">This Book</h2><button className={iconButton} onClick={onClose} aria-label="Close contents"><X size={19} /></button></header>
    <div className="grid grid-cols-3 gap-1 border-b p-2" style={{ borderColor: `${theme.muted}35` }}>{(["contents", "bookmarks", "notes"] as const).map((v) => <button key={v} onClick={() => setTab(v)} className={`rounded-md py-2.5 text-xs capitalize ${tab === v ? "bg-black/10 font-medium" : "opacity-65"}`}>{v}{v === "bookmarks" ? ` · ${bookmarks.length}` : v === "notes" ? ` · ${highlights.length}` : ""}</button>)}</div>
    <div className="flex-1 overflow-y-auto p-3 pb-[max(16px,env(safe-area-inset-bottom))]">
      {tab === "contents" && (rows.length ? rows.map(({ item, depth }, i) => { const cur = isCurrent(item); return <button key={`${item.href}-${i}`} ref={cur ? (el) => el?.scrollIntoView({ block: "center" }) : undefined} onClick={() => { if (item.cfi || item.href) onNavigate(item.cfi ?? item.href!); onClose(); }} className="flex min-h-[48px] w-full items-center justify-between gap-3 border-b px-3 py-3 text-left text-sm active:bg-black/10" style={{ paddingLeft: 12 + depth * 16, borderColor: `${theme.muted}25`, fontWeight: cur ? 600 : 400 }}><span>{item.label}</span>{cur && <Check size={15} />}</button>; }) : <p className="px-3 py-5 text-sm opacity-60">No table of contents available.</p>)}
      {tab === "bookmarks" && (bookmarks.length ? bookmarks.map((b) => <div key={b.id} className="flex items-start gap-2 border-b py-3" style={{ borderColor: `${theme.muted}25` }}><button className="min-w-0 flex-1 text-left" onClick={() => { onNavigate(b.location); onClose(); }}><p className="text-sm font-medium">{b.label || b.excerpt?.slice(0, 42) || "Bookmarked page"}</p><p className="mt-1 line-clamp-2 text-xs opacity-60">{b.excerpt}</p></button><button className={iconButton} onClick={() => onRemoveBookmark(b.id)} aria-label="Delete bookmark"><Trash2 size={16} /></button></div>) : <p className="px-3 py-5 text-sm opacity-60">No bookmarks yet.</p>)}
      {tab === "notes" && (highlights.length ? highlights.map((h) => <div key={h.id} className="flex items-start gap-2 border-b py-3" style={{ borderColor: `${theme.muted}25` }}><button className="min-w-0 flex-1 text-left" onClick={() => { onNavigate(h.cfi_range); onClose(); }}><p className="line-clamp-3 text-sm">“{h.text}”</p><p className="mt-1 text-xs opacity-60">{h.note || "Highlight"}</p></button><button className={iconButton} onClick={() => onRemoveHighlight(h.id)} aria-label="Delete highlight"><Trash2 size={16} /></button></div>) : <p className="px-3 py-5 text-sm opacity-60">No notes or highlights yet.</p>)}
    </div>
  </section></div>;
}

export function SearchSheet({ open, onClose, theme, api, onNavigate }: { open: boolean; onClose: () => void; theme: (typeof THEMES)[ThemeId]; api: ReaderApi | null; onNavigate: (target: string) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !query.trim() || !api?.search) { setHits([]); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => { setLoading(true); const result = await api.search!(query); if (!cancelled) { setHits(result); setLoading(false); } }, 320);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query, api]);
  useEffect(() => { if (!open) { setQuery(""); setHits([]); } }, [open]);
  const ref = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;
  const highlightMatch = (text: string) => { if (!query.trim()) return text; const i = text.toLowerCase().indexOf(query.toLowerCase()); return i < 0 ? text : <>{text.slice(0, i)}<mark className="rounded-sm bg-yellow-300/70 text-inherit">{text.slice(i, i + query.length)}</mark>{text.slice(i + query.length)}</>; };
  return <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/35" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Search book" className="flex max-h-[86%] w-full max-w-2xl flex-col rounded-t-2xl border px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none" style={{ color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}40` }}>
    <div className="mx-auto mb-3 h-1 w-10 rounded-full opacity-25" style={{ background: theme.fg }} /><div className="flex items-center gap-3"><Search size={18} className="opacity-55" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this book" className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:opacity-45" /><button className={iconButton} onClick={onClose} aria-label="Close search"><X size={18} /></button></div>
    <p className="my-3 text-xs opacity-55">{loading ? "Searching…" : query ? `${hits.length} results` : "Search within this book"}</p><div className="overflow-y-auto">{hits.map((h, i) => <button key={`${h.cfi}-${i}`} onClick={() => { onNavigate(h.cfi); onClose(); }} className="block w-full border-t py-3 text-left" style={{ borderColor: `${theme.muted}28` }}><span className="text-[11px] opacity-55">{h.chapter || "Book"}</span><span className="mt-1 block text-sm leading-relaxed">{highlightMatch(h.excerpt)}</span></button>)}{query && !loading && hits.length === 0 && <p className="py-8 text-center text-sm opacity-60">No matches found.</p>}</div>
  </section></div>;
}

export function SelectionMenu({ selection, theme, onHighlight, onNote, onLookUp, onCopy, onSearch, onClose }: { selection: { cfiRange: string; text: string; rect: { left: number; top: number; width: number; height: number } } | null; theme: (typeof THEMES)[ThemeId]; onHighlight: (color: Highlight["color"]) => void; onNote: () => void; onLookUp: (word: string, context: string) => void; onCopy: (text: string) => void; onSearch: (text: string) => void; onClose: () => void }) {
  if (!selection) return null;
  const top = Math.max(12, selection.rect.top - 58);
  const left = Math.max(12, Math.min(window.innerWidth - 320, selection.rect.left));
  const colors: Array<Highlight["color"]> = ["yellow", "green", "blue", "pink", "purple"];
  const word = selection.text.trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, "") ?? "";
  return <div className="fixed z-[100] flex max-w-[min(94vw,380px)] items-center gap-1 rounded-full border px-2 py-1.5 shadow-xl" style={{ left, top, color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}66` }} role="toolbar" aria-label="Selection actions" onMouseDown={(e) => e.preventDefault()}>{colors.map((c) => <button key={c} title={`${c} highlight`} onClick={() => { onHighlight(c); onClose(); }} className="h-6 w-6 rounded-full border border-black/15" style={{ background: HIGHLIGHT_COLORS[c].fill }} />)}<span className="mx-1 h-6 w-px opacity-20" style={{ background: theme.fg }} /><button className="rounded-full px-2 py-1 text-xs" onClick={() => { onNote(); onClose(); }}>Note</button><button className="rounded-full px-2 py-1 text-xs" onClick={() => { onLookUp(word, selection.text); onClose(); }}>Look Up</button><button className="rounded-full px-2 py-1 text-xs" onClick={() => { onCopy(selection.text); onClose(); }}>Copy</button><button className="rounded-full px-2 py-1 text-xs" onClick={() => { onSearch(selection.text.slice(0, 60)); onClose(); }}>Search</button><button className="rounded-full p-1" onClick={onClose} aria-label="Close selection menu"><X size={14} /></button></div>;
}

export function NoteSheet({ open, text, theme, onSave, onClose }: { open: boolean; text: string; theme: (typeof THEMES)[ThemeId]; onSave: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState(text);
  useEffect(() => setNote(text), [text, open]);
  const ref = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;
  return <div className="absolute inset-0 z-[90] flex items-end justify-center bg-black/35" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Edit note" className="w-full max-w-xl rounded-t-2xl border px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 shadow-2xl outline-none" style={{ color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}40` }}>
    <div className="flex items-center justify-between"><h2 className="font-serif text-xl">Note</h2><button className={iconButton} onClick={onClose} aria-label="Close note"><X size={18} /></button></div>
    <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a note about this passage…" className="mt-4 min-h-32 w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderColor: `${theme.muted}55` }} />
    <div className="mt-4 flex justify-end gap-2"><button className="rounded-full px-4 py-2 text-sm opacity-70 hover:bg-black/5" onClick={onClose}>Cancel</button><button className="rounded-full px-5 py-2 text-sm text-white" style={{ background: theme.link }} onClick={() => { onSave(note); onClose(); }}>Save note</button></div>
  </section></div>;
}

export function LookUpSheet({ open, word, context, theme, onClose, onAskAI }: { open: boolean; word: string; context: string; theme: (typeof THEMES)[ThemeId]; onClose: () => void; onAskAI: (prompt: string) => void }) {
  const [data, setData] = useState<Array<{ phonetic?: string; meanings?: Array<{ partOfSpeech: string; definitions: Array<{ definition: string; example?: string }> }> }>>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || !word) return;
    let cancelled = false;
    setLoading(true); setFailed(false); setData([]);
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`).then((r) => { if (!r.ok) throw new Error("not found"); return r.json(); }).then((d) => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setFailed(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, word]);
  const ref = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;
  return <div className="absolute inset-0 z-[90] flex items-end justify-center bg-black/35" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Look up ${word}`} className="max-h-[78%] w-full max-w-xl overflow-y-auto rounded-t-2xl border px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 shadow-2xl outline-none" style={{ color: theme.fg, background: theme.chrome, borderColor: `${theme.muted}40` }}>
    <div className="flex items-start justify-between"><div><h2 className="font-serif text-2xl">{word}</h2><p className="mt-1 text-xs opacity-60">Dictionary definitions from dictionaryapi.dev</p></div><button className={iconButton} onClick={onClose} aria-label="Close definition"><X size={18} /></button></div>
    {loading && <p className="py-7 text-sm opacity-60">Looking up…</p>}{data.flatMap((entry) => entry.meanings ?? []).flatMap((meaning) => meaning.definitions.map((d, i) => <div key={`${meaning.partOfSpeech}-${i}`} className="border-t py-3" style={{ borderColor: `${theme.muted}25` }}><p className="text-xs italic opacity-55">{meaning.partOfSpeech}</p><p className="mt-1 text-sm leading-relaxed">{d.definition}</p>{d.example && <p className="mt-1 text-xs italic opacity-60">“{d.example}”</p>}</div>))}{failed && <p className="py-4 text-sm opacity-65">No dictionary entry found for this word.</p>}
    {!loading && <button className="mt-3 w-full rounded-full border px-4 py-3 text-sm" style={{ borderColor: `${theme.muted}55` }} onClick={() => { onAskAI(`Define “${word}” in this passage: “${context}”`); onClose(); }}>Ask AI about it in this passage</button>}
  </section></div>;
}

export function ReaderChromeStyles() {
  return <style>{`.reader-scrubber{appearance:none;background:transparent;height:20px;border-radius:999px}.reader-scrubber::-webkit-slider-runnable-track{height:3px;border-radius:999px;background:linear-gradient(to right,currentColor 0 var(--reader-progress),color-mix(in srgb,var(--reader-muted) 30%,transparent) var(--reader-progress) 100%)}.reader-scrubber::-moz-range-track{height:3px;border-radius:999px;background:linear-gradient(to right,currentColor 0 var(--reader-progress),color-mix(in srgb,var(--reader-muted) 30%,transparent) var(--reader-progress) 100%)}.reader-scrubber::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-4.5px;border-radius:999px;background:currentColor;opacity:.9}.reader-scrubber::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:999px;background:currentColor}.reader-setting-range{appearance:none;height:4px;border-radius:999px;background:color-mix(in srgb,currentColor 22%,transparent);accent-color:currentColor}.reader-setting-range::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:50%;background:currentColor;border:2px solid white;box-shadow:0 1px 4px #0003}.reader-setting-range::-moz-range-thumb{width:16px;height:16px;border:2px solid white;border-radius:50%;background:currentColor;box-shadow:0 1px 4px #0003}@media(prefers-reduced-motion:reduce){.reader-scrubber,.reader-setting-range{scroll-behavior:auto}}`}</style>;
}