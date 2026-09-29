import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Settings,
  Play,
  Pause,
  BookOpen,
  Clock,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  List,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Type,
  Plus,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignJustify
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useReadingStats } from "@/hooks/use-reading-stats";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useResolvedFileUrl } from "@/hooks/use-resolved-file-url";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PdfReader } from "@/components/readers/PdfReader";
import { EpubReader } from "@/components/readers/EpubReader";
import { TextFlipBook } from "@/components/readers/TextFlipBook";
import { PptReader } from "@/components/readers/PptReader";
import { DocxReader } from "@/components/readers/DocxReader";

// Loading skeleton component
const ReaderSkeleton = () => (
  <div className="w-full h-full flex items-center justify-center border border-border bg-card">
    <div className="space-y-3 w-full max-w-2xl px-8">
      {[100, 96, 92, 98, 60].map((w, i) => (
        <div key={i} className="h-3 bg-muted animate-pulse" style={{ width: `${w}%` }} />
      ))}
      <p className="eyebrow pt-6">Loading</p>
    </div>
  </div>
);


interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  content?: string;
  fileUrl?: string;
  fileType?: string;
}

// Animation types
type PageAnimation = 'slide' | 'fade' | 'curl' | 'none';

interface TypographySettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing: number;
  wordSpacing: number;
  paragraphSpacing: number;
  textAlign: 'left' | 'justify' | 'center';
  hyphenation: boolean;
}

interface ReadingInterfaceProps {
  book: BookItem;
  onBackToLibrary: () => void;
}

export const ReadingInterface = ({ book, onBackToLibrary }: ReadingInterfaceProps) => {
  const [isReading, setIsReading] = useState(false);
  const [readingTime, setReadingTime] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Page animation state
  const [pageAnimation, setPageAnimation] = useState<PageAnimation>('slide');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  // Typography settings
  const [typography, setTypography] = useState<TypographySettings>({
    fontSize: 18,
    lineHeight: 1.8,
    fontFamily: 'georgia',
    letterSpacing: 0,
    wordSpacing: 0,
    paragraphSpacing: 1.5,
    textAlign: 'left',
    hyphenation: false,
  });

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const readingAreaRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { toast } = useToast();
  const { addSeconds } = useReadingStats();
  const [chaptersOpen, setChaptersOpen] = useState(false);

  // Sample content for demonstration
  const sampleContent = book.content || `
    Chapter 1: The Art of Mindful Reading

    In our fast-paced digital world, the act of reading has become increasingly rushed and fragmented. We skim through articles, jump between notifications, and rarely give ourselves the gift of deep, contemplative reading.

    This book explores how we can transform reading from a mere consumption of information into a ritual of mindfulness—a practice that nourishes the soul and cultivates inner peace.

    The journey begins with understanding that reading is not just about absorbing words on a page. It's about creating a sacred space for reflection, contemplation, and growth. When we approach reading as a ritual, we honor both the author's wisdom and our own capacity for understanding.

    Consider the last time you truly lost yourself in a book. Remember that feeling of being completely absorbed, where time seemed to stand still, and the outside world faded away. This is the state we seek to cultivate—not as an accident, but as an intentional practice.

    Mindful reading requires us to slow down, to savor each paragraph, and to allow the author's words to resonate within us. It means creating boundaries around our reading time, protecting it from the constant interruptions of modern life.

    As we embark on this journey together, remember that every page turned mindfully is a step toward greater awareness, deeper understanding, and a more enriched inner life.
  `;

  const totalWords = sampleContent.split(' ').length;
  const wordsPerPage = 300;
  const computedTextPages = Math.ceil(totalWords / wordsPerPage);
  const [docPageCount, setDocPageCount] = useState<number | null>(null);
  const effectiveTotalPages = book.fileType ? (docPageCount || book.totalPages || 1) : computedTextPages;

  // TOC / Outline state
  const [epubToc, setEpubToc] = useState<Array<{ label: string; href?: string; cfi?: string }>>([]);
  const [pdfOutline, setPdfOutline] = useState<Array<{ title: string; pageNumber: number }>>([]);
  const [gotoEpub, setGotoEpub] = useState<{ cfi?: string; href?: string } | null>(null);
  const [gotoPdfPage, setGotoPdfPage] = useState<number | null>(null);
  const [pageText, setPageText] = useState<string>("");

  // Resolve Supabase storage URLs to signed HTTP URLs when needed
  const { url: resolvedUrl, resolving: resolvingFile, error: resolveError } = useResolvedFileUrl(book.fileUrl);

  // Reset pagination and counters when switching books
  useEffect(() => {
    setCurrentPage(1);
    setDocPageCount(null);
    setEpubToc([]);
    setPdfOutline([]);
    setGotoEpub(null);
    setGotoPdfPage(null);
    // Bring reader into view and focus when a book opens
    setTimeout(() => {
      try {
        readingAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        readingAreaRef.current?.focus?.();
      } catch { }
    }, 0);
  }, [book.id]);

  // Fullscreen API handlers
  const toggleFullscreen = async () => {
    if (!fullscreenContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await fullscreenContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
        toast({
          title: "Fullscreen Mode",
          description: "Press F or ESC to exit fullscreen",
        });
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      // Fallback for devices that don't support fullscreen API
      setIsFullscreen(!isFullscreen);
      if (!isFullscreen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        document.body.style.overflow = '';
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.style.overflow = '';
    };
  }, []);

  // Reading session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReading) {
      interval = setInterval(() => {
        setReadingTime(prev => prev + 1);
        addSeconds(1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isReading, addSeconds]);

  // Keep page text context updated for plain text books
  useEffect(() => {
    if (!book.fileType) {
      try {
        setPageText(getTextPageContent(currentPage));
      } catch { }
    }
  }, [book.fileType, currentPage, sampleContent, wordsPerPage]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startReading = () => {
    setIsReading(true);
    toast({
      title: "Reading Session Started",
      description: "Focus mode activated. Enjoy your mindful reading!",
    });
  };

  const pauseReading = () => {
    setIsReading(false);
    toast({
      title: "Reading Session Paused",
      description: `Great work! You've read for ${formatTime(readingTime)}.`,
    });
  };

  const getTextPageContent = (pageNumber: number) => {
    const words = sampleContent.split(' ');
    const startIndex = (pageNumber - 1) * wordsPerPage;
    const endIndex = Math.min(startIndex + wordsPerPage, words.length);
    return words.slice(startIndex, endIndex).join(' ');
  };

  const clampPage = (n: number) => Math.min(Math.max(1, n), effectiveTotalPages);

  const renderPageContent = (pageNumber: number) => {
    console.log('ReadingInterface: Rendering page content for book:', {
      title: book.title,
      fileType: book.fileType,
      fileUrl: book.fileUrl,
      hasFileUrl: !!book.fileUrl
    });

    // Prefer resolved URL when available
    const displayUrl = resolvedUrl || book.fileUrl;

    if (resolveError) {
      return (
        <div className="text-sm text-destructive px-4">{resolveError}</div>
      );
    }

    if (resolvingFile && book.fileType) {
      return (
        <div className="text-sm text-muted-foreground px-4">Preparing file…</div>
      );
    }

    if (book.fileType === 'pdf' && displayUrl) {
      console.log('ReadingInterface: Rendering PDF reader with URL:', displayUrl);
      return (
        <div className="h-full">
          <PdfReader fileUrl={displayUrl} page={clampPage(pageNumber)} onPageCount={setDocPageCount} onOutline={setPdfOutline} gotoPage={gotoPdfPage} onPageText={setPageText} />
        </div>
      );
    }
    if (book.fileType === 'epub' && displayUrl) {
      console.log('ReadingInterface: Rendering EPUB reader with URL:', displayUrl);
      return (
        <div className="h-full">
          <EpubReader fileUrl={displayUrl} page={clampPage(pageNumber)} onPageCount={setDocPageCount} onToc={setEpubToc} goto={gotoEpub} onRenderedText={setPageText} />
        </div>
      );
    }
    if (book.fileType === 'pptx' && displayUrl) {
      console.log('ReadingInterface: Rendering PowerPoint with URL:', displayUrl);
      return (
        <div className="h-full">
          <PptReader fileUrl={displayUrl} page={clampPage(pageNumber)} onPageCount={setDocPageCount} onPageText={setPageText} />
        </div>
      );
    }
    if (book.fileType === 'docx') {
      console.log('ReadingInterface: Rendering DOCX content');
      return (
        <div className="h-full">
          <DocxReader content={book.content || ''} page={clampPage(pageNumber)} onPageCount={setDocPageCount} onPageText={setPageText} />
        </div>
      );
    }
    return (
      <TextFlipBook
        content={sampleContent}
        wordsPerPage={wordsPerPage}
        currentPage={clampPage(pageNumber)}
        onPageChange={(p) => setCurrentPage(clampPage(p))}
      />
    );
  };

  const handlePageChange = (newPage: number, direction: 'next' | 'prev') => {
    if (newPage < 1 || newPage > effectiveTotalPages || isAnimating) return;

    // Apply animation if enabled
    if (pageAnimation !== 'none') {
      setIsAnimating(true);

      // Determine animation based on direction and type
      let exitClass = '';
      let enterClass = '';

      switch (pageAnimation) {
        case 'slide':
          exitClass = direction === 'next' ? 'page-slide-left' : 'page-slide-right';
          enterClass = direction === 'next' ? 'page-slide-in-right' : 'page-slide-in-left';
          break;
        case 'fade':
          exitClass = 'page-fade-out';
          enterClass = 'page-fade-in';
          break;
        case 'curl':
          exitClass = direction === 'next' ? 'page-curl-left' : 'page-curl-right';
          enterClass = 'page-fade-in';
          break;
      }

      // Apply exit animation
      setAnimationClass(exitClass);

      // Wait for exit animation to complete
      const exitDuration = pageAnimation === 'curl' ? 500 : pageAnimation === 'slide' ? 400 : 300;

      setTimeout(() => {
        setCurrentPage(newPage);
        setGotoPdfPage(null);
        setGotoEpub(null);
        setAnimationClass(enterClass);

        // Reset after enter animation
        setTimeout(() => {
          setAnimationClass('');
          setIsAnimating(false);
        }, exitDuration);
      }, exitDuration);
    } else {
      // No animation
      setCurrentPage(newPage);
      setGotoPdfPage(null);
      setGotoEpub(null);
    }
  };

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) handlePageChange(currentPage - 1, 'prev');
      else handlePageChange(currentPage + 1, 'next');
    }
    touchStartRef.current = null;
  };

  // Keyboard navigation and shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        handlePageChange(currentPage - 1, 'prev');
      } else if (e.key === 'ArrowRight') {
        handlePageChange(currentPage + 1, 'next');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, effectiveTotalPages, isFullscreen]);

  // Derived chapters list
  const chapters = (() => {
    if (book.fileType === 'epub') {
      return epubToc.map((t, idx) => ({ id: `epub-${idx}`, label: t.label || `Chapter ${idx + 1}`, href: t.href, cfi: t.cfi }));
    }
    if (book.fileType === 'pdf') {
      return pdfOutline.map((o, idx) => ({ id: `pdf-${idx}`, label: o.title || `Chapter ${idx + 1}`, page: o.pageNumber }));
    }
    // basic text heuristics: split by lines that start with Chapter
    const lines = sampleContent.split('\n');
    const textChapters: Array<{ id: string; label: string; page: number }> = [];
    let pageCounter = 1;
    let wordCounter = 0;
    for (const line of lines) {
      if (/^\s*Chapter\s+\d+/i.test(line)) {
        textChapters.push({ id: `txt-${textChapters.length}`, label: line.trim(), page: Math.max(1, Math.ceil(wordCounter / wordsPerPage)) });
      }
      const wordsInLine = line.trim().split(/\s+/).filter(Boolean).length;
      wordCounter += wordsInLine;
      pageCounter = Math.max(pageCounter, Math.ceil(wordCounter / wordsPerPage));
    }
    return textChapters;
  })();

  const handleChapterClick = (chap: any) => {
    if (book.fileType === 'epub') {
      setGotoEpub(chap.cfi ? { cfi: chap.cfi } : (chap.href ? { href: chap.href } : null));
    } else if (book.fileType === 'pdf') {
      if (typeof chap.page === 'number') {
        setGotoPdfPage(chap.page);
        setCurrentPage(chap.page);
      }
    } else {
      if (typeof chap.page === 'number') setCurrentPage(chap.page);
    }
  };

  // Helper function to update typography
  const updateTypography = (key: keyof TypographySettings, value: any) => {
    setTypography(prev => ({ ...prev, [key]: value }));
  };

  // Font family mapping
  const getFontFamily = (font: string) => {
    const fonts: Record<string, string> = {
      georgia: "'Georgia', serif",
      literata: "'Literata', serif",
      merriweather: "'Merriweather', serif",
      inter: "'Inter', sans-serif",
      system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    };
    return fonts[font] || fonts.georgia;
  };

  // Typography presets
  const typographyPresets = {
    compact: {
      fontSize: 14,
      lineHeight: 1.4,
      letterSpacing: 0,
      wordSpacing: 0,
      paragraphSpacing: 1.0,
      textAlign: 'left' as const,
    },
    comfortable: {
      fontSize: 18,
      lineHeight: 1.8,
      letterSpacing: 0,
      wordSpacing: 0,
      paragraphSpacing: 1.5,
      textAlign: 'left' as const,
    },
    large: {
      fontSize: 24,
      lineHeight: 2.0,
      letterSpacing: 1,
      wordSpacing: 2,
      paragraphSpacing: 2.0,
      textAlign: 'left' as const,
    },
    dyslexic: {
      fontSize: 20,
      lineHeight: 2.2,
      letterSpacing: 2,
      wordSpacing: 4,
      paragraphSpacing: 2.0,
      textAlign: 'left' as const,
      fontFamily: 'inter',
    },
  };

  const applyPreset = (preset: keyof typeof typographyPresets) => {
    setTypography(prev => ({
      ...prev,
      ...typographyPresets[preset],
    }));
  };

  return (
    <div ref={fullscreenContainerRef} className={cn("max-w-6xl mx-auto space-y-5 pb-[env(safe-area-inset-bottom)]", isFullscreen && "fullscreen-reader bg-background p-4")}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBackToLibrary} className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Library
          </Button>
          <div className="min-w-0 border-l border-border pl-4">
            <h1 className="font-serif text-xl leading-tight truncate">{book.title}</h1>
            <p className="eyebrow truncate">{book.author}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <span className={cn("eyebrow tabular-nums mr-3", isReading && "text-foreground")}>{formatTime(readingTime)}</span>
          <Button size="sm" variant={isReading ? "outline" : "default"} onClick={isReading ? pauseReading : startReading}>
            {isReading ? (<><Pause className="w-4 h-4" />Pause</>) : (<><Play className="w-4 h-4" />Start session</>)}
          </Button>
          <span className="h-5 w-px bg-border mx-2" />
          <Button variant="ghost" size="sm" onClick={() => setChaptersOpen(true)}>
            <List className="w-4 h-4" />
            Chapters
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
            <Type className="w-4 h-4" />
            Type
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Chapters Sheet */}
      <Sheet open={chaptersOpen} onOpenChange={setChaptersOpen}>
        <SheetContent side="left" className="w-[320px] sm:w-[380px]">
          <SheetHeader>
            <SheetTitle>Chapters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-px">
            {chapters.length === 0 ? (
              <div className="text-sm text-muted-foreground">No chapters detected.</div>
            ) : chapters.map((c, i) => (
              <button
                key={c.id}
                className="w-full text-left text-sm py-2.5 border-b border-border hover:text-foreground text-foreground/80 transition-colors flex gap-3"
                onClick={() => { handleChapterClick(c); setChaptersOpen(false); }}
              >
                <span className="font-mono text-[11px] text-muted-foreground w-6 shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="display text-3xl">Type &amp; layout</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Font Size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Font Size</Label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateTypography('fontSize', Math.max(12, typography.fontSize - 2))}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Badge variant="outline" className="w-16 justify-center">
                    {typography.fontSize}px
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateTypography('fontSize', Math.min(32, typography.fontSize + 2))}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Slider
                value={[typography.fontSize]}
                onValueChange={([val]) => updateTypography('fontSize', val)}
                min={12}
                max={32}
                step={2}
              />
            </div>

            {/* Line Height */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Spacing</Label>
                <Badge variant="outline">{typography.lineHeight.toFixed(1)}</Badge>
              </div>
              <Slider
                value={[typography.lineHeight]}
                onValueChange={([val]) => updateTypography('lineHeight', val)}
                min={1.0}
                max={3.0}
                step={0.1}
              />
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>Compact</span>
                <span>Normal</span>
                <span>Relaxed</span>
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={typography.fontFamily}
                onValueChange={(val) => updateTypography('fontFamily', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="georgia">Georgia (Serif)</SelectItem>
                  <SelectItem value="literata">Literata (Serif)</SelectItem>
                  <SelectItem value="merriweather">Merriweather (Serif)</SelectItem>
                  <SelectItem value="inter">Inter (Sans)</SelectItem>
                  <SelectItem value="system">System Default</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Letter Spacing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Letter Spacing</Label>
                <Badge variant="outline">{typography.letterSpacing}px</Badge>
              </div>
              <Slider
                value={[typography.letterSpacing]}
                onValueChange={([val]) => updateTypography('letterSpacing', val)}
                min={-2}
                max={4}
                step={0.5}
              />
            </div>

            {/* Word Spacing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Word Spacing</Label>
                <Badge variant="outline">{typography.wordSpacing}px</Badge>
              </div>
              <Slider
                value={[typography.wordSpacing]}
                onValueChange={([val]) => updateTypography('wordSpacing', val)}
                min={0}
                max={8}
                step={1}
              />
            </div>

            {/* Paragraph Spacing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Paragraph Spacing</Label>
                <Badge variant="outline">{typography.paragraphSpacing.toFixed(1)}em</Badge>
              </div>
              <Slider
                value={[typography.paragraphSpacing]}
                onValueChange={([val]) => updateTypography('paragraphSpacing', val)}
                min={0.5}
                max={3.0}
                step={0.25}
              />
            </div>

            {/* Text Alignment */}
            <div className="space-y-2">
              <Label>Text Alignment</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={typography.textAlign === 'left' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateTypography('textAlign', 'left')}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={typography.textAlign === 'center' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateTypography('textAlign', 'center')}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant={typography.textAlign === 'justify' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateTypography('textAlign', 'justify')}
                >
                  <AlignJustify className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Hyphenation */}
            <div className="flex items-center justify-between">
              <Label>Auto-Hyphenation</Label>
              <Switch
                checked={typography.hyphenation}
                onCheckedChange={(checked) => updateTypography('hyphenation', checked)}
              />
            </div>

            {/* Page Animation */}
            <div className="space-y-2">
              <Label>Page Turn Animation</Label>
              <Select value={pageAnimation} onValueChange={(v) => setPageAnimation(v as PageAnimation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slide">Slide (Smooth)</SelectItem>
                  <SelectItem value="fade">Fade (Quick)</SelectItem>
                  <SelectItem value="curl">Curl (Paper-like)</SelectItem>
                  <SelectItem value="none">None (Instant)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <Label>Typography Presets</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('compact')}
                >
                  Compact
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('comfortable')}
                >
                  Comfortable
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('large')}
                >
                  Large Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('dyslexic')}
                >
                  Dyslexia
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reading Progress */}
      <div className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>Page <span className="text-foreground">{currentPage}</span> of {effectiveTotalPages}</span>
        <Progress value={(currentPage / effectiveTotalPages) * 100} className="flex-1 max-w-md" />
        <span className="text-foreground tabular-nums">{Math.round((currentPage / effectiveTotalPages) * 100)}%</span>
      </div>

      {/* Reading Content */}
      <div className="relative">
        {/* Main Reading Content */}
        <div
          ref={readingAreaRef}
          className={cn(
            "relative h-[85vh] md:h-[80vh] lg:h-[75vh] xl:h-[70vh] animate-page-fade cursor-pointer select-none z-[1]",
            animationClass
          )}
          style={{
            fontSize: `${typography.fontSize}px`,
            lineHeight: typography.lineHeight,
            fontFamily: getFontFamily(typography.fontFamily),
            letterSpacing: `${typography.letterSpacing}px`,
            wordSpacing: `${typography.wordSpacing}px`,
            textAlign: typography.textAlign,
          }}
          tabIndex={-1}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={cn("h-full overflow-hidden border bg-card transition-colors", isReading ? "border-foreground" : "border-border")}
            style={{
              hyphens: typography.hyphenation ? 'auto' : 'none',
            }}
          >
            <style>{`
              .reading-content p {
                margin-bottom: ${typography.paragraphSpacing}em;
              }
            `}</style>
            <div className="reading-content h-full">
              {renderPageContent(currentPage)}
            </div>
          </div>

          {/* Click/Tap zones */}
          <button aria-label="Previous page" className="absolute top-0 left-0 bottom-24 md:bottom-0 w-1/2 md:w-1/3 z-10 cursor-pointer opacity-0" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1} />
          <button aria-label="Next page" className="absolute top-0 right-0 bottom-24 md:bottom-0 w-1/2 md:w-1/3 z-10 cursor-pointer opacity-0" onClick={() => handlePageChange(currentPage + 1, 'next')} disabled={currentPage === effectiveTotalPages} />
        </div>


      </div>

      {/* Page Navigation (desktop) */}
      <div className="hidden md:flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1}>
          <ChevronLeft className="w-4 h-4" />Previous
        </Button>
        <div className="flex items-center gap-1 font-mono text-xs">
          {Array.from({ length: Math.min(5, effectiveTotalPages) }, (_, i) => {
            const pageNumber = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
            if (pageNumber > effectiveTotalPages) return null;
            return (
              <button
                key={pageNumber}
                onClick={() => handlePageChange(pageNumber, pageNumber > currentPage ? 'next' : 'prev')}
                className={cn("h-8 min-w-8 px-2 tabular-nums transition-colors", pageNumber === currentPage ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                aria-current={pageNumber === currentPage ? "page" : undefined}
              >
                {pageNumber}
              </button>
            );
          })}
          {effectiveTotalPages > 5 && currentPage < effectiveTotalPages - 2 && (
            <>
              <span className="text-muted-foreground px-1">…</span>
              <button onClick={() => handlePageChange(effectiveTotalPages, 'next')} className="h-8 min-w-8 px-2 tabular-nums text-muted-foreground hover:text-foreground">{effectiveTotalPages}</button>
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => handlePageChange(currentPage + 1, 'next')} disabled={currentPage === effectiveTotalPages}>
          Next<ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Mobile bottom toolbar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-background border-t border-border">
        <div className="container mx-auto px-3 py-2 flex items-center justify-between gap-3">
          <Button size="sm" variant="ghost" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1} className="h-11 w-11 p-0">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={isReading ? "outline" : "default"} className="h-10" onClick={isReading ? pauseReading : startReading}>
              {isReading ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isReading ? formatTime(readingTime) : "Start"}
            </Button>
            <Button size="sm" variant="ghost" className="h-10" onClick={() => setChaptersOpen(true)}>
              <List className="w-5 h-5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-10" onClick={() => setSettingsOpen(true)}>
              <Type className="w-5 h-5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-10" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => handlePageChange(currentPage + 1, 'next')} disabled={currentPage === effectiveTotalPages} className="h-11 w-11 p-0">
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};