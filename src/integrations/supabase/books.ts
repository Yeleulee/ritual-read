import { supabase } from '@/integrations/supabase/client';

export const BOOKS_BUCKET = 'books';

const MAX_FILE_MB = 100;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'application/octet-stream',
];

export function validateBookFile(file: File) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');
  if (!isPdf && !isEpub && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Unsupported file type. Please upload PDF or EPUB.');
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_MB) throw new Error(`File too large. Max ${MAX_FILE_MB}MB`);
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export async function uploadBookFile(userId: string, file: File, title: string) {
  validateBookFile(file);
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const key = `${userId}/files/${crypto.randomUUID()}-${slugify(title || file.name)}.${ext}`;

  const { error } = await supabase.storage.from(BOOKS_BUCKET).upload(key, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  return {
    bucket: BOOKS_BUCKET,
    storagePath: key,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
  };
}

export async function getBucketIsPublic(bucket = BOOKS_BUCKET): Promise<boolean> {
  // Best-effort check; assume private on error
  const { data, error } = await (supabase as any).storage.getBucket(bucket);
  if (error) return false;
  return Boolean(data?.public);
}

export async function resolveFileUrl(storagePath: string, bucket = BOOKS_BUCKET): Promise<{ url: string; signed: boolean }> {
  const isPublic = await getBucketIsPublic(bucket);
  if (isPublic) {
    const { data } = (supabase as any).storage.from(bucket).getPublicUrl(storagePath);
    return { url: data.publicUrl, signed: false };
  }
  const { data, error } = await (supabase as any).storage.from(bucket).createSignedUrl(storagePath, 60 * 5);
  if (error) throw error;
  return { url: data.signedUrl, signed: true };
}

export async function createBookRow(params: {
  userId: string;
  title: string;
  author?: string | null;
  bucket: string;
  storagePath: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  totalPages?: number | null;
  coverPath?: string | null;
}) {
  // Use any-cast to avoid strict coupling to generated Database types
  const { data, error } = await (supabase as any)
    .from('books')
    .insert({
      user_id: params.userId,
      title: params.title,
      // Ensure non-null author to satisfy NOT NULL schema
      author: (params.author ?? '').trim() || 'Unknown Author',
      // New columns (ensure migration added them in DB)
      bucket: params.bucket,
      storage_path: params.storagePath,
      mime_type: params.mimeType ?? null,
      size_bytes: params.sizeBytes ?? null,
      total_pages: params.totalPages ?? null,
      cover_path: params.coverPath ?? null,
      last_read: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}


