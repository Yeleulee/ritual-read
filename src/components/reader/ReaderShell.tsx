import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { useReadingStats } from "@/hooks/use-reading-stats";
import { useBookmarks, useHighlights, useReaderSettings, useReadingPosition, type HighlightColor } from "@/hooks/use-reader-store";
import { DEFAULT_SETTINGS, isNightNow, resolveTheme, type PageTurnMode, type ReaderSettings } from "@/lib/reader-themes";
import { BOOK_FORMATS, FORMAT_LABELS, formatFromType } from "@/lib/book-formats";
import { ReaderMenu, ReaderTopBar, ReaderFooter, ThemesSettingsSheet, ContentsDrawer, SearchSheet, SelectionMenu, NoteSheet, LookUpSheet, MusicSheet, ReaderChromeStyles, type SettingsCapabilities } from "./ReaderOverlays";
import { PageTurner, type PageTurnerHandle } from "./PageTurner";
import type { ReaderApi, RelocatedInfo, SelectionInfo, TocItem } from "@/components/readers/EpubReader";
import { EpubReader } from "@/components/readers/EpubReader";
import { PdfReader } from "@/components/readers/PdfReader";
import { TextReader } from "@/components/readers/TextReader";
import { PptReader } from "@/components/readers/PptReader";
import { useResolvedFileUrl } from "@/hooks/use-resolved-file-url";

export interface ReaderBook {
  id: string; title: string; author: string; progress: number; totalPages: number;
  content?: string; fileUrl?: string; fileType?: string;
}
interface ReaderShellProps {
  book: ReaderBook; onBackToLibrary: () => void; onProgress?: (bookId: string, progress: number) => void;
}

const SAMPLE = `Chapter 1: The Art of Mindful Reading

In our fast-paced digital world, the act of reading has become increasingly rushed and fragmented. We skim through articles, jump between notifications, and rarely give ourselves the gift of deep, contemplative reading.

This book explores how we can transform reading from a mere consumption of information into a ritual of mindfulness—a practice that nourishes the soul and cultivates inner peace.

The journey begins with understanding that reading is not just about absorbing words on a page. It is about creating a sacred space for reflection, contemplation, and growth. When we approach reading as a ritual, we honor both the author's wisdom and our own capacity for understanding.

Consider the last time you truly lost yourself in a book. Remember that feeling of being completely absorbed, where time seemed to stand still, and the outside world faded away. This is the state we seek to cultivate—not as an accident, but as an intentional practice.

Mindful reading requires us to slow down, to savor each paragraph, and to allow the author's words to resonate within us. It means creating boundaries around our reading time, protecting it from the constant interruptions of modern life.

As we embark on this journey together, remember that every page turned mindfully is a step toward greater awareness, deeper understanding, and a more enriched inner life.`;
const emptyRelocation = (book: ReaderBook): RelocatedInfo => ({ location: "", percent: book.progress / 100, page: 1, totalPages: book.totalPages || 0, pagesLeftInChapter: 0, atStart: true, atEnd: false });

/* Page turning is about this device's input and GPU, not the account, so the choice lives here
   rather than in the synced settings. Touch devices start on "slide": it is a single composited
   transform, while the curl re-clips a whole chapter document every frame. */
const DEVICE_TURN_KEY = "rr:device:pageTurn";
const isTouchDevice = () => typeof window !== "undefined" && (!!window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
const readDeviceTurn = (): PageTurnMode | null => {
  try {
    const v = localStorage.getItem(DEVICE_TURN_KEY);
    return v === "curl" || v === "slide" || v === "none" || v === "scroll" ? v : null;
  } catch {
    return null;
  }
};

export function ReaderShell({ book, onBackToLibrary, onProgress }: ReaderShellProps) {
  const { settings: savedSettings, update: updateSynced } = useReaderSettings();
  const [deviceTurn, setDeviceTurn] = useState<PageTurnMode | null>(readDeviceTurn);
  const [touch] = useState(isTouchDevice);
  const update = useCallback((patch: Partial<ReaderSettings>) => {
    if (patch.pageTurn) {
      setDeviceTurn(patch.pageTurn);
      try { localStorage.setItem(DEVICE_TURN_KEY, patch.pageTurn); } catch { /* private mode */ }
    }
    updateSynced(patch);
  }, [updateSynced]);
  const baseSettings = savedSettings ?? DEFAULT_SETTINGS;
  const { position, hydrated, save: savePosition } = useReadingPosition(book.id);
  const { bookmarks, add: addBookmark, remove: removeBookmark, byLocation } = useBookmarks(book.id);
  const { highlights, add: addHighlight, update: updateHighlight, remove: removeHighlight } = useHighlights(book.id);
  const { addSeconds } = useReadingStats();
  const { toast } = useToast();
  const [api, setApi] = useState<ReaderApi | null>(null);
  const [relocation, setRelocation] = useState<RelocatedInfo>(() => emptyRelocation(book));
  const [toc, setToc] = useState<TocItem[]>([]);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ id: string; text: string } | null>(null);
  const [lookUp, setLookUp] = useState<{ word: string; context: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const pageTurnerRef = useRef<PageTurnerHandle>(null);
  const hideTimer = useRef<number>();
  const progressTimer = useRef<number>();
  const selectionRef = useRef<SelectionInfo | null>(null);
  selectionRef.current = selection;
  const { url: resolvedUrl, resolving, error: resolveError } = useResolvedFileUrl(book.fileUrl);
  // Books without a stored type predate format tracking and only ever held plain text
  const format = formatFromType(book.fileType) ?? (book.fileType ? null : "txt");
  const isEpub = format === "epub";
  const isPdf = format === "pdf";
  const isPpt = format === "pptx";
  const isText = format === "txt" || format === "docx";
  const formatInfo = format ? BOOK_FORMATS[format] : null;
  const capabilities: SettingsCapabilities = useMemo(
    () => ({ typography: formatInfo?.typography ?? true, scroll: formatInfo?.scroll ?? true, theme: true }),
    [formatInfo],
  );
  // A mode chosen for EPUB shouldn't strand a format that can't do it: scroll → slide for paged-only readers
  const pageTurn: PageTurnMode = useMemo(() => {
    let mode = deviceTurn ?? baseSettings.pageTurn;
    if (!deviceTurn && touch && mode === "curl") mode = "slide";
    if (mode === "scroll" && !capabilities.scroll) mode = "slide";
    return mode;
  }, [deviceTurn, baseSettings.pageTurn, touch, capabilities.scroll]);
  // Readers and the settings sheet all see the mode that is actually in effect
  const settings = useMemo(() => (baseSettings.pageTurn === pageTurn ? baseSettings : { ...baseSettings, pageTurn }), [baseSettings, pageTurn]);
  const [night, setNight] = useState(() => isNightNow());
  const theme = useMemo(() => resolveTheme(settings, night), [settings, night]);
  const location = relocation.location || position?.location || null;
  const isBookmarked = !!location && byLocation.has(location);
  const anySheetOpen = menuOpen || settingsOpen || contentsOpen || searchOpen || musicOpen || !!lookUp;

  // Apple Books behaviour: a tap toggles the bars and they stay; turning a page tucks them away.
  // Only the first reveal on open fades by itself.
  const hideChrome = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setChromeVisible(false);
  }, []);
  const showChrome = useCallback((autoHideMs?: number) => {
    setChromeVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (autoHideMs && !anySheetOpen) hideTimer.current = window.setTimeout(() => setChromeVisible(false), autoHideMs);
  }, [anySheetOpen]);

  useEffect(() => { showChrome(3200); return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    if (!settings.autoNight) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => setNight(isNightNow());
    refresh();
    media.addEventListener?.("change", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { media.removeEventListener?.("change", refresh); window.clearInterval(timer); };
  }, [settings.autoNight]);

  useEffect(() => {
    let last = Date.now();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") { last = Date.now(); return; }
      const now = Date.now(); const seconds = Math.floor((now - last) / 1000);
      if (seconds > 0) addSeconds(seconds);
      last = now;
    }, 1000);
    return () => window.clearInterval(interval);
  }, [addSeconds]);

  useEffect(() => {
    if (!relocation.location) return;
    savePosition(relocation.location, relocation.percent);
    if (progressTimer.current) window.clearTimeout(progressTimer.current);
    progressTimer.current = window.setTimeout(() => onProgress?.(book.id, Math.round(relocation.percent * 100)), 700);
    return () => { if (progressTimer.current) window.clearTimeout(progressTimer.current); };
  }, [book.id, relocation.location, relocation.percent, savePosition, onProgress]);

  const onRelocated = useCallback((next: RelocatedInfo) => setRelocation(next), []);
  const onReaderReady = useCallback((readerApi: ReaderApi) => setApi(readerApi), []);

  const toggleBookmark = useCallback(() => {
    if (!location) return;
    const existing = byLocation.get(location);
    if (existing) removeBookmark(existing.id);
    else addBookmark(location, api?.visibleText?.().slice(0, 180), relocation.chapter?.label);
  }, [location, byLocation, removeBookmark, addBookmark, api, relocation.chapter?.label]);
  const navigate = (target: string) => { if (api) void api.display(target); };
  // Flat chapter list for prev/next: the footer chevrons step through it from the current chapter
  const flatToc = useMemo(() => { const out: TocItem[] = []; const walk = (items: TocItem[]) => items.forEach((t) => { out.push(t); if (t.subitems) walk(t.subitems); }); walk(toc); return out.filter((t) => t.cfi || t.href); }, [toc]);
  const chapterIndex = useMemo(() => {
    const href = relocation.chapter?.href; const label = relocation.chapter?.label;
    let i = flatToc.findIndex((t) => href && t.href && t.href.split("#")[0] === href.split("#")[0]);
    if (i < 0 && label) i = flatToc.findIndex((t) => t.label === label);
    return i;
  }, [flatToc, relocation.chapter?.href, relocation.chapter?.label]);
  const stepChapter = (dir: 1 | -1) => {
    if (!flatToc.length) return;
    // No chapter known yet: go to the first (next) or stay (prev)
    const target = chapterIndex < 0 ? (dir === 1 ? 0 : -1) : chapterIndex + dir;
    const item = flatToc[target];
    if (!item) return;
    navigate(item.cfi ?? item.href!);
    showChrome(2500);
  };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await shellRef.current?.requestFullscreen?.(); }
    catch { setFullscreen((v) => !v); }
  };
  useEffect(() => { const onChange = () => setFullscreen(!!document.fullscreenElement); document.addEventListener("fullscreenchange", onChange); return () => document.removeEventListener("fullscreenchange", onChange); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const openSearch = (query = "") => {
    setMenuOpen(false); setSearchOpen(true);
    if (query) window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>("[aria-label='Search book'] input");
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, query); input.dispatchEvent(new Event("input", { bubbles: true }));
    }, 50);
  };
  const readerTap = useCallback(() => {
    if (selectionRef.current) return;
    if (chromeVisible) hideChrome();
    else showChrome();
  }, [chromeVisible, showChrome, hideChrome]);
  const onSelection = (sel: SelectionInfo | null) => {
    setSelection(sel && sel.text.trim() ? sel : null);
    if (sel) hideChrome();
  };
  const addSelectedHighlight = (color: HighlightColor) => {
    if (!selection) return;
    addHighlight(selection.cfiRange, selection.text, color);
    api?.clearSelection?.(); setSelection(null);
  };
  const addSelectedNote = () => {
    if (!selection) return;
    const existing = highlights.find((item) => item.cfi_range === selection.cfiRange);
    const item = existing ?? addHighlight(selection.cfiRange, selection.text, "yellow");
    setNoteTarget({ id: item.id, text: item.note ?? "" });
    api?.clearSelection?.(); setSelection(null);
  };
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: "Copied" }); }
    catch { toast({ title: "Copy failed", description: "Clipboard permission was not granted.", variant: "destructive" }); }
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false); else if (settingsOpen) setSettingsOpen(false); else if (contentsOpen) setContentsOpen(false); else if (searchOpen) setSearchOpen(false); else if (musicOpen) setMusicOpen(false); else if (lookUp) setLookUp(null); else showChrome();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); pageTurnerRef.current?.turn(1); hideChrome(); return; }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); pageTurnerRef.current?.turn(-1); hideChrome(); return; }
      if (e.key.toLowerCase() === "b") toggleBookmark();
      else if (e.key.toLowerCase() === "s") setSearchOpen(true);
      else if (e.key.toLowerCase() === "t") setSettingsOpen(true);
      else if (e.key.toLowerCase() === "c") setContentsOpen(true);
      else if (e.key.toLowerCase() === "m") setMusicOpen(true);
      showChrome(2500);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [menuOpen, settingsOpen, contentsOpen, searchOpen, musicOpen, lookUp, showChrome, hideChrome, toggleBookmark]);

  const reader = useMemo(() => {
    // Only hand a reader a position saved by the same format; a stale one from another reader would fail to open
    const saved = hydrated ? position?.location ?? null : null;
    const epubStart = saved && saved.startsWith("epubcfi(") ? saved : null;
    const pageStart = saved && /^\d+$/.test(saved) ? saved : null;
    const textStart = saved && saved.startsWith("txt:") ? saved : null;
    if (isEpub && resolvedUrl) return <EpubReader fileUrl={resolvedUrl} locationsKey={book.id} settings={settings} theme={theme} initialLocation={epubStart} highlights={highlights} onReady={onReaderReady} onToc={setToc} onRelocated={onRelocated} onSelected={onSelection} onHighlightClick={(id, rect) => { const h = highlights.find((item) => item.id === id); if (h) setSelection({ cfiRange: h.cfi_range, text: h.text, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }); }} onTap={readerTap} onGesture={(phase, p) => pageTurnerRef.current?.feed(phase, p)} />;
    if (isPdf && resolvedUrl) return <PdfReader key={book.id} fileUrl={resolvedUrl} theme={theme} initialLocation={pageStart ?? String(Math.max(1, Math.round((book.progress / 100) * Math.max(1, book.totalPages))))} onReady={onReaderReady} onToc={setToc} onRelocated={onRelocated} onTap={readerTap} />;
    if (isPpt && resolvedUrl) return <PptReader key={book.id} fileUrl={resolvedUrl} theme={theme} initialLocation={pageStart} onReady={onReaderReady} onToc={setToc} onRelocated={onRelocated} onTap={readerTap} />;
    // File-backed books wait for their URL rather than falling through to the text reader
    if (book.fileUrl && (isEpub || isPdf || isPpt)) return <div className="flex h-full items-center justify-center text-sm" style={{ color: theme.muted }}>Preparing book…</div>;
    // Imported before format checks existed (MOBI, FB2, …): there is nothing we can render
    if (!isText && !(book.content && book.content.trim())) return <div className="flex h-full items-center justify-center px-6 text-center text-sm" style={{ color: theme.muted }}>This book is a {book.fileType?.toUpperCase() || "unknown"} file, which the reader can't open. Supported formats: {FORMAT_LABELS.join(", ")}. Remove it and import a converted copy.</div>;
    const text = book.content ?? SAMPLE;
    return <TextReader key={book.id} content={text} settings={settings} theme={theme} initialLocation={textStart} highlights={highlights} onReady={onReaderReady} onRelocated={onRelocated} onSelected={onSelection} onHighlightClick={(id, rect) => { const h = highlights.find((item) => item.id === id); if (h) setSelection({ cfiRange: h.cfi_range, text: h.text, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }); }} onTap={readerTap} />;
  }, [isEpub, isPdf, isPpt, isText, resolvedUrl, book.id, book.fileUrl, book.fileType, book.content, book.progress, book.totalPages, settings, theme, hydrated, position?.location, highlights, onReaderReady, onRelocated, readerTap]);

  if (resolving && book.fileType) return <div className="flex h-[75vh] items-center justify-center text-sm text-muted-foreground">Preparing book…</div>;

  // Portal: a transformed ancestor (tab fade) would otherwise become the containing block for `fixed`
  return createPortal(<>
    <ReaderChromeStyles />
    <div ref={shellRef} className="fixed inset-0 z-50 overflow-hidden" style={{ background: theme.bg, color: theme.fg }}>
      {resolveError ? <div className="flex h-full items-center justify-center p-6 text-sm">{resolveError}</div> : <PageTurner ref={pageTurnerRef} api={api} mode={pageTurn} turnSpeed={settings.turnSpeed} theme={theme} canNext={!relocation.atEnd} canPrev={!relocation.atStart} pageKey={`${relocation.location}|${theme.id}|${settings.fontId}|${settings.fontSize}|${settings.lineHeight}|${settings.bold}|${settings.margins}`} disabled={anySheetOpen || !!selection} onTapCenter={readerTap} onTurned={hideChrome}>{reader}</PageTurner>}
      {settings.brightness < 1 && <div className="pointer-events-none absolute inset-0 z-40 bg-black" style={{ opacity: 1 - settings.brightness }} />}
      <ReaderTopBar title={book.title} author={book.author} theme={theme} visible={chromeVisible && !selection} bookmarked={isBookmarked} onClose={onBackToLibrary} onBookmark={toggleBookmark} onContents={() => setContentsOpen(true)} onSettings={() => setSettingsOpen(true)} onMusic={() => setMusicOpen(true)} />
      <ReaderFooter theme={theme} visible={chromeVisible && !selection} location={location} relocation={relocation} onSeek={(p) => { void api?.display(p); }} onMenu={() => { setMenuOpen(true); setChromeVisible(true); }} canPrevChapter={flatToc.length > 0 && chapterIndex > 0} canNextChapter={flatToc.length > 0 && chapterIndex < flatToc.length - 1} onChapter={stepChapter} />
      <ReaderMenu open={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} onContents={() => { setMenuOpen(false); setContentsOpen(true); }} onSearch={() => { setMenuOpen(false); setSearchOpen(true); }} onSettings={() => { setMenuOpen(false); setSettingsOpen(true); }} onMusic={() => { setMenuOpen(false); setMusicOpen(true); }} onFullscreen={toggleFullscreen} onAssistant={() => { setMenuOpen(false); toast({ title: "Assistant", description: "Open the Assistant tab to continue with your book context." }); }} />
      <ThemesSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} update={update} theme={theme} capabilities={capabilities} formatLabel={formatInfo?.label} />
      <ContentsDrawer open={contentsOpen} onClose={() => setContentsOpen(false)} theme={theme} toc={toc} bookmarks={bookmarks} highlights={highlights} currentLocation={location} currentChapter={relocation.chapter} onNavigate={navigate} onRemoveBookmark={removeBookmark} onRemoveHighlight={removeHighlight} />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} theme={theme} api={api} onNavigate={navigate} />
      <MusicSheet open={musicOpen} onClose={() => setMusicOpen(false)} theme={theme} />
      <SelectionMenu selection={selection} theme={theme} onHighlight={addSelectedHighlight} onNote={addSelectedNote} onLookUp={(word, context) => setLookUp({ word, context })} onCopy={copyText} onSearch={openSearch} onClose={() => { api?.clearSelection?.(); setSelection(null); }} />
      {noteTarget && <NoteSheet open text={noteTarget.text} theme={theme} onClose={() => setNoteTarget(null)} onSave={(note) => updateHighlight(noteTarget.id, { note })} />}
      {lookUp && <LookUpSheet open word={lookUp.word} context={lookUp.context} theme={theme} onClose={() => setLookUp(null)} onAskAI={() => toast({ title: "Ask the assistant", description: "Open the Assistant tab to continue with this passage." })} />}
      <span className="sr-only" aria-live="polite">Page {relocation.page} of {relocation.totalPages || "unknown"}</span>
    </div>
  </>, document.body);
}