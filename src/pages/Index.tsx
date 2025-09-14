import { useState } from "react";
import { BookLibrary } from "@/components/BookLibrary";
import { ReadingInterface } from "@/components/ReadingInterface";
import { StreakTracker } from "@/components/StreakTracker";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { RitualModeButton } from "@/components/RitualModeButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiChat } from "@/components/AiChat";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/use-auth";
import { useBooks } from "@/hooks/use-books";
import { Book, BookOpen, TrendingUp, Flame, Moon, Sun, Home, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, addBook, updateBookProgress } = useBooks();
  const [currentBook, setCurrentBook] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("library");

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-white ring-1 ring-border shadow-sm flex items-center justify-center mx-auto mb-4">
            <img src="/logo.png" alt="Ritual Reader" className="w-full h-full object-contain p-2" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth form if not authenticated
  if (!user) {
    return <AuthForm />;
  }

  const handleBookSelect = (book: any) => {
    setCurrentBook(book);
    setActiveTab("reader");
  };

  const handleBackToLibrary = () => {
    setCurrentBook(null);
    setActiveTab("library");
  };

  const handleAddBook = async (newBook: any) => {
    try {
      const addedBook = await addBook(newBook);
      if (addedBook) {
        // Auto-open the newly added book
        setCurrentBook(addedBook);
        setActiveTab("reader");
      }
    } catch (error) {
      console.error('Failed to add book:', error);
    }
  };

  return (
    <div className="min-h-screen gradient-ethereal">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 animate-page-fade gap-3 flex-wrap">
          <Link to="/" className="flex items-center space-x-3 hover:opacity-90 transition-ritual">
            <div className="w-14 h-14 md:w-20 md:h-20 rounded-full overflow-hidden bg-white/95 ring-1 ring-border shadow-sm flex items-center justify-center">
              <img src="/logo.png" alt="Ritual Reader logo" className="w-full h-full object-contain p-1" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold ritual-heading">Ritual Reader</h1>
              <p className="text-muted-foreground text-sm md:text-base">Transform reading into a mindful ritual</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4 flex-wrap">
            <StreakTracker />
            <RitualModeButton />
            <button
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-background hover:bg-muted h-9 w-9"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link to="/" className="hidden md:inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-background hover:bg-muted h-9 px-3">
              <Home className="w-4 h-4 mr-1" /> Home
            </Link>
            <Button 
              variant="outline" 
              size="sm"
              onClick={signOut}
              className="hidden md:inline-flex"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
            <div className="text-xs text-muted-foreground hidden md:block">
              {user?.email}
            </div>
          </div>
        </header>

        {/* Hero */}
        <div className="rounded-2xl border bg-card/50 backdrop-blur p-4 md:p-6 mb-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Transform reading into a mindful ritual</h2>
              <p className="text-muted-foreground mt-1 text-sm">Import books, track streaks, ask AI, and enjoy a distraction-free reader.</p>
            </div>
            <div className="flex gap-2">
              <button
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow h-8 px-3"
                onClick={() => setActiveTab("library")}
              >
                Open Library
              </button>
              <button
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-background hover:bg-muted h-8 px-3"
                onClick={() => setActiveTab(currentBook ? "reader" : "assistant")}
              >
                {currentBook ? "Continue Reading" : "Ask Assistant"}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex w-full max-w-full mx-auto rounded-full bg-muted/40 p-1 overflow-x-auto gap-1">
            <TabsTrigger value="library" className="flex items-center gap-2 h-8 flex-none px-3">
              <Book className="w-4 h-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="reader" className="flex items-center gap-2 h-8 flex-none px-3" disabled={!currentBook}>
              <BookOpen className="w-4 h-4" />
              Reader
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2 h-8 flex-none px-3">
              <TrendingUp className="w-4 h-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="streaks" className="flex items-center gap-2 h-8 flex-none px-3">
              <Flame className="w-4 h-4" />
              Streaks
            </TabsTrigger>
            <TabsTrigger value="assistant" className="flex items-center gap-2 h-8 flex-none px-3">
              <BookOpen className="w-4 h-4" />
              Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="animate-page-fade">
            <BookLibrary 
              books={books} 
              onBookSelect={handleBookSelect}
              onAddBook={handleAddBook}
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

          <TabsContent value="assistant" className="animate-page-fade">
            <AiChat />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;