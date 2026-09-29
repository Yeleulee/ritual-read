-- Ritual Read — full Supabase setup (idempotent, safe to re-run)
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
--
-- Sets up:
--   1. public.books table + updated_at trigger + indexes
--   2. Row Level Security so users only see their own rows
--   3. Private "books" storage bucket with per-user folder policies
--      (files live under {user_id}/... and are served via signed URLs)

-- ============================================================
-- 1. books table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.books (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  author       TEXT        NOT NULL,
  progress     INTEGER     DEFAULT 0,
  total_pages  INTEGER     DEFAULT 0,
  cover_url    TEXT,
  content      TEXT,
  file_url     TEXT,
  file_type    TEXT,
  -- storage metadata
  bucket       TEXT,
  storage_path TEXT,
  mime_type    TEXT,
  size_bytes   BIGINT,
  cover_path   TEXT,
  last_read    TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Bring older installs up to date
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS bucket       TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type    TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes   BIGINT,
  ADD COLUMN IF NOT EXISTS cover_path   TEXT;

CREATE INDEX IF NOT EXISTS books_user_id_idx      ON public.books(user_id);
CREATE INDEX IF NOT EXISTS books_last_read_idx    ON public.books(last_read);
CREATE INDEX IF NOT EXISTS books_storage_path_idx ON public.books(storage_path);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_books_updated_at ON public.books;
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Row Level Security on books
-- ============================================================
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own books"   ON public.books;
DROP POLICY IF EXISTS "Users can insert their own books" ON public.books;
DROP POLICY IF EXISTS "Users can update their own books" ON public.books;
DROP POLICY IF EXISTS "Users can delete their own books" ON public.books;

CREATE POLICY "Users can view their own books" ON public.books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" ON public.books
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" ON public.books
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. Storage bucket + per-user folder policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('books', 'books', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Remove every policy name used by previous versions of this script
DROP POLICY IF EXISTS "Users can view their own book files"         ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own book files"       ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files to their own folder"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own book files"       ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own book files"       ON storage.objects;

CREATE POLICY "Users can view their own book files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'books'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload their own book files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'books'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own book files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'books'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'books'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own book files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'books'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

SELECT 'Ritual Read database setup complete' AS status;
