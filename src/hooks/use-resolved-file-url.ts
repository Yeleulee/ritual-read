import { useEffect, useState } from 'react';
import { getBookFile, LOCAL_FILE_PREFIX } from '@/lib/fileCache';

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

      // Resolve from Supabase Storage or this device's IndexedDB
      if (fileUrl.startsWith('supabase://books/') || fileUrl.startsWith(LOCAL_FILE_PREFIX)) {
        const local = fileUrl.startsWith(LOCAL_FILE_PREFIX);
        setResolving(true);
        try {
          const resolved = await getBookFile(fileUrl);
          if (!resolved) {
            throw new Error(local
              ? 'This book was stored only on this device and its file is no longer here. Remove it and import the file again.'
              : 'Could not get signed URL for stored file. File may not exist or access denied.');
          }
          if (!cancelled) setUrl(resolved);
        } catch (e: any) {
          console.error('Error resolving stored file:', e);
          if (!cancelled) {
            setError(e?.message || 'Failed to load stored file');
          }
        } finally {
          if (!cancelled) setResolving(false);
        }
        return;
      }

      // Older local-only entries have no file behind them any more
      if (fileUrl.startsWith('idb://')) {
        setError('This book\'s file is no longer available on this device. Remove it and import the file again.');
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
