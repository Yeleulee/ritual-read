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
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PdfReader } from "@/components/readers/PdfReader";
import { EpubReader } from "@/components/readers/EpubReader";

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
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const readingAreaRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const { toast } = useToast();

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

  // Reading session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReading) {
      interval = setInterval(() => {
        setReadingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isReading]);

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

  const getCurrentPageContent = () => {
    const words = sampleContent.split(' ');
    const startIndex = (currentPage - 1) * wordsPerPage;
    const endIndex = Math.min(startIndex + wordsPerPage, words.length);
    return words.slice(startIndex, endIndex).join(' ');
  };

  const handlePageChange = (newPage: number, direction: 'next' | 'prev') => {
    if (newPage < 1 || newPage > effectiveTotalPages || isFlipping) return;
    
    setIsFlipping(true);
    setFlipDirection(direction);
    
    setTimeout(() => {
      setCurrentPage(newPage);
      setTimeout(() => {
        setIsFlipping(false);
      }, 300);
    }, 150);
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
    
    // Only trigger page change if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right - previous page
        handlePageChange(currentPage - 1, 'prev');
      } else {
        // Swipe left - next page
        handlePageChange(currentPage + 1, 'next');
      }
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
  }, [currentPage, totalPages]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Reading Header */}
      <div className="flex items-center justify-between animate-page-fade">
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
            <h1 className="text-2xl font-bold ritual-heading">{book.title}</h1>
            <p className="text-muted-foreground">by {book.author}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {formatTime(readingTime)}
          </Badge>
          
          <Button
            variant={isReading ? "destructive" : "ritual"}
            onClick={isReading ? pauseReading : startReading}
          >
            {isReading ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Reading
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" className="transition-ritual">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Reading Progress */}
      <Card className="animate-page-fade">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                Page {currentPage} of {effectiveTotalPages}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {Math.round((currentPage / effectiveTotalPages) * 100)}% complete
            </div>
          </div>
          <Progress value={(currentPage / effectiveTotalPages) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Reading Controls */}
      <Card className="animate-page-fade">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Font Size</span>
              <Slider
                value={[fontSize]}
                onValueChange={(value) => setFontSize(value[0])}
                max={24}
                min={12}
                step={1}
                className="w-24"
              />
              <span className="text-sm font-mono">{fontSize}px</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reading Content */}
      <div 
        ref={readingAreaRef}
        className="relative h-[600px] [perspective:1000px] animate-page-fade cursor-pointer select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Card 
          className={`
            absolute inset-0 gradient-reading transition-all duration-500 [transform-style:preserve-3d]
            ${isFlipping ? (
              flipDirection === 'next' 
                ? '[transform:rotateY(-180deg)]' 
                : '[transform:rotateY(180deg)]'
            ) : '[transform:rotateY(0deg)]'}
            ${isReading ? 'focus-glow' : ''}
            [backface-visibility:hidden]
          `}
        >
          <CardContent className="p-8 h-full flex flex-col justify-center">
            {book.fileType === 'pdf' && book.fileUrl ? (
              <div className="h-full">
                <PdfReader fileUrl={book.fileUrl} page={currentPage} onPageCount={setDocPageCount} />
              </div>
            ) : book.fileType === 'epub' && book.fileUrl ? (
              <div className="h-full">
                <EpubReader fileUrl={book.fileUrl} page={currentPage} onPageCount={setDocPageCount} />
              </div>
            ) : (
              <div 
                className="reading-text transition-ritual leading-relaxed"
                style={{ 
                  fontSize: `${fontSize}px`,
                  textAlign: 'justify',
                  columnCount: typeof window !== 'undefined' && window.innerWidth > 768 ? 2 : 1,
                  columnGap: '2rem'
                }}
              >
                {getCurrentPageContent()}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Page shadow effect */}
        <div 
          className={`
            absolute inset-0 pointer-events-none transition-opacity duration-300
            bg-gradient-to-r from-transparent via-black/5 to-transparent
            ${isFlipping ? 'opacity-100' : 'opacity-0'}
          `}
        />

        {/* Touch indicators */}
        <div className="absolute inset-y-0 left-0 w-1/3 flex items-center justify-start pl-4 pointer-events-none">
          <div className={`text-muted-foreground/20 transition-opacity ${currentPage > 1 ? 'opacity-100' : 'opacity-0'}`}>
            ←
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/3 flex items-center justify-end pr-4 pointer-events-none">
          <div className={`text-muted-foreground/20 transition-opacity ${currentPage < totalPages ? 'opacity-100' : 'opacity-0'}`}>
            →
          </div>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-between animate-page-fade">
        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage - 1, 'prev')}
          disabled={currentPage === 1 || isFlipping}
          className="transition-ritual"
        >
          Previous Page
        </Button>

        <div className="flex items-center space-x-2">
          {Array.from({ length: Math.min(5, effectiveTotalPages) }, (_, i) => {
            const pageNumber = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
            if (pageNumber > effectiveTotalPages) return null;
            
            return (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? "default" : "ghost"}
                size="sm"
                onClick={() => handlePageChange(pageNumber, pageNumber > currentPage ? 'next' : 'prev')}
                className="transition-ritual"
              >
                {pageNumber}
              </Button>
            );
          })}
          {effectiveTotalPages > 5 && currentPage < effectiveTotalPages - 2 && (
            <>
              <span className="text-muted-foreground">...</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(effectiveTotalPages, 'next')}
                className="transition-ritual"
              >
                {effectiveTotalPages}
              </Button>
            </>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage + 1, 'next')}
          disabled={currentPage === totalPages || isFlipping}
          className="transition-ritual"
        >
          Next Page
        </Button>
      </div>
    </div>
  );
};