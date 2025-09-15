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

      // Resolve from IndexedDB
      if (fileUrl.startsWith('idb://')) {
        setResolving(true);
        try {
          const blob = await getBookFile(fileUrl);
          if (!blob) throw new Error('Stored file not found on this device.');
          const obj = URL.createObjectURL(blob);
          revoked = obj;
          if (!cancelled) setUrl(obj);
        } catch (e: any) {
          if (!cancelled) setError(e?.message || 'Failed to load stored file');
        } finally {
          if (!cancelled) setResolving(false);
        }
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
