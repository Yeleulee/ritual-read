-- Create books table with Row Level Security
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security on auth.users if not already enabled
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create books table
CREATE TABLE books (
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

-- Enable RLS on books table
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- Create policies for books table
CREATE POLICY "Users can view their own books" ON books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books" ON books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" ON books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" ON books
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX books_user_id_idx ON books(user_id);
CREATE INDEX books_last_read_idx ON books(last_read);
