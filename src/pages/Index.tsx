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
import { Moon, Sun, Home, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReadingStats } from "@/hooks/use-reading-stats";

const Index = () => {
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, addBook, updateBookProgress, removeBook } = useBooks();
  const [currentBook, setCurrentBook] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("library");
  const { current, state } = useReadingStats();

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <span className="font-serif italic text-3xl">Ritual</span>
          <p className="eyebrow mt-3">Loading</p>
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

  const minutesLeft = Math.max(0, state.goalMinutesPerDay - Math.floor((current.todayProgress / 100) * state.goalMinutesPerDay));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-[2px] border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <span><Wordmark iconOnly /></span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="text-xs">
              {minutesLeft > 0 ? `Read ${minutesLeft} min today to keep your streak` : 'Daily goal met'}
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1">
            <div className="hidden lg:flex items-center mr-2">
              <StreakTracker />
            </div>

            <RitualModeButton />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <span className="hidden md:block h-5 w-px bg-border mx-2" />

            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex h-9">
              <Link to="/">
                <Home className="w-4 h-4" />
                <span className="hidden lg:inline">Home</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex h-9 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Sign out</span>
            </Button>

            <span className="hidden xl:inline-flex ml-3 eyebrow">{user?.email?.split('@')[0]}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6">
        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide gap-8">
            <TabsTrigger value="library" className="flex-none">Library</TabsTrigger>
            <TabsTrigger value="reader" className="flex-none" disabled={!currentBook}>Reader</TabsTrigger>
            <TabsTrigger value="progress" className="flex-none">Progress</TabsTrigger>
            <TabsTrigger value="streaks" className="flex-none">Streaks</TabsTrigger>
            <TabsTrigger value="assistant" className="flex-none">Assistant</TabsTrigger>
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
              <div className="text-center py-24 border border-dashed border-border">
                <p className="eyebrow">Reader</p>
                <h3 className="display text-3xl mt-3 text-muted-foreground">
                  Select a book to start reading
                </h3>
              </div>
            )}
          </TabsContent>

          <TabsContent value="progress" className="animate-page-fade">
            <ProgressDashboard books={books} />
          </TabsContent>

          <TabsContent value="streaks" className="animate-page-fade">
            <div className="max-w-4xl">
              <StreakTracker detailed />
            </div>
          </TabsContent>

          <TabsContent value="assistant" className="animate-page-fade">
            <AiChat context={currentBook ? `Currently reading: "${currentBook.title}" by ${currentBook.author}.\n${currentBook.content || ''}` : ''} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;