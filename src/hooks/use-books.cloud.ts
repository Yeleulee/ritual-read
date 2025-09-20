import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { uploadBookFile, createBookRow, resolveFileUrl, BOOKS_BUCKET } from '@/integrations/supabase/books';

export type CloudBook = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  total_pages: number | null;
  cover_path: string | null;
  last_read: string | null;
  created_at: string;
  updated_at: string;
};

export function useBooks() {
  const { user } = useAuth();
  return useQuery<CloudBook[]>({
    queryKey: ['cloud-books', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user!.id)
        .order('last_read', { ascending: false });
      if (error) throw error;
      return data as CloudBook[];
    },
    staleTime: 60_000,
  });
}

export function useBook(id: string | null) {
  const { user } = useAuth();
  return useQuery<{ book: CloudBook; fileUrl: string; signed: boolean }>({
    queryKey: ['cloud-book', user?.id, id],
    enabled: Boolean(user?.id && id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id!)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      const book = data as CloudBook;
      const { url, signed } = await resolveFileUrl(book.storage_path, book.bucket || BOOKS_BUCKET);
      return { book, fileUrl: url, signed };
    },
    staleTime: 0,
    gcTime: 5 * 60_000,
  });
}

export function useUploadBook() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['cloud-upload-book', user?.id],
    mutationFn: async (params: { file: File; title: string; author?: string | null; totalPages?: number | null }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const uploaded = await uploadBookFile(user.id, params.file, params.title);
      const row = await createBookRow({
        userId: user.id,
        title: params.title,
        author: params.author ?? null,
        bucket: uploaded.bucket,
        storagePath: uploaded.storagePath,
        mimeType: uploaded.mimeType ?? null,
        sizeBytes: uploaded.sizeBytes ?? null,
        totalPages: params.totalPages ?? null,
      });
      return row as CloudBook;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloud-books'] });
    },
  });
}


