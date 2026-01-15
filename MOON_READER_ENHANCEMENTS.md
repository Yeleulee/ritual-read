# 📖 Moon Reader Page Flip & Typography Enhancements

## 🌙 Moon Reader's Best Practices

Moon Reader is renowned for its smooth, natural page turning and excellent text controls. Let's implement these features!

---

## 📄 Page Flip Animations

### 1. **Animation Types (Moon Reader Style)**

```css
/* Add these animations to your index.css */

/* Slide Animation (Default) */
@keyframes slideLeft {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
}

@keyframes slideRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Fade Animation */
@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Curl Animation (Paper-like) */
@keyframes curlLeft {
  from {
    transform: perspective(1000px) rotateY(0deg);
    transform-origin: left center;
    opacity: 1;
  }
  to {
    transform: perspective(1000px) rotateY(-90deg);
    transform-origin: left center;
    opacity: 0.5;
  }
}

@keyframes curlRight {
  from {
    transform: perspective(1000px) rotateY(0deg);
    transform-origin: right center;
    opacity: 1;
  }
  to {
    transform: perspective(1000px) rotateY(90deg);
    transform-origin: right center;
    opacity: 0.5;
  }
}

/* Animation Classes */
.page-slide-left {
  animation: slideLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.page-slide-right {
  animation: slideRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.page-slide-in-left {
  animation: slideInFromLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.page-slide-in-right {
  animation: slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.page-fade-out {
  animation: fadeOut 0.3s ease-out forwards;
}

.page-fade-in {
  animation: fadeIn 0.3s ease-in forwards;
}

.page-curl-left {
  animation: curlLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.page-curl-right {
  animation: curlRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* No animation */
.page-none {
  transition: none;
}
```

---

## 🎬 Page Flip Implementation

### Enhanced ReadingInterface Component

```tsx
import { useState } from "react";

// Animation types
type PageAnimation = 'slide' | 'fade' | 'curl' | 'none';

const ReadingInterface = ({ book, onBackToLibrary }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageAnimation, setPageAnimation] = useState<PageAnimation>('slide');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  // Handle page change with animation
  const handlePageChange = (newPage: number, direction: 'next' | 'prev') => {
    if (newPage < 1 || newPage > totalPages || isAnimating) return;

    setIsAnimating(true);

    // Determine animation based on direction and type
    let exitClass = '';
    let enterClass = '';

    switch (pageAnimation) {
      case 'slide':
        exitClass = direction === 'next' ? 'page-slide-left' : 'page-slide-right';
        enterClass = direction === 'next' ? 'page-slide-in-right' : 'page-slide-in-left';
        break;
      case 'fade':
        exitClass = 'page-fade-out';
        enterClass = 'page-fade-in';
        break;
      case 'curl':
        exitClass = direction === 'next' ? 'page-curl-left' : 'page-curl-right';
        enterClass = 'page-fade-in';
        break;
      case 'none':
        setCurrentPage(newPage);
        setIsAnimating(false);
        return;
    }

    // Apply exit animation
    setAnimationClass(exitClass);

    // Wait for exit animation to complete
    const exitDuration = pageAnimation === 'curl' ? 500 : pageAnimation === 'slide' ? 400 : 300;
    
    setTimeout(() => {
      setCurrentPage(newPage);
      setAnimationClass(enterClass);

      // Reset after enter animation
      setTimeout(() => {
        setAnimationClass('');
        setIsAnimating(false);
      }, exitDuration);
    }, exitDuration);
  };

  return (
    <div>
      {/* Reading Content with Animation */}
      <div 
        className={cn(
          "reading-content transition-opacity",
          animationClass
        )}
      >
        {renderPageContent(currentPage)}
      </div>

      {/* Animation Settings (in settings panel) */}
      <Select value={pageAnimation} onValueChange={setPageAnimation}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="slide">Slide</SelectItem>
          <SelectItem value="fade">Fade</SelectItem>
          <SelectItem value="curl">Curl</SelectItem>
          <SelectItem value="none">None</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
```

---

## ✍️ Advanced Typography Controls (Moon Reader Style)

### Typography State Management

```tsx
interface TypographySettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing: number;
  wordSpacing: number;
  paragraphSpacing: number;
  textAlign: 'left' | 'justify' | 'center';
  hyphenation: boolean;
}

const [typography, setTypography] = useState<TypographySettings>({
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: 'georgia',
  letterSpacing: 0,
  wordSpacing: 0,
  paragraphSpacing: 1.5,
  textAlign: 'left',
  hyphenation: false,
});

// Helper function to update typography
const updateTypography = (key: keyof TypographySettings, value: any) => {
  setTypography(prev => ({ ...prev, [key]: value }));
};
```

### Typography Settings Panel

```tsx
<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
  <SheetContent className="glass-card w-full sm:max-w-lg overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Reading Settings</SheetTitle>
    </SheetHeader>

    <div className="space-y-6 mt-6">
      {/* Font Size */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Font Size</Label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateTypography('fontSize', Math.max(12, typography.fontSize - 2))}
              className="h-8 w-8 p-0"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="w-16 justify-center">
              {typography.fontSize}px
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateTypography('fontSize', Math.min(32, typography.fontSize + 2))}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Slider
          value={[typography.fontSize]}
          onValueChange={([val]) => updateTypography('fontSize', val)}
          min={12}
          max={32}
          step={2}
        />
      </div>

      {/* Line Height */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Line Spacing</Label>
          <Badge variant="outline">{typography.lineHeight.toFixed(1)}</Badge>
        </div>
        <Slider
          value={[typography.lineHeight]}
          onValueChange={([val]) => updateTypography('lineHeight', val)}
          min={1.0}
          max={3.0}
          step={0.1}
        />
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>Compact</span>
          <span>Normal</span>
          <span>Relaxed</span>
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <Label>Font Family</Label>
        <Select 
          value={typography.fontFamily} 
          onValueChange={(val) => updateTypography('fontFamily', val)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="georgia">Georgia (Serif)</SelectItem>
            <SelectItem value="literata">Literata (Serif)</SelectItem>
            <SelectItem value="merriweather">Merriweather (Serif)</SelectItem>
            <SelectItem value="inter">Inter (Sans)</SelectItem>
            <SelectItem value="system">System Default</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Letter Spacing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Letter Spacing</Label>
          <Badge variant="outline">{typography.letterSpacing}px</Badge>
        </div>
        <Slider
          value={[typography.letterSpacing]}
          onValueChange={([val]) => updateTypography('letterSpacing', val)}
          min={-2}
          max={4}
          step={0.5}
        />
      </div>

      {/* Word Spacing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Word Spacing</Label>
          <Badge variant="outline">{typography.wordSpacing}px</Badge>
        </div>
        <Slider
          value={[typography.wordSpacing]}
          onValueChange={([val]) => updateTypography('wordSpacing', val)}
          min={0}
          max={8}
          step={1}
        />
      </div>

      {/* Paragraph Spacing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Paragraph Spacing</Label>
          <Badge variant="outline">{typography.paragraphSpacing.toFixed(1)}em</Badge>
        </div>
        <Slider
          value={[typography.paragraphSpacing]}
          onValueChange={([val]) => updateTypography('paragraphSpacing', val)}
          min={0.5}
          max={3.0}
          step={0.25}
        />
      </div>

      {/* Text Alignment */}
      <div className="space-y-2">
        <Label>Text Alignment</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={typography.textAlign === 'left' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateTypography('textAlign', 'left')}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={typography.textAlign === 'center' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateTypography('textAlign', 'center')}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={typography.textAlign === 'justify' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateTypography('textAlign', 'justify')}
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hyphenation */}
      <div className="flex items-center justify-between">
        <Label>Auto-Hyphenation</Label>
        <Switch
          checked={typography.hyphenation}
          onCheckedChange={(checked) => updateTypography('hyphenation', checked)}
        />
      </div>

      {/* Page Animation */}
      <div className="space-y-2">
        <Label>Page Turn Animation</Label>
        <Select value={pageAnimation} onValueChange={setPageAnimation}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="slide">Slide (Smooth)</SelectItem>
            <SelectItem value="fade">Fade (Quick)</SelectItem>
            <SelectItem value="curl">Curl (Paper-like)</SelectItem>
            <SelectItem value="none">None (Instant)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <Label>Typography Presets</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('compact')}
          >
            Compact
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('comfortable')}
          >
            Comfortable
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('large')}
          >
            Large Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('dyslexic')}
          >
            Dyslexia
          </Button>
        </div>
      </div>
    </div>
  </SheetContent>
</Sheet>
```

### Apply Typography to Reading Content

```tsx
<div
  className={cn("reading-content", animationClass)}
  style={{
    fontSize: `${typography.fontSize}px`,
    lineHeight: typography.lineHeight,
    fontFamily: getFontFamily(typography.fontFamily),
    letterSpacing: `${typography.letterSpacing}px`,
    wordSpacing: `${typography.wordSpacing}px`,
    textAlign: typography.textAlign,
    hyphens: typography.hyphenation ? 'auto' : 'none',
  }}
>
  <style jsx>{`
    .reading-content p {
      margin-bottom: ${typography.paragraphSpacing}em;
    }
  `}</style>
  
  {renderPageContent(currentPage)}
</div>

// Font family mapping
const getFontFamily = (font: string) => {
  const fonts = {
    georgia: "'Georgia', serif",
    literata: "'Literata', serif",
    merriweather: "'Merriweather', serif",
    inter: "'Inter', sans-serif",
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };
  return fonts[font] || fonts.georgia;
};
```

### Typography Presets

```tsx
const typographyPresets = {
  compact: {
    fontSize: 14,
    lineHeight: 1.4,
    letterSpacing: 0,
    wordSpacing: 0,
    paragraphSpacing: 1.0,
    textAlign: 'left' as const,
  },
  comfortable: {
    fontSize: 18,
    lineHeight: 1.8,
    letterSpacing: 0,
    wordSpacing: 0,
    paragraphSpacing: 1.5,
    textAlign: 'left' as const,
  },
  large: {
    fontSize: 24,
    lineHeight: 2.0,
    letterSpacing: 1,
    wordSpacing: 2,
    paragraphSpacing: 2.0,
    textAlign: 'left' as const,
  },
  dyslexic: {
    fontSize: 20,
    lineHeight: 2.2,
    letterSpacing: 2,
    wordSpacing: 4,
    paragraphSpacing: 2.0,
    textAlign: 'left' as const,
    fontFamily: 'inter', // More readable for dyslexia
  },
};

const applyPreset = (preset: keyof typeof typographyPresets) => {
  setTypography(prev => ({
    ...prev,
    ...typographyPresets[preset],
  }));
};
```

---

## 🎯 Moon Reader Best Practices Applied

✅ **Smooth Animations** - Multiple animation styles
✅ **Typography Control** - Comprehensive text customization
✅ **Quick Presets** - One-tap optimal settings
✅ **Fine-Tuning** - Sliders for precision
✅ **Accessibility** - Large print & dyslexia modes
✅ **Performance** - CSS animations (60fps)
✅ **Persistence** - Save user preferences

---

## 📊 Performance Optimization

```tsx
// Memoize rendered content
const memoizedContent = useMemo(
  () => renderPageContent(currentPage),
  [currentPage, book.content]
);

// Preload next page
useEffect(() => {
  if (currentPage < totalPages) {
    // Preload next page in background
    const nextPage = renderPageContent(currentPage + 1);
  }
}, [currentPage]);
```

---

## 🚀 Implementation Steps

1. Add CSS animations to `index.css`
2. Add typography state to `ReadingInterface`
3. Create settings panel component
4. Apply styles to reading content
5. Add keyboard shortcuts (optional)
6. Save preferences to localStorage

---

**Result**: Professional e-reader experience matching Moon Reader's quality! 📖✨
