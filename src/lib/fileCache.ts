import { supabase } from '@/integrations/supabase/client';

export async function saveBookFile(file: Blob | File, userId: string): Promise<string> {
  try {
    const fileExt = file instanceof File ? file.name.split('.').pop() : 'bin';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('books')
      .upload(fileName, file);
    
    if (error) throw error;
    
    return `supabase://books/${data.path}`;
  } catch (error) {
    console.error('Failed to upload to Supabase storage:', error);
    // Fallback to blob URL for immediate use
    return URL.createObjectURL(file instanceof File ? file : new Blob([file]));
  }
}

export async function getBookFile(keyOrUrl: string): Promise<string | undefined> {
  try {
    if (keyOrUrl.startsWith('supabase://books/')) {
      const path = keyOrUrl.replace('supabase://books/', '');
      const { data } = await supabase.storage
        .from('books')
        .createSignedUrl(path, 3600); // 1 hour expiry
      
      return data?.signedUrl;
    }
    
    // Return as-is for other URLs
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
