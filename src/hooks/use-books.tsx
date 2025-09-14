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
    if (!user) {
      console.log('No user, skipping book load');
      setBooks([]);
      setLoading(false);
      return;
    }

    console.log('Loading books for user:', user.id);

    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('last_read', { ascending: false });

      if (error) {
        console.error('Error loading books:', error);
        // If table doesn't exist, just start with empty books array
        if (
          error.code === 'PGRST116' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes("Could not find the table 'public.books'")
        ) {
          console.warn('Books table not available yet. Using local library fallback.');
          const local = readLocalBooks();
          setBooks(local);
          setLoading(false);
          return;
        }
        throw error;
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

      setBooks(formattedBooks);
      // Keep a mirrored local cache for instant loads
      writeLocalBooks(formattedBooks);
    } catch (error: any) {
      console.error('Error loading books:', error);
      toast({
        title: "Error Loading Books",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Add a new book
  const addBook = async (newBook: Omit<BookItem, 'id'>) => {
    if (!user) {
      console.error('No user found when trying to add book');
      return;
    }

    console.log('Adding book for user:', user.id, 'Book:', newBook.title);

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

      console.log('Inserting book data:', bookData);

      const { data, error } = await supabase
        .from('books')
        .insert([bookData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        
        // If table doesn't exist, show a helpful message
        if (
          error.code === 'PGRST116' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes("Could not find the table 'public.books'")
        ) {
          // Fallback: save locally so the user can keep using the app
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
          setBooks((prev) => {
            const next = [localBook, ...prev];
            writeLocalBooks(next);
            return next;
          });
          toast({
            title: 'Saved Locally',
            description: 'Your book was saved on this device. The cloud will sync once the database is ready.',
          });
          toast({
            title: "Database Setup Required",
            description: "Please run the SQL migration in your Supabase dashboard first. Check the console for instructions.",
            variant: "destructive",
          });
          console.error(`
🚨 DATABASE SETUP REQUIRED 🚨

The 'books' table doesn't exist in your Supabase database yet.

STEPS TO FIX:
1. Go to https://supabase.com/dashboard
2. Select your project: liqdfaxmmqpovjptmaxe  
3. Go to "SQL Editor" 
4. Run this SQL:

CREATE TABLE IF NOT EXISTS public.books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  cover_url TEXT,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  last_read TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own books" ON public.books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" ON public.books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" ON public.books
  FOR DELETE USING (auth.uid() = user_id);
          `);
          return;
        }
        
        throw error;
      }

      const formattedBook: BookItem = {
        id: data.id,
        title: data.title,
        author: data.author,
        progress: data.progress,
        totalPages: data.total_pages,
        coverUrl: data.cover_url,
        content: data.content,
        fileUrl: data.file_url,
        fileType: data.file_type,
        lastRead: data.last_read ? new Date(data.last_read) : undefined,
      };

      setBooks(prev => {
        const next = [formattedBook, ...prev];
        writeLocalBooks(next);
        return next;
      });
      return formattedBook;
    } catch (error: any) {
      console.error('Error adding book:', error);
      
      // More detailed error message
      let errorMessage = error.message || 'Unknown error occurred';
      if (error.code) {
        errorMessage = `${error.code}: ${errorMessage}`;
      }
      if (error.hint) {
        errorMessage += ` (Hint: ${error.hint})`;
      }
      
      toast({
        title: "Error Adding Book",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Update book progress
  const updateBookProgress = async (bookId: string, progress: number) => {
    if (!user) return;

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
        // Update local cache if cloud update fails
        setBooks((prev) => {
          const next = prev.map((b) => (b.id === bookId ? { ...b, progress, lastRead: new Date() } : b));
          writeLocalBooks(next);
          return next;
        });
        throw error;
      }

      setBooks(prev => {
        const next = prev.map(book => 
          book.id === bookId 
            ? { ...book, progress, lastRead: new Date() }
            : book
        );
        writeLocalBooks(next);
        return next;
      });
    } catch (error: any) {
      console.error('Error updating book progress:', error);
      toast({
        title: "Error Updating Progress",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Remove a book
  const removeBook = async (bookId: string) => {
    if (!user) {
      // Fallback: remove from local cache only
      setBooks((prev) => {
        const next = prev.filter((b) => b.id !== bookId);
        writeLocalBooks(next);
        return next;
      });
      toast({
        title: 'Removed from device',
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
        // If table missing or server-side issue, remove locally so user can proceed
        if (
          error.code === 'PGRST116' ||
          error.code === 'PGRST205' ||
          error.message?.includes('does not exist') ||
          error.message?.includes("Could not find the table 'public.books'")
        ) {
          setBooks((prev) => {
            const next = prev.filter((b) => b.id !== bookId);
            writeLocalBooks(next);
            return next;
          });
          toast({
            title: 'Removed locally',
            description: 'Book removed on this device. Cloud will sync when available.',
          });
          return;
        }
        throw error;
      }

      setBooks((prev) => {
        const next = prev.filter((b) => b.id !== bookId);
        writeLocalBooks(next);
        return next;
      });
      toast({ title: 'Book removed' });
    } catch (error: any) {
      console.error('Error removing book:', error);
      toast({
        title: 'Error Removing Book',
        description: error.message || 'Unknown error',
        variant: 'destructive',
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
