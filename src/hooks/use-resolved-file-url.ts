import { useEffect, useState } from 'react';
import { getBookFile } from '@/lib/fileCache';

interface UseResolvedFileUrlResult {
  url?: string;
  resolving: boolean;
  error?: string;
}

export function useResolvedFileUrl(fileUrl?: string): UseResolvedFileUrlResult {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setError(undefined);

    const run = async () => {
      if (!fileUrl) {
        setUrl(undefined);
        return;
      }

      // Directly usable URLs
      if (fileUrl.startsWith('http') || fileUrl.startsWith('blob:')) {
        setUrl(fileUrl);
        return;
      }

      // Resolve from Supabase Storage
      if (fileUrl.startsWith('supabase://books/')) {
        setResolving(true);
        try {
          const signedUrl = await getBookFile(fileUrl);
          if (!signedUrl) throw new Error('Stored file not found or access denied.');
          if (!cancelled) setUrl(signedUrl);
        } catch (e: any) {
          if (!cancelled) setError(e?.message || 'Failed to load stored file');
        } finally {
          if (!cancelled) setResolving(false);
        }
        return;
      }

      // Legacy IndexedDB support (migrate to Supabase)
      if (fileUrl.startsWith('idb://')) {
        setError('Please re-import this book to use cloud storage.');
        return;
      }

      // Fallback: treat as is
      setUrl(fileUrl);
    };

    run();

    return () => {
      cancelled = true;
      if (revoked) {
        try { URL.revokeObjectURL(revoked); } catch {}
      }
    };
  }, [fileUrl]);

  return { url, resolving, error };
}
