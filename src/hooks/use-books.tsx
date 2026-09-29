import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, DEV_AUTH_BYPASS } from './use-auth';
import { useToast } from './use-toast';
import { saveBookFile } from '@/lib/fileCache';

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
  // Dev bypass has a fake user but no backend — treat as local-only
  const isLocal = !user || DEV_AUTH_BYPASS;

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
    try {
      // Always try to load local books first for instant display
      const localBooks = readLocalBooks();
      setBooks(localBooks);
      setLoading(false);

      if (isLocal) {
        console.log('No user, using local books only');
        return;
      }

      console.log('Loading books for user:', user.id);

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('last_read', { ascending: false });

      console.log('Books query result:', { data, error });

      if (error) {
        console.error('Error loading books:', error);
        // Keep local books on error
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

      // Update with server data
      setBooks(formattedBooks);
      // Keep local cache in sync
      writeLocalBooks(formattedBooks);
    } catch (error: any) {
      console.error('Error loading books:', error);
      // Keep any local books on error
    }
  };

  // Add a new book
  const addBook = async ({ file, ...newBook }: Omit<BookItem, 'id'> & { file?: File }) => {
    if (isLocal) {
      console.log('No user, saving book locally');
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
        title: 'Book Saved Locally',
        description: 'Your book was saved on this device.',
      });

      return localBook;
    }

    console.log('Adding book for user:', user.id, 'Book:', newBook.title);
    console.log('User object:', user);
    console.log('Supabase client available:', !!supabase);

    // Test authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();
    console.log('Auth test:', { authData, authError });

    try {
      let fileUrl = newBook.fileUrl;
      let coverUrl = newBook.coverUrl;

      // Upload file to Supabase Storage for permanent storage
      if (file || (newBook.fileUrl && newBook.fileUrl.startsWith('blob:'))) {
        try {
          const toUpload = file ?? (await (await fetch(newBook.fileUrl!)).blob());
          const uploadedUrl = await saveBookFile(toUpload, user.id);

          if (uploadedUrl.startsWith('supabase://')) {
            fileUrl = uploadedUrl;
            console.log('File uploaded to storage:', fileUrl);
          } else {
            console.warn('Storage upload failed, using blob URL as fallback');
            fileUrl = newBook.fileUrl;
          }
        } catch (uploadError) {
          console.warn('Failed to upload file to storage, using blob URL:', uploadError);
          fileUrl = newBook.fileUrl; // Fallback to blob URL
        }
      }

      // Keep cover as data URL for now
      if (newBook.coverUrl && newBook.coverUrl.startsWith('data:')) {
        coverUrl = newBook.coverUrl; // Keep the data URL
        console.log('Using data URL for cover:', coverUrl);
      }

      const bookData = {
        user_id: user.id,
        title: newBook.title,
        author: newBook.author,
        progress: newBook.progress || 0,
        total_pages: newBook.totalPages || 0,
        cover_url: coverUrl || null,
        content: newBook.content || null,
        // blob: URLs die with the tab, so never persist one
        file_url: fileUrl && !fileUrl.startsWith('blob:') ? fileUrl : null,
        file_type: newBook.fileType || null,
        last_read: newBook.lastRead?.toISOString() || new Date().toISOString(),
      };

      console.log('Inserting book data:', bookData);

      const { data, error } = await supabase
        .from('books')
        .insert([bookData])
        .select()
        .single();

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);

        // If table doesn't exist or any other error, save locally as fallback
        console.warn('Database error, saving locally:', error);

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
          title: 'Book Saved Locally',
          description: 'Your book was saved on this device. It will sync to the cloud when the database is ready.',
        });

        return localBook;
      }

      // Immediately update UI for better UX
      const formattedBook: BookItem = {
        id: data.id,
        title: data.title,
        author: data.author,
        progress: data.progress,
        totalPages: data.total_pages,
        coverUrl: data.cover_url,
        content: data.content,
        // Keep the in-memory blob URL for this session if the upload failed
        fileUrl: data.file_url ?? fileUrl,
        fileType: data.file_type,
        lastRead: data.last_read ? new Date(data.last_read) : undefined,
      };

      setBooks(prev => {
        const next = [formattedBook, ...prev];
        writeLocalBooks(next);
        return next;
      });

      toast({
        title: 'Book Added',
        description: 'Your book has been saved successfully.',
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
    if (isLocal) {
      setBooks((prev) => {
        const next = prev.map((b) => (b.id === bookId ? { ...b, progress, lastRead: new Date() } : b));
        writeLocalBooks(next);
        return next;
      });
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
    if (isLocal) {
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

      // Row is gone; drop the uploaded file too so storage doesn't accumulate orphans
      const storedUrl = books.find((b) => b.id === bookId)?.fileUrl;
      if (storedUrl?.startsWith('supabase://books/')) {
        const { error: rmError } = await supabase.storage
          .from('books')
          .remove([storedUrl.replace('supabase://books/', '')]);
        if (rmError) console.warn('Book row deleted but file removal failed:', rmError);
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
    console.log('useBooks: User changed, loading books. User:', user);
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
