import { supabase } from '@/integrations/supabase/client';
import { cacheFile, getCachedFile } from './indexedDBCache';

export async function saveBookFile(file: Blob | File, userId: string): Promise<string> {
  const fileExt = file instanceof File ? file.name.split('.').pop()?.toLowerCase() : 'bin';
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('books')
    .upload(fileName, file, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (error) {
    console.error('Supabase storage upload error:', error);
    // Surfaced to the user; a book row without a file would never open again
    throw new Error(error.message || 'Upload failed');
  }

  const storagePath = `supabase://books/${data.path}`;
  // Cache locally so the first open doesn't download what we just uploaded
  cacheFile(storagePath, file, fileExt || 'bin').catch(() => {});
  return storagePath;
}

export async function getBookFile(keyOrUrl: string): Promise<string | undefined> {
  try {
    if (keyOrUrl.startsWith('supabase://books/')) {
      const cachedBlob = await getCachedFile(keyOrUrl);
      if (cachedBlob) return URL.createObjectURL(cachedBlob);

      const path = keyOrUrl.replace('supabase://books/', '');
      const { data, error } = await supabase.storage.from('books').createSignedUrl(path, 7200);
      if (error || !data?.signedUrl) {
        console.warn('No signed URL returned from Supabase', error);
        return undefined;
      }

      // Download once: the reader gets the bytes we just fetched, and the cache gets them too
      try {
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const fileExt = path.split('.').pop()?.toLowerCase() || 'bin';
        cacheFile(keyOrUrl, blob, fileExt).catch(() => {});
        return URL.createObjectURL(blob);
      } catch (downloadError) {
        console.warn('Direct download failed, streaming from signed URL:', downloadError);
        return data.signedUrl;
      }
    }
    return keyOrUrl;
  } catch (error) {
    console.error('Failed to resolve stored file:', error);
    return undefined;
  }
}

export async function removeBookFile(keyOrUrl: string): Promise<void> {
  try {
    if (keyOrUrl.startsWith('supabase://books/')) {
      const path = keyOrUrl.replace('supabase://books/', '');
      await supabase.storage.from('books').remove([path]);
    }
  } catch (error) {
    console.error('Failed to remove file:', error);
  }
}
