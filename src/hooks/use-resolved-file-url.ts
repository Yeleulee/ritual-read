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
    let cancelled = false;
    setError(undefined);
    setResolving(false);

    const run = async () => {
      if (!fileUrl) {
        setUrl(undefined);
        setResolving(false);
        return;
      }

      console.log('Resolving file URL:', fileUrl);

      // Directly usable URLs
      if (fileUrl.startsWith('http') || fileUrl.startsWith('blob:')) {
        console.log('Using URL directly:', fileUrl);
        setUrl(fileUrl);
        setResolving(false);
        return;
      }

      // Resolve from Supabase Storage
      if (fileUrl.startsWith('supabase://books/')) {
        console.log('Resolving Supabase storage URL');
        setResolving(true);
        try {
          const signedUrl = await getBookFile(fileUrl);
          if (!signedUrl) {
            throw new Error('Could not get signed URL for stored file. File may not exist or access denied.');
          }
          if (!cancelled) {
            console.log('Successfully resolved Supabase URL');
            setUrl(signedUrl);
          }
        } catch (e: any) {
          console.error('Error resolving Supabase URL:', e);
          if (!cancelled) {
            setError(e?.message || 'Failed to load stored file');
          }
        } finally {
          if (!cancelled) setResolving(false);
        }
        return;
      }

      // Legacy IndexedDB support (migrate to Supabase)
      if (fileUrl.startsWith('idb://')) {
        console.warn('Legacy IndexedDB URL detected');
        setError('Please re-import this book to use cloud storage.');
        setResolving(false);
        return;
      }

      // Fallback: treat as is
      console.log('Using fallback URL handling');
      setUrl(fileUrl);
      setResolving(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return { url, resolving, error };
}
