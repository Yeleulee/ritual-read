import { useState, useEffect } from "react";
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

interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  content?: string;
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
  const totalPages = Math.ceil(totalWords / wordsPerPage);

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
                Page {currentPage} of {totalPages}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {Math.round((currentPage / totalPages) * 100)}% complete
            </div>
          </div>
          <Progress value={(currentPage / totalPages) * 100} className="h-2" />
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
      <Card className={`gradient-reading animate-page-fade ${isReading ? 'focus-glow' : ''}`}>
        <CardContent className="p-8">
          <div 
            className="reading-text transition-ritual"
            style={{ fontSize: `${fontSize}px` }}
          >
            {getCurrentPageContent()}
          </div>
        </CardContent>
      </Card>

      {/* Page Navigation */}
      <div className="flex items-center justify-between animate-page-fade">
        <Button
          variant="outline"
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="transition-ritual"
        >
          Previous Page
        </Button>

        <div className="flex items-center space-x-2">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNumber = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
            if (pageNumber > totalPages) return null;
            
            return (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrentPage(pageNumber)}
                className="transition-ritual"
              >
                {pageNumber}
              </Button>
            );
          })}
          {totalPages > 5 && currentPage < totalPages - 2 && (
            <>
              <span className="text-muted-foreground">...</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                className="transition-ritual"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="transition-ritual"
        >
          Next Page
        </Button>
      </div>
    </div>
  );
};