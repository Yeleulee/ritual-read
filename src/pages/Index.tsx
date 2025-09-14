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
import { Book, BookOpen, TrendingUp, Flame, Moon, Sun, Home, LogOut, BookMarked, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, addBook, updateBookProgress, removeBook } = useBooks();
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
    <div className="min-h-screen gradient-ethereal">
      <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 max-w-7xl">
        {/* Header */}
        <header className="flex items-center justify-between mb-4 md:mb-6 animate-page-fade gap-3 flex-wrap">
          <Link to="/" className="flex items-center space-x-2 md:space-x-3 hover:opacity-90 transition-ritual min-w-0">
            <div className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-2xl overflow-hidden bg-white/95 ring-1 ring-border shadow-lg flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="Ritual Reader logo" className="w-full h-full object-contain p-1.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl lg:text-3xl font-bold ritual-heading truncate">Ritual Reader</h1>
              <p className="text-muted-foreground text-xs md:text-sm lg:text-base truncate">Transform reading into mindful ritual</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-2 md:space-x-3 flex-wrap">
            <div className="hidden sm:block">
              <StreakTracker />
            </div>
            <div className="hidden md:block">
              <RitualModeButton />
            </div>
            <button
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-background/80 hover:bg-muted h-8 w-8 md:h-9 md:w-9 backdrop-blur-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link to="/" className="hidden lg:inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-background/80 hover:bg-muted h-9 px-3 backdrop-blur-sm">
              <Home className="w-4 h-4 mr-1" /> Home
            </Link>
            <Button 
              variant="outline" 
              size="sm"
              onClick={signOut}
              className="hidden md:inline-flex bg-background/80 hover:bg-muted backdrop-blur-sm rounded-lg"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
            <div className="text-xs text-muted-foreground hidden lg:block max-w-[120px] truncate">
              {user?.email}
            </div>
          </div>
        </header>

        {/* Hero Banner */}
        <div className="rounded-2xl md:rounded-3xl border bg-gradient-to-r from-card/90 to-card/70 backdrop-blur-md p-4 md:p-6 lg:p-8 mb-4 md:mb-6 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 md:gap-6">
            <div className="space-y-2 md:space-y-3">
              <h2 className="text-lg md:text-2xl lg:text-3xl font-bold tracking-tight gradient-text">Transform reading into mindful ritual</h2>
              <p className="text-muted-foreground text-sm md:text-base max-w-2xl leading-relaxed">Import your favorite books, build consistent reading habits, get AI-powered insights, and enjoy a beautifully distraction-free reading experience.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full lg:w-auto">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all h-9 md:h-10 px-4 md:px-6 rounded-xl font-medium"
                onClick={() => setActiveTab("library")}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Open Library
              </Button>
              <Button
                variant="outline"
                className="border-2 bg-background/80 hover:bg-muted backdrop-blur-sm h-9 md:h-10 px-4 md:px-6 rounded-xl font-medium"
                onClick={() => setActiveTab(currentBook ? "reader" : "assistant")}
              >
                {currentBook ? (
                  <>
                    <BookMarked className="w-4 h-4 mr-2" />
                    Continue Reading
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Ask Assistant
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Navigation & Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <div className="w-full overflow-x-auto scrollbar-hide">
            <TabsList className="flex w-full min-w-max mx-auto rounded-2xl bg-muted/50 backdrop-blur-sm p-1 gap-1 border">
              <TabsTrigger value="library" className="flex items-center gap-2 h-9 md:h-10 flex-none px-3 md:px-4 rounded-xl font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Book className="w-4 h-4" />
                <span className="hidden sm:inline">Library</span>
              </TabsTrigger>
              <TabsTrigger value="reader" className="flex items-center gap-2 h-9 md:h-10 flex-none px-3 md:px-4 rounded-xl font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm" disabled={!currentBook}>
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Reader</span>
              </TabsTrigger>
              <TabsTrigger value="progress" className="flex items-center gap-2 h-9 md:h-10 flex-none px-3 md:px-4 rounded-xl font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="streaks" className="flex items-center gap-2 h-9 md:h-10 flex-none px-3 md:px-4 rounded-xl font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Flame className="w-4 h-4" />
                <span className="hidden sm:inline">Streaks</span>
              </TabsTrigger>
              <TabsTrigger value="assistant" className="flex items-center gap-2 h-9 md:h-10 flex-none px-3 md:px-4 rounded-xl font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">AI Assistant</span>
              </TabsTrigger>
            </TabsList>
          </div>

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