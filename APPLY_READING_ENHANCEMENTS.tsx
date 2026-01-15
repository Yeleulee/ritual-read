// Enhanced Reading Interface - Settings Panel Component
// Add this to your ReadingInterface.tsx file

import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Add these state variables to your component:
const [lineHeight, setLineHeight] = useState(1.8);
const [fontFamily, setFontFamily] = useState('georgia');
const [focusMode, setFocusMode] = useState(false);
const [bookmarks, setBookmarks] = useState<number[]>([]);

// Bookmark toggle function
const toggleBookmark = () => {
    setBookmarks(prev =>
        prev.includes(currentPage)
            ? prev.filter(p => p !== currentPage)
            : [...prev, currentPage]
    );
    toast({
        title: bookmarks.includes(currentPage) ? "Bookmark Removed" : "Bookmark Added",
        description: `Page ${currentPage}`,
    });
};

// Enhanced Settings Sheet
<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
  <SheetContent className="glass-card w-full sm:max-w-md overflow-y-auto">
    <SheetHeader>
      <SheetTitle className="flex items-center gap-2">
        <Settings className="w-5 h-5" />
        Reading Settings
      </SheetTitle>
    </SheetHeader>
    
    <div className="space-y-6 mt-6">
      {/* Font Size */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Font Size</Label>
          <Badge variant="outline">{fontSize}px</Badge>
        </div>
        <Slider 
          value={[fontSize]} 
          onValueChange={([val]) => setFontSize(val)}
          min={12}
          max={32}
          step={2}
          className="cursor-pointer"
        />
      </div>
      
      {/* Line Height */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Line Spacing</Label>
          <Badge variant="outline">{lineHeight.toFixed(1)}</Badge>
        </div>
        <Slider 
          value={[lineHeight]} 
          onValueChange={([val]) => setLineHeight(val)}
          min={1.2}
          max={2.5}
          step={0.1}
        />
      </div>
      
      {/* Font Family */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Font Family</Label>
        <Select value={fontFamily} onValueChange={setFontFamily}>
          <SelectTrigger className="glass-button">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="georgia">Georgia (Serif)</SelectItem>
            <SelectItem value="inter">Inter (Sans)</SelectItem>
            <SelectItem value="merriweather">Merriweather (Serif)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Theme */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme('light')}
            className="glass-button"
          >
            <Sun className="w-4 h-4 mr-2" />
            Light
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme('dark')}
            className="glass-button"
          >
            <Moon className="w-4 h-4 mr-2" />
            Dark
          </Button>
        </div>
      </div>
      
      {/* Reading Mode */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Reading Mode</Label>
        <Button
          variant={focusMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFocusMode(!focusMode)}
          className="w-full glass-button"
        >
          <Eye className="w-4 h-4 mr-2" />
          {focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        </Button>
      </div>
    </div>
  </SheetContent>
</Sheet>

// Enhanced Reading Area with dynamic styles
<div 
  ref={readingAreaRef}
  className={cn(
    "relative animate-page-fade cursor-pointer select-none z-[1]",
    focusMode ? "h-screen" : "h-[85vh] md:h-[80vh] lg:h-[75vh] xl:h-[70vh]"
  )}
  style={{
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
    fontFamily: fontFamily === 'georgia' ? 'Georgia, serif' 
      : fontFamily === 'inter' ? 'Inter, sans-serif'
      : 'Merriweather, serif'
  }}
  tabIndex={-1}
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
>
  <div className={cn(
    "h-full rounded-lg overflow-hidden border glass-card",
    isReading && 'focus-glow'
  )}>
    {renderPageContent(currentPage)}
  </div>
  
  {/* ... rest of the reading area ... */}
</div>

// Enhanced Progress Bar
<Card className="glass-light animate-page-fade sticky top-0 z-10">
  <CardContent className="p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <BookOpen className="w-4 h-4 text-primary" />
        <div className="text-sm">
          <span className="font-medium">Page {currentPage}</span>
          <span className="text-muted-foreground"> / {effectiveTotalPages}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {Math.round((currentPage / effectiveTotalPages) * 100)}%
        </Badge>
        <Badge variant="outline" className="text-xs">
          <Clock className="w-3 h-3 mr-1" />
          {formatTime(readingTime)}
        </Badge>
        {bookmarks.includes(currentPage) && (
          <Badge variant="default" className="text-xs">
            <Bookmark className="w-3 h-3 mr-1 fill-current" />
            Bookmarked
          </Badge>
        )}
      </div>
    </div>
    
    <Progress 
      value={(currentPage / effectiveTotalPages) * 100} 
      className="h-2" 
    />
  </CardContent>
</Card>

// Enhanced Toolbar with Bookmark button
<div className="flex items-center gap-2">
  <Button
    size="sm"
    variant="outline"
    onClick={toggleBookmark}
    className={cn(
      "glass-button",
      bookmarks.includes(currentPage) && "text-primary border-primary"
    )}
  >
    <Bookmark className={cn(
      "w-4 h-4 mr-1",
      bookmarks.includes(currentPage) && "fill-current"
    )} />
    <span className="hidden sm:inline">
      {bookmarks.includes(currentPage) ? 'Bookmarked' : 'Bookmark'}
    </span>
  </Button>
  
  <Button
    size="sm"
    variant="outline"
    onClick={() => setChaptersOpen(true)}
    className="glass-button"
  >
    <List className="w-4 h-4 mr-1" />
    <span className="hidden sm:inline">Chapters</span>
  </Button>
  
  <Button
    size="sm"
    variant="outline"
    onClick={() => setSettingsOpen(true)}
    className="glass-button"
  >
    <Settings className="w-4 h-4" />
    <span className="hidden sm:inline ml-1">Settings</span>
  </Button>
</div>

// Keyboard Shortcuts (add to useEffect)
useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
        // Prevent shortcuts when typing in inputs
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        // Navigation
        if (e.key === 'ArrowLeft') handlePageChange(currentPage - 1, 'prev');
        if (e.key === 'ArrowRight') handlePageChange(currentPage + 1, 'next');
        if (e.key === ' ' && !e.shiftKey) {
            e.preventDefault();
            handlePageChange(currentPage + 1, 'next');
        }

        // Features
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            toggleBookmark();
        }
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            setFocusMode(v => !v);
        }
        if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            setSettingsOpen(true);
        }
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            setChaptersOpen(true);
        }
        if (e.key === 'Escape') {
            setFocusMode(false);
            setSettingsOpen(false);
            setChaptersOpen(false);
        }

        // Font size
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            setFontSize(s => Math.min(s + 2, 32));
            toast({ title: `Font size: ${fontSize + 2}px` });
        }
        if (e.key === '-') {
            e.preventDefault();
            setFontSize(s => Math.max(s - 2, 12));
            toast({ title: `Font size: ${fontSize - 2}px` });
        }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
}, [currentPage, fontSize, effectiveTotalPages]);
