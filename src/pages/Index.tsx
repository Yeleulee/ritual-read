import { useState } from "react";
import { BookLibrary } from "@/components/BookLibrary";
import { CloudLibrary } from "@/components/CloudLibrary";
import { CloudBookReader } from "@/components/CloudBookReader";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReadingStats } from "@/hooks/use-reading-stats";

const Index = () => {
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, addBook, updateBookProgress, removeBook } = useBooks();
  const [currentBook, setCurrentBook] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("library");
  const [cloudBookId, setCloudBookId] = useState<string | null>(null);
  const { current, state } = useReadingStats();

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <img
              src="/image.png"
              alt="Ritual Reader"
              className="w-16 h-16 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
            />
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

  const handleRemoveBook = async (bookId: string) => {
    try {
      if (currentBook?.id === bookId) {
        setCurrentBook(null);
        setActiveTab('library');
      }
      await removeBook(bookId);
    } catch (error) {
      console.error('Failed to remove book:', error);
    }
  };

  return (
    <div className="min-h-screen gradient-ethereal bg-grid">
      <div className="container mx-auto px-4 py-4">
        {/* Professional Header */}
        <header className="relative overflow-hidden backdrop-blur-md bg-background/80 border-b border-border/40 rounded-xl mb-6 animate-page-fade">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-secondary/50 to-primary/40" />
          </div>
          <div className="flex items-center justify-between px-6 py-4 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/" className="flex items-center group" aria-label="Ritual Reader Home">
                  <span
                    className="text-2xl sm:text-3xl font-medium bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
                    style={{ fontFamily: 'Great Vibes, cursive' }}
                  >
                    Ritual
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="text-xs">
                {Math.max(0, state.goalMinutesPerDay - Math.floor((current.todayProgress / 100) * state.goalMinutesPerDay)) > 0
                  ? `Read ${Math.max(0, state.goalMinutesPerDay - Math.floor((current.todayProgress / 100) * state.goalMinutesPerDay))} min today to keep your streak!`
                  : 'Daily goal met — amazing consistency!'}
              </TooltipContent>
            </Tooltip>
            
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2">
                <StreakTracker />
              </div>
              
              <div className="flex items-center gap-1">
                <RitualModeButton />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="h-9 w-9 rounded-lg hover:bg-muted/80"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 transition-transform hover:rotate-180 duration-300" />
                  ) : (
                    <Moon className="w-4 h-4 transition-transform hover:rotate-12 duration-300" />
                  )}
                </Button>
                
                <div className="hidden md:flex items-center gap-1 ml-2 pl-2 border-l border-border/40">
                  <Button variant="ghost" size="sm" asChild className="h-9 rounded-lg">
                    <Link to="/" className="flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      <span className="hidden lg:inline">Home</span>
                    </Link>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={signOut}
                    className="h-9 rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden lg:inline ml-2">Sign Out</span>
                  </Button>
                </div>
                
                <div className="hidden xl:flex items-center ml-3 pl-3 border-l border-border/40">
                  <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded">
                    {user?.email?.split('@')[0]}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <div className="rounded-2xl border bg-card/60 backdrop-blur p-4 md:p-6 mb-2 shadow-sm">
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
        <div className="divider-shimmer mb-4" />

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex w-full max-w-full mx-auto rounded-full bg-muted/60 backdrop-blur p-1 overflow-x-auto gap-1 shadow-sm">
            <TabsTrigger value="library" className="tab-trigger flex items-center gap-2 h-8 flex-none px-3">
              <Book className="w-4 h-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="reader" className="tab-trigger flex items-center gap-2 h-8 flex-none px-3" disabled={!currentBook}>
              <BookOpen className="w-4 h-4" />
              Reader
            </TabsTrigger>
            <TabsTrigger value="cloud" className="tab-trigger flex items-center gap-2 h-8 flex-none px-3">
              <BookOpen className="w-4 h-4" />
              Cloud
            </TabsTrigger>
            <TabsTrigger value="progress" className="tab-trigger flex items-center gap-2 h-8 flex-none px-3">
              <TrendingUp className="w-4 h-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="streaks" className="tab-trigger flex items-center gap-2 h-8 flex-none px-3">
              <Flame className="w-4 h-4" />
              Streaks
            </TabsTrigger>
            <TabsTrigger value="assistant" className="tab-trigger flex items-center gap-2 h-8 flex-none px-3">
              <BookOpen className="w-4 h-4" />
              Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="animate-page-fade">
            <BookLibrary 
              books={books} 
              onBookSelect={handleBookSelect}
              onAddBook={handleAddBook}
              onRemoveBook={handleRemoveBook}
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

          <TabsContent value="cloud" className="animate-page-fade">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <CloudLibrary onOpen={(id) => { setCloudBookId(id); }} />
              </div>
              <div>
                {cloudBookId ? (
                  <CloudBookReader id={cloudBookId} onBack={() => setCloudBookId(null)} />
                ) : (
                  <div className="text-sm text-muted-foreground">Select a cloud book to preview</div>
                )}
              </div>
            </div>
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