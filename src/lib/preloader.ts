import { getCachedFile, cacheFile } from './indexedDBCache';

interface PreloadTask {
  id: string;
  url: string;
  priority: 'high' | 'medium' | 'low';
  fileType: string;
}

class FilePreloader {
  private queue: PreloadTask[] = [];
  private loading: Set<string> = new Set();
  private maxConcurrent = 2;

  /**
   * Add a file to the preload queue
   */
  async preload(id: string, url: string, fileType: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    // Check if already cached
    const cached = await getCachedFile(id);
    if (cached) {
      console.log(`File already cached: ${id}`);
      return;
    }

    // Check if already in queue or loading
    if (this.loading.has(id) || this.queue.some(task => task.id === id)) {
      console.log(`File already queued: ${id}`);
      return;
    }

    // Add to queue based on priority
    const task: PreloadTask = { id, url, fileType, priority };
    
    if (priority === 'high') {
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }

    this.processQueue();
  }

  /**
   * Preload recently accessed files
   */
  async preloadRecent(books: Array<{ id: string; fileUrl?: string; fileType?: string; lastRead?: Date }>, limit = 5): Promise<void> {
    // Sort by last read date
    const recent = books
      .filter(book => book.fileUrl && book.fileType && book.lastRead)
      .sort((a, b) => (b.lastRead?.getTime() || 0) - (a.lastRead?.getTime() || 0))
      .slice(0, limit);

    for (const book of recent) {
      if (book.fileUrl && book.fileType) {
        await this.preload(book.id, book.fileUrl, book.fileType, 'low');
      }
    }
  }

  /**
   * Prefetch next pages of a document for smoother navigation
   */
  async prefetchAdjacentPages(currentUrl: string, currentPage: number, totalPages: number): Promise<void> {
    // This is a placeholder for future implementation
    // In PDF/EPUB readers, we could prefetch adjacent pages
    console.log(`Prefetch pages near ${currentPage}/${totalPages} for ${currentUrl}`);
  }

  /**
   * Process the preload queue
   */
  private async processQueue(): Promise<void> {
    if (this.loading.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.loading.add(task.id);

    try {
      console.log(`Preloading file: ${task.id} (priority: ${task.priority})`);
      
      const response = await fetch(task.url);
      if (!response.ok) {
        throw new Error(`Failed to preload: ${response.statusText}`);
      }

      const blob = await response.blob();
      await cacheFile(task.id, blob, task.fileType);
      
      console.log(`Successfully preloaded: ${task.id}`);
    } catch (error) {
      console.error(`Failed to preload ${task.id}:`, error);
    } finally {
      this.loading.delete(task.id);
      
      // Process next item in queue
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  /**
   * Clear the preload queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Get queue status
   */
  getStatus(): { queued: number; loading: number } {
    return {
      queued: this.queue.length,
      loading: this.loading.size,
    };
  }
}

// Singleton instance
export const preloader = new FilePreloader();

/**
 * Hook-friendly preload function
 */
export function usePreloader() {
  return {
    preload: preloader.preload.bind(preloader),
    preloadRecent: preloader.preloadRecent.bind(preloader),
    clearQueue: preloader.clearQueue.bind(preloader),
    getStatus: preloader.getStatus.bind(preloader),
  };
}
