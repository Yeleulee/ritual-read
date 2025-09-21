import { useState, useEffect, useRef } from "react";
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
  Minimize2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PdfReader } from "@/components/readers/PdfReader";
import { EpubReader } from "@/components/readers/EpubReader";
import { TextFlipBook } from "@/components/readers/TextFlipBook";
import { AiChat } from "@/components/AiChat";
import { useReadingStats } from "@/hooks/use-reading-stats";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useResolvedFileUrl } from "@/hooks/use-resolved-file-url";
 

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

interface ReadingInterfaceProps {
  book: BookItem;
  onBackToLibrary: () => void;
}

export const ReadingInterface = ({ book, onBackToLibrary }: ReadingInterfaceProps) => {
  const [isReading, setIsReading] = useState(false);
  const [readingTime, setReadingTime] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [currentPage, setCurrentPage] = useState(1);
  // Simplified: remove flip animations
  const readingAreaRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { toast } = useToast();
  const { addSeconds } = useReadingStats();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [mobileFullscreen, setMobileFullscreen] = useState(false);

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
      } catch {}
    }, 0);
  }, [book.id]);

  // Lock body scroll when mobile fullscreen is active
  useEffect(() => {
    if (mobileFullscreen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileFullscreen]);

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
      } catch {}
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
    return (
      <TextFlipBook
        content={sampleContent}
        wordsPerPage={wordsPerPage}
        currentPage={clampPage(pageNumber)}
        onPageChange={(p) => setCurrentPage(clampPage(p))}
      />
    );
  };

  const handlePageChange = (newPage: number, _direction: 'next' | 'prev') => {
    if (newPage < 1 || newPage > effectiveTotalPages) return;
      setCurrentPage(newPage);
    // clear goto for pdf/epub so manual nav resumes normal
    setGotoPdfPage(null);
    setGotoEpub(null);
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePageChange(currentPage - 1, 'prev');
      } else if (e.key === 'ArrowRight') {
        handlePageChange(currentPage + 1, 'next');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, effectiveTotalPages]);

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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-[env(safe-area-inset-bottom)]">
      {/* Reading Header */}
      <div className="flex items-center justify-between animate-page-fade gap-3 flex-wrap">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onBackToLibrary}
            className="transition-ritual hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Library
          </Button>
          <div>
            <h1 className="text-2xl font-bold ritual-heading" style={{ WebkitTextFillColor: 'unset' }}>{book.title}</h1>
            <p className="text-muted-foreground">by {book.author}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {formatTime(readingTime)}
          </Badge>
          <Button
            variant={isReading ? "destructive" : "ritual"}
            onClick={isReading ? pauseReading : startReading}
          >
            {isReading ? (<><Pause className="w-4 h-4 mr-2" />Pause</>) : (<><Play className="w-4 h-4 mr-2" />Start Reading</>)}
          </Button>
          <Button variant="outline" size="sm" className="transition-ritual">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant={chaptersOpen ? "destructive" : "outline"} size="sm" className="transition-ritual" onClick={() => setChaptersOpen(true)}>
            <BookOpen className="w-4 h-4 mr-2" />
            Chapters
          </Button>
          <Button variant={assistantOpen ? "destructive" : "outline"} size="sm" className="transition-ritual" onClick={() => setAssistantOpen(v => !v)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            {assistantOpen ? 'Close Assistant' : 'Ask AI'}
          </Button>
        </div>
      </div>

      {/* Chapters Sheet */}
      <Sheet open={chaptersOpen} onOpenChange={setChaptersOpen}>
        <SheetContent side="left" className="w-[320px] sm:w-[380px]">
          <SheetHeader>
            <SheetTitle>Chapters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {chapters.length === 0 ? (
              <div className="text-sm text-muted-foreground">No chapters detected.</div>
            ) : chapters.map((c) => (
              <button
                key={c.id}
                className="w-full text-left text-sm p-2 rounded hover:bg-muted transition"
                onClick={() => { handleChapterClick(c); setChaptersOpen(false); }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Reading Progress */}
      <Card className="animate-page-fade">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Page {currentPage} of {effectiveTotalPages}</span>
            </div>
            <div className="text-sm text-muted-foreground">{Math.round((currentPage / effectiveTotalPages) * 100)}% complete</div>
          </div>
          <Progress value={(currentPage / effectiveTotalPages) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Layout: Content | Assistant */}
      <div className={`grid grid-cols-1 md:grid-cols-4 ${assistantOpen ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-4 md:gap-6`}>
        {/* Reading Content (fixed span to avoid layout shifts) */}
      <div 
        ref={readingAreaRef}
          className={`md:col-span-4 lg:col-span-4 relative md:h-[600px] h-[70vh] pb-24 md:pb-0 animate-page-fade cursor-pointer select-none z-[1]`}
          tabIndex={-1}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
            <div className={`${isReading ? 'focus-glow' : ''} h-full rounded-lg overflow-hidden border` }>
              {renderPageContent(currentPage)}
            </div>
        
            {/* Click/Tap zones */}
            <button aria-label="Previous page" className="absolute top-0 left-0 bottom-24 md:bottom-0 w-1/2 md:w-1/3 z-10 cursor-pointer opacity-0" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1} />
            <button aria-label="Next page" className="absolute top-0 right-0 bottom-24 md:bottom-0 w-1/2 md:w-1/3 z-10 cursor-pointer opacity-0" onClick={() => handlePageChange(currentPage + 1, 'next')} disabled={currentPage === effectiveTotalPages} />
          </div>

          {/* Side Assistant (visible on large screens when opened) */}
          {assistantOpen && (
            <>
              {/* Desktop side panel */}
              <Card className="lg:col-span-2 h-[600px] overflow-hidden hidden lg:flex">
                <CardContent className="p-0 h-full w-full">
                  <AiChat context={pageText} compact />
                </CardContent>
              </Card>
            </>
          )}
      </div>

      {/* Assistant mobile bottom sheet */}
      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent side="bottom" className="lg:hidden h-[70vh] p-0">
          <SheetHeader className="px-4 py-2">
            <SheetTitle>Assistant</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(70vh-48px)]">
            <AiChat context={pageText} compact />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile fullscreen overlay */}
      {mobileFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="relative h-full pb-20">
            <div className="h-full rounded-none overflow-hidden border-0">
              {renderPageContent(currentPage)}
            </div>
            {/* Tap zones */}
            <button aria-label="Previous page" className="absolute top-0 left-0 bottom-20 w-1/2 z-10 opacity-0" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1} />
            <button aria-label="Next page" className="absolute top-0 right-0 bottom-20 w-1/2 z-10 opacity-0" onClick={() => handlePageChange(currentPage + 1, 'next')} disabled={currentPage === effectiveTotalPages} />
          </div>
          {/* Toolbar inside fullscreen */}
          <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t">
            <div className="px-3 py-2 flex items-center justify-between gap-3">
              <Button size="sm" variant="ghost" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1} className="h-11 w-11 p-0">
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-10" onClick={() => setChaptersOpen(true)}>
                  <List className="w-5 h-5 mr-1" />Chapters
                </Button>
                <Button size="sm" variant={assistantOpen ? 'destructive' : 'outline'} className="h-10" onClick={() => setAssistantOpen(true)}>
                  <MessageSquare className="w-5 h-5 mr-1" />Ask AI
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handlePageChange(currentPage + 1, 'next')} disabled={currentPage === effectiveTotalPages} className="h-11 w-11 p-0">
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
            <div className="px-3 pb-2 flex items-center justify-center">
              <Button size="sm" variant="secondary" onClick={() => setMobileFullscreen(false)} className="h-8">
                <Minimize2 className="w-4 h-4 mr-1" /> Exit Fullscreen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Page Navigation (desktop) */}
      <div className="hidden md:flex items-center justify-between animate-page-fade">
        <Button variant="outline" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1} className="transition-ritual">Previous Page</Button>
        <div className="flex items-center space-x-2">
          {Array.from({ length: Math.min(5, effectiveTotalPages) }, (_, i) => {
            const pageNumber = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
            if (pageNumber > effectiveTotalPages) return null;
            return (
              <Button key={pageNumber} variant={pageNumber === currentPage ? "default" : "ghost"} size="sm" onClick={() => handlePageChange(pageNumber, pageNumber > currentPage ? 'next' : 'prev')} className="transition-ritual">{pageNumber}</Button>
            );
          })}
          {effectiveTotalPages > 5 && currentPage < effectiveTotalPages - 2 && (
            <>
              <span className="text-muted-foreground">...</span>
              <Button variant="ghost" size="sm" onClick={() => handlePageChange(effectiveTotalPages, 'next')} className="transition-ritual">{effectiveTotalPages}</Button>
            </>
          )}
        </div>
        <Button variant="outline" onClick={() => handlePageChange(currentPage + 1, 'next')} disabled={currentPage === effectiveTotalPages} className="transition-ritual">Next Page</Button>
      </div>

      {/* Mobile bottom toolbar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t">
        <div className="container mx-auto px-3 py-2 flex items-center justify-between gap-3">
          <Button size="sm" variant="ghost" onClick={() => handlePageChange(currentPage - 1, 'prev')} disabled={currentPage === 1} className="h-11 w-11 p-0">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-10" onClick={() => setChaptersOpen(true)}>
              <List className="w-5 h-5 mr-1" />Chapters
            </Button>
            <Button size="sm" variant={assistantOpen ? 'destructive' : 'outline'} className="h-10" onClick={() => setAssistantOpen(true)}>
              <MessageSquare className="w-5 h-5 mr-1" />Ask AI
            </Button>
            <Button size="sm" variant={mobileFullscreen ? 'destructive' : 'ritual'} className="h-10" onClick={() => setMobileFullscreen(v => !v)}>
              {mobileFullscreen ? (<><Minimize2 className="w-4 h-4 mr-1" />Exit</>) : (<><Maximize2 className="w-4 h-4 mr-1" />Fullscreen</>)}
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