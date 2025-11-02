import { supabase } from '@/integrations/supabase/client';
import { cacheFile, getCachedFile } from './indexedDBCache';

export async function saveBookFile(file: Blob | File, userId: string): Promise<string> {
  try {
    const fileExt = file instanceof File ? file.name.split('.').pop()?.toLowerCase() : 'bin';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    console.log('Uploading file to Supabase storage:', fileName);
    
    const { data, error } = await supabase.storage
      .from('books')
      .upload(fileName, file);
    
    if (error) {
      console.error('Supabase storage upload error:', error);
      throw error;
    }
    
    console.log('File uploaded successfully:', data.path);
    
    // Cache the file locally for faster access
    const storagePath = `supabase://books/${data.path}`;
    await cacheFile(storagePath, file, fileExt || 'bin');
    
    return storagePath;
  } catch (error) {
    console.error('Failed to upload to Supabase storage:', error);
    // Fallback to blob URL for immediate use (but this won't persist)
    const blobUrl = URL.createObjectURL(file instanceof File ? file : new Blob([file]));
    console.warn('Using temporary blob URL as fallback:', blobUrl);
    return blobUrl;
  }
}

export async function getBookFile(keyOrUrl: string): Promise<string | undefined> {
  try {
    console.log('Resolving file URL:', keyOrUrl);
    
    if (keyOrUrl.startsWith('supabase://books/')) {
      // Check IndexedDB cache first for faster access
      const cachedBlob = await getCachedFile(keyOrUrl);
      if (cachedBlob) {
        console.log('Using cached file from IndexedDB');
        return URL.createObjectURL(cachedBlob);
      }
      
      const path = keyOrUrl.replace('supabase://books/', '');
      console.log('Getting signed URL for path:', path);
      
      const { data } = await supabase.storage
        .from('books')
        .createSignedUrl(path, 7200); // 2 hour expiry
      
      if (data?.signedUrl) {
        console.log('Successfully created signed URL');
        
        // Download and cache the file for faster future access
        try {
          const response = await fetch(data.signedUrl);
          const blob = await response.blob();
          const fileExt = path.split('.').pop()?.toLowerCase() || 'bin';
          await cacheFile(keyOrUrl, blob, fileExt);
          console.log('File cached for future use');
        } catch (cacheError) {
          console.warn('Failed to cache file:', cacheError);
        }
      } else {
        console.warn('No signed URL returned from Supabase');
      }
      
      return data?.signedUrl;
    }
    
    // Handle blob URLs
    if (keyOrUrl.startsWith('blob:')) {
      console.log('Using blob URL directly:', keyOrUrl);
      return keyOrUrl;
    }
    
    // Handle HTTP URLs
    if (keyOrUrl.startsWith('http')) {
      console.log('Using HTTP URL directly:', keyOrUrl);
      return keyOrUrl;
    }
    
    // Return as-is for other URLs
    console.log('Using URL as-is:', keyOrUrl);
    return keyOrUrl;
  } catch (error) {
    console.error('Failed to get signed URL:', error);
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
