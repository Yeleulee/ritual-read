import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, DEV_AUTH_BYPASS } from './use-auth';
import { useToast } from './use-toast';
import { removeBookFile, saveBookFile, saveLocalBookFile } from '@/lib/fileCache';

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
  const addBook = async ({ file, storedUrl, ...newBook }: Omit<BookItem, 'id'> & { file?: File; storedUrl?: Promise<string> }) => {
    const newId = () => (globalThis as any).crypto?.randomUUID?.() ?? Date.now().toString();

    // A blob: URL dies with the tab, so a book kept on this device stores its file in IndexedDB instead
    const keepFileLocally = async (id: string): Promise<string | undefined> => {
      let blob: Blob | undefined = file;
      if (!blob && newBook.fileUrl?.startsWith('blob:')) {
        try {
          blob = await (await fetch(newBook.fileUrl)).blob();
        } catch {
          blob = undefined;
        }
      }
      if (!blob) return newBook.fileUrl && !newBook.fileUrl.startsWith('blob:') ? newBook.fileUrl : undefined;
      try {
        return await saveLocalBookFile(blob, id, newBook.fileType ?? 'bin');
      } catch (error) {
        console.warn('Could not store the file on this device; it will only open in this session', error);
        return newBook.fileUrl;
      }
    };

    const saveLocally = async (description: string): Promise<BookItem> => {
      const id = newId();
      const localBook: BookItem = {
        id,
        title: newBook.title,
        author: newBook.author,
        progress: newBook.progress || 0,
        totalPages: newBook.totalPages || 0,
        coverUrl: newBook.coverUrl,
        content: newBook.content,
        fileUrl: await keepFileLocally(id),
        fileType: newBook.fileType,
        lastRead: newBook.lastRead ?? new Date(),
      };
      setBooks((prev) => {
        const next = [localBook, ...prev];
        writeLocalBooks(next);
        return next;
      });
      toast({ title: 'Book Saved Locally', description });
      return localBook;
    };

    if (isLocal) {
      console.log('No user, saving book locally');
      return saveLocally('Your book was saved on this device.');
    }

    console.log('Adding book for user:', user.id, 'Book:', newBook.title);

    try {
      let fileUrl = newBook.fileUrl;
      let coverUrl = newBook.coverUrl;

      // The file must live in storage before the row exists, otherwise the book can never open again.
      // Usually the upload started when the file was picked; otherwise start it now.
      if (storedUrl || file || (newBook.fileUrl && newBook.fileUrl.startsWith('blob:'))) {
        try {
          const upload = async () => {
            if (file) return saveBookFile(file, user.id);
            // Only a blob: URL is left; rebuild a File so the validator knows the format
            const blob = await (await fetch(newBook.fileUrl!)).blob();
            return saveBookFile(new File([blob], `${newBook.title || 'book'}.${newBook.fileType ?? 'bin'}`, { type: blob.type }), user.id);
          };
          fileUrl = await (storedUrl ?? upload());
        } catch (uploadError) {
          const reason = uploadError instanceof Error ? uploadError.message : 'storage error';
          throw new Error(`Couldn't upload the file: ${reason}. Check your connection and try again.`);
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
        // The uploaded copy has no row pointing at it; don't leave it in the bucket
        if (fileUrl?.startsWith('supabase://')) removeBookFile(fileUrl).catch(() => {});
        return saveLocally('Your book was saved on this device. It will sync to the cloud when the database is ready.');
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
    const storedUrl = books.find((b) => b.id === bookId)?.fileUrl;
    if (isLocal) {
      // Fallback: remove from local cache only
      setBooks((prev) => {
        const next = prev.filter((b) => b.id !== bookId);
        writeLocalBooks(next);
        return next;
      });
      if (storedUrl) removeBookFile(storedUrl).catch(() => {});
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
      if (storedUrl) await removeBookFile(storedUrl);

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

  // Start storing a file before the user has finished the import dialog; resolves to the storage path.
  // Returns null in local mode, where files stay in the browser.
  const prepareUpload = (file: File): Promise<string> | null => (isLocal ? null : saveBookFile(file, user.id));

  // The dialog was cancelled (or the file swapped) after an upload began: delete the stored copy
  const discardUpload = (storedUrl: Promise<string>) => {
    storedUrl.then((url) => removeBookFile(url)).catch(() => {});
  };

  return {
    books,
    loading,
    addBook,
    prepareUpload,
    discardUpload,
    updateBookProgress,
    removeBook,
    loadBooks,
  };
};
