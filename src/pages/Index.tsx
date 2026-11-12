import { useEffect, useState } from "react";
import { BookLibrary } from "@/components/BookLibrary";
import { ReaderShell } from "@/components/reader/ReaderShell";
import { StreakTracker } from "@/components/StreakTracker";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { PracticeDashboard } from "@/components/practice/PracticeDashboard";
import { RitualModeButton } from "@/components/RitualModeButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiChat } from "@/components/AiChat";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/use-auth";
import { useBooks, type BookItem } from "@/hooks/use-books";
import { Moon, Sun, Home, LogOut, Library, BookOpen, TrendingUp, Flame, Sparkles, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { UserMenu } from "@/components/UserMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReadingStats } from "@/hooks/use-reading-stats";

const TABS = ["library", "reader", "practice", "progress", "streaks", "assistant"] as const;

const Index = () => {
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, addBook, prepareUpload, discardUpload, updateBookProgress, removeBook } = useBooks();
  const [currentBook, setCurrentBook] = useState<BookItem | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTabState] = useState(() => (TABS.includes(requestedTab as (typeof TABS)[number]) && requestedTab !== "reader" ? requestedTab! : "library"));
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams(tab === "library" ? {} : { tab }, { replace: true });
  };
  // ?book=<id> opens that book directly once the library has loaded
  const requestedBook = searchParams.get("book");
  useEffect(() => {
    if (!requestedBook || currentBook || booksLoading) return;
    const match = books.find((b) => b.id === requestedBook);
    if (match) { setCurrentBook(match); setActiveTabState("reader"); }
  }, [requestedBook, books, booksLoading, currentBook]);
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

  const handleBookSelect = (book: BookItem) => {
    setCurrentBook(book);
    setActiveTabState("reader");
    setSearchParams({ book: book.id }, { replace: true });
  };

  const handleBackToLibrary = () => {
    setCurrentBook(null);
    setActiveTab("library");
  };

  const handleAddBook = async (newBook: Parameters<typeof addBook>[0]) => {
    // Rethrow so the add dialog stays open on failure (the hook already toasts the error)
    const addedBook = await addBook(newBook);
    if (addedBook) {
      // Auto-open the newly added book
      setCurrentBook(addedBook);
      setActiveTab("reader");
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
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 transition-colors">
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
              className="h-11 w-11"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <span className="hidden md:block h-5 w-px bg-border mx-2" />

            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex h-11 text-sm">
              <Link to="/">
                <Home className="w-4 h-4" />
                <span className="hidden lg:inline">Home</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex h-11 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Sign out</span>
            </Button>

            <UserMenu className="ml-2" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 pb-28 md:pb-8">
        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="hidden md:flex w-full overflow-x-auto scrollbar-hide gap-8">
            <TabsTrigger value="library" className="flex-none">Library</TabsTrigger>
            <TabsTrigger value="reader" className="flex-none">Reader</TabsTrigger>
            <TabsTrigger value="practice" className="flex-none">Practice</TabsTrigger>
            <TabsTrigger value="progress" className="flex-none">Progress</TabsTrigger>
            <TabsTrigger value="streaks" className="flex-none">Streaks</TabsTrigger>
            <TabsTrigger value="assistant" className="flex-none">Assistant</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="animate-page-fade">
            <BookLibrary
              books={books}
              onBookSelect={handleBookSelect}
              onAddBook={handleAddBook}
              onPrepareUpload={prepareUpload}
              onDiscardUpload={discardUpload}
              onRemoveBook={handleRemoveBook}
            />
          </TabsContent>

          <TabsContent value="reader" className="animate-page-fade">
            {currentBook ? (
              <ReaderShell
                book={currentBook}
                onBackToLibrary={handleBackToLibrary}
                onProgress={updateBookProgress}
              />
            ) : (
              <div className="text-center py-20 px-4 border border-dashed border-border/70 rounded-2xl bg-card/25 backdrop-blur-sm max-w-2xl mx-auto">
                <p className="eyebrow">Reader</p>
                <h3 className="display text-2xl sm:text-3xl mt-3 text-foreground/90">
                  Select a volume to start reading
                </h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Pick up where you left off, or open a volume from your library.
                </p>
                <Button
                  onClick={() => setActiveTab("library")}
                  className="mt-6 rounded-full px-6 gap-2"
                >
                  <Library className="w-4 h-4" />
                  <span>Browse Library</span>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="practice" className="animate-page-fade">
            <PracticeDashboard books={books} />
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
            <AiChat
              context={currentBook ? `Currently reading: "${currentBook.title}" by ${currentBook.author}.\n${currentBook.content || ''}` : ''}
              books={books}
              currentBookId={currentBook?.id}
            />
          </TabsContent>
        </Tabs>

        {/* Apple HIG Floating Bottom Tab Bar on Mobile */}
        <nav
          aria-label="Mobile Navigation"
          className="fixed bottom-3 left-3 right-3 z-40 md:hidden bg-background/85 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.14)] rounded-2xl px-2 py-1.5 pb-[max(6px,env(safe-area-inset-bottom))]"
        >
          <div className="grid grid-cols-6 items-center">
            {[
              { id: "library", label: "Library", icon: Library },
              { id: "reader", label: "Reader", icon: BookOpen },
              { id: "practice", label: "Practice", icon: GraduationCap },
              { id: "progress", label: "Progress", icon: TrendingUp },
              { id: "streaks", label: "Streaks", icon: Flame },
              { id: "assistant", label: "Assistant", icon: Sparkles },
            ].map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-h-[44px] py-1 rounded-xl transition-all select-none",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground/75 hover:text-foreground active:scale-95"
                  )}
                  aria-selected={isActive}
                >
                  <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                  <span className="text-[10px] leading-none tracking-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Index;