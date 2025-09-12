import { useState } from "react";
import { BookLibrary } from "@/components/BookLibrary";
import { ReadingInterface } from "@/components/ReadingInterface";
import { StreakTracker } from "@/components/StreakTracker";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { RitualModeButton } from "@/components/RitualModeButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, BookOpen, TrendingUp, Flame } from "lucide-react";

interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  coverUrl?: string;
  content?: string;
  lastRead?: Date;
}

const Index = () => {
  const [books, setBooks] = useState<BookItem[]>([
    {
      id: "1",
      title: "The Art of Mindful Reading",
      author: "Sarah Johnson",
      progress: 45,
      totalPages: 280,
      lastRead: new Date(),
    },
    {
      id: "2", 
      title: "Digital Minimalism",
      author: "Cal Newport",
      progress: 0,
      totalPages: 304,
    },
  ]);
  
  const [currentBook, setCurrentBook] = useState<BookItem | null>(null);
  const [activeTab, setActiveTab] = useState("library");

  const handleBookSelect = (book: BookItem) => {
    setCurrentBook(book);
    setActiveTab("reader");
  };

  const handleBackToLibrary = () => {
    setCurrentBook(null);
    setActiveTab("library");
  };

  const addBook = (newBook: Omit<BookItem, "id">) => {
    const book: BookItem = {
      ...newBook,
      id: Date.now().toString(),
    };
    setBooks(prev => [...prev, book]);
  };

  return (
    <div className="min-h-screen gradient-ethereal">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 animate-page-fade">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center ritual-glow">
              <BookOpen className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold ritual-heading">Ritual Reader</h1>
              <p className="text-muted-foreground">Transform reading into a mindful ritual</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <StreakTracker />
            <RitualModeButton />
          </div>
        </header>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-md mx-auto">
            <TabsTrigger value="library" className="flex items-center gap-2">
              <Book className="w-4 h-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="reader" className="flex items-center gap-2" disabled={!currentBook}>
              <BookOpen className="w-4 h-4" />
              Reader
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="streaks" className="flex items-center gap-2">
              <Flame className="w-4 h-4" />
              Streaks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="animate-page-fade">
            <BookLibrary 
              books={books} 
              onBookSelect={handleBookSelect}
              onAddBook={addBook}
            />
          </TabsContent>

          <TabsContent value="reader" className="animate-page-fade">
            {currentBook ? (
              <ReadingInterface 
                book={currentBook}
                onBackToLibrary={handleBackToLibrary}
              />
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-medium text-muted-foreground">
                  Select a book to start reading
                </h3>
              </div>
            )}
          </TabsContent>

          <TabsContent value="progress" className="animate-page-fade">
            <ProgressDashboard books={books} />
          </TabsContent>

          <TabsContent value="streaks" className="animate-page-fade">
            <div className="max-w-2xl mx-auto">
              <StreakTracker detailed />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;