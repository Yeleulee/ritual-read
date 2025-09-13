-- COPY AND PASTE THIS INTO SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS public.books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  cover_url TEXT,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  last_read TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own books" ON public.books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" ON public.books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" ON public.books
  FOR DELETE USING (auth.uid() = user_id);
