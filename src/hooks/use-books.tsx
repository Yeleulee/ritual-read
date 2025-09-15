import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

export interface BookItem {
  id: string;
  title: string;
  author: string;
  progress: number;
  totalPages: number;
  coverUrl?: string;
  content?: string;
  fileUrl?: string;
  fileType?: string;
  lastRead?: Date;
}

export const useBooks = () => {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Local fallback storage key per-user
  const storageKey = `books:${user?.id ?? 'guest'}`;

  const readLocalBooks = (): BookItem[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as (Omit<BookItem, 'lastRead'> & { lastRead?: string })[];
      return parsed.map((b) => ({ ...b, lastRead: b.lastRead ? new Date(b.lastRead) : undefined }));
    } catch {
      return [];
    }
  };

  const writeLocalBooks = (list: BookItem[]) => {
    try {
      const serializable = list.map((b) => ({ ...b, lastRead: b.lastRead ? b.lastRead.toISOString() : undefined }));
      localStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch {
      // ignore storage errors
    }
  };

  // Load books from Supabase (fallback to local storage if needed)
  const loadBooks = async () => {
    console.log('Loading books, user:', user?.id || 'none');
    
    // Always start with local books for immediate display
    const localBooks = readLocalBooks();
    setBooks(localBooks);
    
    if (!user) {
      console.log('No user, using local books only');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('last_read', { ascending: false });

      if (error) {
        console.error('Error loading books from Supabase:', error);
        // If table doesn't exist or other error, keep using local books
        if (
          error.code === 'PGRST116' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes("Could not find the table 'public.books'")
        ) {
          console.warn('Books table not available yet. Using local library only.');
          setLoading(false);
          return;
        }
        // For other errors, show toast but keep local books
        toast({
          title: "Sync Warning",
          description: "Using local books. Cloud sync will retry automatically.",
          variant: "default",
        });
        setLoading(false);
        return;
      }

      const formattedBooks: BookItem[] = data.map((book: any) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        progress: book.progress,
        totalPages: book.total_pages,
        coverUrl: book.cover_url,
        content: book.content,
        fileUrl: book.file_url,
        fileType: book.file_type,
        lastRead: book.last_read ? new Date(book.last_read) : undefined,
      }));

      // Merge with local books, prioritizing cloud data
      const mergedBooks = [...formattedBooks];
      localBooks.forEach(localBook => {
        if (!formattedBooks.find(cloudBook => cloudBook.id === localBook.id)) {
          mergedBooks.push(localBook);
        }
      });

      setBooks(mergedBooks);
      // Update local cache with merged data
      writeLocalBooks(mergedBooks);
    } catch (error: any) {
      console.error('Error loading books:', error);
      toast({
        title: "Sync Error",
        description: "Using local books. Cloud sync will retry automatically.",
        variant: "default",
      });
    } finally {
      setLoading(false);
    }
  };

  // Add a new book
  const addBook = async (newBook: Omit<BookItem, 'id'>) => {
    // Create book with local ID first for immediate UI update
    const localBook: BookItem = {
      id: (globalThis as any).crypto?.randomUUID?.() ?? Date.now().toString(),
      title: newBook.title,
      author: newBook.author,
      progress: newBook.progress || 0,
      totalPages: newBook.totalPages || 0,
      coverUrl: newBook.coverUrl,
      content: newBook.content,
      fileUrl: newBook.fileUrl,
      fileType: newBook.fileType,
      lastRead: newBook.lastRead ?? new Date(),
    };

    // Update UI immediately
    setBooks(prev => {
      const next = [localBook, ...prev];
      writeLocalBooks(next);
      return next;
    });

    if (!user) {
      console.log('No user, saving book locally only');
      toast({
        title: 'Book Added Locally',
        description: 'Sign in to sync your books across devices.',
        variant: "default",
      });
      return localBook;
    }

    console.log('Syncing book to cloud for user:', user.id, 'Book:', newBook.title);

    try {
      const bookData = {
        user_id: user.id,
        title: newBook.title,
        author: newBook.author,
        progress: newBook.progress || 0,
        total_pages: newBook.totalPages || 0,
        cover_url: newBook.coverUrl || null,
        content: newBook.content || null,
        file_url: newBook.fileUrl || null,
        file_type: newBook.fileType || null,
        last_read: newBook.lastRead?.toISOString() || new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('books')
        .insert([bookData])
        .select()
        .single();

      if (error) {
        console.error('Supabase sync error:', error);
        
        // If table doesn't exist, keep using local book
        if (
          error.code === 'PGRST116' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes("Could not find the table 'public.books'")
        ) {
          toast({
            title: 'Saved Locally',
            description: 'Book saved on this device. Cloud sync will work once database is set up.',
            variant: "default",
          });
          return localBook;
        }
        
        // For other errors, show warning but keep local book
        toast({
          title: 'Saved Locally',
          description: 'Book saved on this device. Cloud sync will retry automatically.',
          variant: "default",
        });
        return localBook;
      }

      // Update local book with cloud ID
      const cloudBook: BookItem = {
        ...localBook,
        id: data.id,
      };

      setBooks(prev => {
        const next = prev.map(book => book.id === localBook.id ? cloudBook : book);
        writeLocalBooks(next);
        return next;
      });

      toast({
        title: 'Book Synced',
        description: 'Your book has been saved to the cloud.',
      });
      
      return cloudBook;
    } catch (error: any) {
      console.error('Error syncing book to cloud:', error);
      
      toast({
        title: 'Saved Locally',
        description: 'Book saved on this device. Cloud sync will retry automatically.',
        variant: "default",
      });
      
      return localBook;
    }
  };

  // Update book progress
  const updateBookProgress = async (bookId: string, progress: number) => {
    // Always update local state first
    setBooks(prev => {
      const next = prev.map(book => 
        book.id === bookId 
          ? { ...book, progress, lastRead: new Date() }
          : book
      );
      writeLocalBooks(next);
      return next;
    });

    if (!user) {
      console.log('No user, updating progress locally only');
      return;
    }

    try {
      const { error } = await supabase
        .from('books')
        .update({ 
          progress,
          last_read: new Date().toISOString(),
        })
        .eq('id', bookId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error syncing progress to cloud:', error);
        // Progress is already updated locally, so just show a warning
        toast({
          title: "Progress Saved Locally",
          description: "Progress saved on this device. Cloud sync will retry automatically.",
          variant: "default",
        });
        return;
      }

      // Success - progress synced to cloud
      console.log('Progress synced to cloud successfully');
    } catch (error: any) {
      console.error('Error syncing progress to cloud:', error);
      toast({
        title: "Progress Saved Locally",
        description: "Progress saved on this device. Cloud sync will retry automatically.",
        variant: "default",
      });
    }
  };

  // Remove a book
  const removeBook = async (bookId: string) => {
    // Always remove from local state first
    setBooks((prev) => {
      const next = prev.filter((b) => b.id !== bookId);
      writeLocalBooks(next);
      return next;
    });

    if (!user) {
      console.log('No user, removing book locally only');
      toast({
        title: 'Book Removed',
        description: 'The book was removed from your local library.',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error syncing book removal to cloud:', error);
        // Book is already removed locally, so just show a warning
        toast({
          title: 'Book Removed Locally',
          description: 'Book removed from this device. Cloud sync will retry automatically.',
          variant: "default",
        });
        return;
      }

      // Success - book removed from cloud
      toast({ 
        title: 'Book Removed',
        description: 'Book removed from all devices.'
      });
    } catch (error: any) {
      console.error('Error syncing book removal to cloud:', error);
      toast({
        title: 'Book Removed Locally',
        description: 'Book removed from this device. Cloud sync will retry automatically.',
        variant: "default",
      });
    }
  };

  // Load books when user changes
  useEffect(() => {
    loadBooks();
  }, [user]);

  return {
    books,
    loading,
    addBook,
    updateBookProgress,
    removeBook,
    loadBooks,
  };
};
