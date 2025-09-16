-- Run this in your Supabase SQL Editor to set up the storage bucket

-- Create public storage bucket for books
INSERT INTO storage.buckets (id, name, public)
VALUES ('books', 'books', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the books bucket
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
  );

CREATE POLICY "Users can delete their own book files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'books'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Make the bucket public for easier access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'books';
