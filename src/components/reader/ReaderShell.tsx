import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { useReadingStats } from "@/hooks/use-reading-stats";
import { useBookmarks, useHighlights, useReaderSettings, useReadingPosition, type HighlightColor } from "@/hooks/use-reader-store";
import { DEFAULT_SETTINGS, isNightNow, resolveTheme } from "@/lib/reader-themes";
import { ReaderMenu, ReaderTopBar, ReaderFooter, ThemesSettingsSheet, ContentsDrawer, SearchSheet, SelectionMenu, NoteSheet, LookUpSheet, ReaderChromeStyles } from "./ReaderOverlays";
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

export function ReaderShell({ book, onBackToLibrary, onProgress }: ReaderShellProps) {
  const { settings: savedSettings, update } = useReaderSettings();
  const settings = savedSettings ?? DEFAULT_SETTINGS;
  const [nightClock, setNightClock] = useState(0);
  const theme = useMemo(() => resolveTheme(settings, isNightNow()), [settings, nightClock]);
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
  const [chromeVisible, setChromeVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const pageTurnerRef = useRef<PageTurnerHandle>(null);
  const hideTimer = useRef<number>();
  const progressTimer = useRef<number>();
  const selectionRef = useRef<SelectionInfo | null>(null);
  selectionRef.current = selection;
  const { url: resolvedUrl, resolving, error: resolveError } = useResolvedFileUrl(book.fileUrl);
  const fileType = (book.fileType ?? "txt").toLowerCase();
  const isEpub = fileType === "epub";
  const isPdf = fileType === "pdf";
  const isPpt = fileType === "pptx";
  const location = relocation.location || position?.location || null;
  const isBookmarked = !!location && byLocation.has(location);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (!menuOpen && !settingsOpen && !contentsOpen && !searchOpen && !lookUp) hideTimer.current = window.setTimeout(() => setChromeVisible(false), 2800);
  }, [menuOpen, settingsOpen, contentsOpen, searchOpen, lookUp]);

  useEffect(() => { showChrome(); return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }; }, [book.id, showChrome]);

  useEffect(() => {
    if (!settings.autoNight) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => setNightClock((n) => n + 1);
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
  const onPptPageCount = useCallback((count: number) => setRelocation((r) => ({ ...r, totalPages: count })), []);
  const snapshotKey = `${relocation.location}|${theme.id}|${settings.fontId}|${settings.fontSize}|${settings.lineHeight}|${settings.letterSpacing}|${settings.bold}`;

  const toggleBookmark = () => {
    if (!location) return;
    const existing = byLocation.get(location);
    if (existing) removeBookmark(existing.id);
    else addBookmark(location, api?.visibleText?.().slice(0, 180), relocation.chapter?.label);
  };
  const navigate = (target: string) => { if (api) void api.display(target); };
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
    if (chromeVisible) { setChromeVisible(false); if (hideTimer.current) window.clearTimeout(hideTimer.current); }
    else showChrome();
  }, [chromeVisible, showChrome]);
  const onSelection = (sel: SelectionInfo | null) => {
    setSelection(sel && sel.text.trim() ? sel : null);
    if (sel) { setChromeVisible(false); if (hideTimer.current) window.clearTimeout(hideTimer.current); }
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
        if (menuOpen) setMenuOpen(false); else if (settingsOpen) setSettingsOpen(false); else if (contentsOpen) setContentsOpen(false); else if (searchOpen) setSearchOpen(false); else if (lookUp) setLookUp(null); else showChrome();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); pageTurnerRef.current?.turn(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); pageTurnerRef.current?.turn(-1); }
      else if (e.key.toLowerCase() === "b") toggleBookmark();
      else if (e.key.toLowerCase() === "s") setSearchOpen(true);
      else if (e.key.toLowerCase() === "t") setSettingsOpen(true);
      showChrome();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [menuOpen, settingsOpen, contentsOpen, searchOpen, lookUp, api, location, bookmarks, showChrome]);

  const reader = useMemo(() => {
    if (isEpub && resolvedUrl) return <EpubReader fileUrl={resolvedUrl} settings={settings} theme={theme} initialLocation={hydrated ? position?.location : null} highlights={highlights} onReady={onReaderReady} onToc={setToc} onRelocated={onRelocated} onSelected={onSelection} onHighlightClick={(id, rect) => { const h = highlights.find((item) => item.id === id); if (h) setSelection({ cfiRange: h.cfi_range, text: h.text, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }); }} onTap={readerTap} />;
    if (isPdf && resolvedUrl) return <PdfReader key={book.id} fileUrl={resolvedUrl} theme={theme} initialLocation={hydrated ? position?.location : String(Math.max(1, Math.round((book.progress / 100) * Math.max(1, book.totalPages))))} onReady={onReaderReady} onToc={setToc} onRelocated={onRelocated} onTap={readerTap} />;
    if (isPpt && resolvedUrl) return <PptReader fileUrl={resolvedUrl} page={relocation.page} onPageCount={onPptPageCount} />;
    const text = book.content ?? SAMPLE;
    return <TextReader key={book.id} content={text} settings={settings} theme={theme} initialLocation={hydrated ? position?.location : null} highlights={highlights} onReady={onReaderReady} onRelocated={onRelocated} onSelected={onSelection} onHighlightClick={(id, rect) => { const h = highlights.find((item) => item.id === id); if (h) setSelection({ cfiRange: h.cfi_range, text: h.text, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }); }} onTap={readerTap} />;
  }, [isEpub, isPdf, isPpt, resolvedUrl, book.id, book.content, book.progress, book.totalPages, settings, theme, hydrated, position?.location, highlights, onReaderReady, onPptPageCount, onRelocated, relocation.page, readerTap]);

  if (resolving && book.fileType) return <div className="flex h-[75vh] items-center justify-center text-sm text-muted-foreground">Preparing book…</div>;

  // Portal: a transformed ancestor (tab fade) would otherwise become the containing block for `fixed`
  return createPortal(<>
    <ReaderChromeStyles />
    <div ref={shellRef} className="fixed inset-0 z-50 overflow-hidden" style={{ background: theme.bg, color: theme.fg }}>
      {resolveError ? <div className="flex h-full items-center justify-center p-6 text-sm">{resolveError}</div> : <PageTurner ref={pageTurnerRef} api={api} mode={settings.pageTurn} theme={theme} canNext={!relocation.atEnd} canPrev={!relocation.atStart} snapshotKey={snapshotKey} disabled={menuOpen || settingsOpen || contentsOpen || searchOpen || !!lookUp || !!selection} onTapCenter={readerTap} onTurned={showChrome}>{reader}</PageTurner>}
      {settings.brightness < 1 && <div className="pointer-events-none absolute inset-0 z-40 bg-black" style={{ opacity: 1 - settings.brightness }} />}
      <ReaderTopBar title={book.title} author={book.author} theme={theme} visible={chromeVisible && !selection} bookmarked={isBookmarked} onClose={onBackToLibrary} onBookmark={toggleBookmark} />
      <ReaderFooter theme={theme} visible={chromeVisible && !selection} location={location} relocation={relocation} onSeek={(p) => { void api?.display(p); }} onMenu={() => { setMenuOpen(true); setChromeVisible(true); }} />
      <ReaderMenu open={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} onContents={() => { setMenuOpen(false); setContentsOpen(true); }} onSearch={() => { setMenuOpen(false); setSearchOpen(true); }} onSettings={() => { setMenuOpen(false); setSettingsOpen(true); }} onFullscreen={toggleFullscreen} onAssistant={() => { setMenuOpen(false); toast({ title: "Assistant", description: "Open the Assistant tab to continue with your book context." }); }} />
      <ThemesSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} update={update} theme={theme} />
      <ContentsDrawer open={contentsOpen} onClose={() => setContentsOpen(false)} theme={theme} toc={toc} bookmarks={bookmarks} highlights={highlights} currentLocation={location} onNavigate={navigate} onRemoveBookmark={removeBookmark} onRemoveHighlight={removeHighlight} />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} theme={theme} api={api} onNavigate={navigate} />
      <SelectionMenu selection={selection} theme={theme} onHighlight={addSelectedHighlight} onNote={addSelectedNote} onLookUp={(word, context) => setLookUp({ word, context })} onCopy={copyText} onSearch={openSearch} onClose={() => { api?.clearSelection?.(); setSelection(null); }} />
      {noteTarget && <NoteSheet open text={noteTarget.text} theme={theme} onClose={() => setNoteTarget(null)} onSave={(note) => updateHighlight(noteTarget.id, { note })} />}
      {lookUp && <LookUpSheet open word={lookUp.word} context={lookUp.context} theme={theme} onClose={() => setLookUp(null)} onAskAI={() => toast({ title: "Ask the assistant", description: "Open the Assistant tab to continue with this passage." })} />}
      <span className="sr-only" aria-live="polite">Page {relocation.page} of {relocation.totalPages || "unknown"}</span>
    </div>
  </>, document.body);
}