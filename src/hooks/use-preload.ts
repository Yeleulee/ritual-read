import { useEffect } from 'react';
import { preloader } from '@/lib/preloader';

interface BookItem {
  id: string;
  fileUrl?: string;
  fileType?: string;
  lastRead?: Date;
}

/**
 * Hook to automatically preload recent books for faster access
 * Call this in your main app component or library view
 */
export function useAutoPreload(books: BookItem[], enabled = true) {
  useEffect(() => {
    if (!enabled || !books || books.length === 0) return;

    // Small delay to avoid blocking initial render
    const timer = setTimeout(() => {
      preloader.preloadRecent(books, 5).catch(err => {
        console.warn('Failed to preload recent books:', err);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [books, enabled]);
}

/**
 * Hook to preload a specific book with high priority
 * Useful when user hovers over a book card
 */
export function usePreloadBook(
  bookId: string | null,
  fileUrl: string | undefined,
  fileType: string | undefined
) {
  useEffect(() => {
    if (!bookId || !fileUrl || !fileType) return;

    preloader.preload(bookId, fileUrl, fileType, 'high').catch(err => {
      console.warn('Failed to preload book:', err);
    });
  }, [bookId, fileUrl, fileType]);
}
