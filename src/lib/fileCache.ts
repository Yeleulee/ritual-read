import { supabase } from '@/integrations/supabase/client';
import { cacheFile, deleteCachedFile, getCachedFile } from './indexedDBCache';
import { extensionOf, mimeForFormat, validateBookFile } from './book-formats';

export const LOCAL_FILE_PREFIX = 'idb://book/';

export async function saveBookFile(file: File, userId: string): Promise<string> {
  // Same whitelist and size cap as the import dialog, so nothing else can reach storage
  const format = validateBookFile(file);
  const fileExt = extensionOf(file.name) || format;
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${fileExt}`;
  // Browsers report EPUBs inconsistently (application/epub, octet-stream, empty); store the canonical type
  const contentType = mimeForFormat(format);

  const { data, error } = await supabase.storage
    .from('books')
    .upload(fileName, file, { contentType, upsert: false });

  if (error) {
    console.error('Supabase storage upload error:', error);
    // Surfaced to the user; a book row without a file would never open again
    throw new Error(error.message || 'Upload failed');
  }

  const storagePath = `supabase://books/${data.path}`;
  // Cache locally so the first open doesn't download what we just uploaded
  cacheFile(storagePath, file, fileExt).catch(() => {});
  return storagePath;
}

/** Keep a file only in this browser (no account / offline mode). Never expires until the book is removed. */
export async function saveLocalBookFile(file: Blob, bookId: string, fileType: string): Promise<string> {
  const key = `${LOCAL_FILE_PREFIX}${bookId}`;
  await cacheFile(key, file, fileType, { pinned: true });
  return key;
}

export async function getBookFile(keyOrUrl: string): Promise<string | undefined> {
  try {
    if (keyOrUrl.startsWith(LOCAL_FILE_PREFIX)) {
      const blob = await getCachedFile(keyOrUrl);
      return blob ? URL.createObjectURL(blob) : undefined;
    }
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
    if (keyOrUrl.startsWith(LOCAL_FILE_PREFIX)) {
      await deleteCachedFile(keyOrUrl);
      return;
    }
    if (keyOrUrl.startsWith('supabase://books/')) {
      const path = keyOrUrl.replace('supabase://books/', '');
      await supabase.storage.from('books').remove([path]);
      deleteCachedFile(keyOrUrl).catch(() => {});
    }
  } catch (error) {
    console.error('Failed to remove file:', error);
  }
}
