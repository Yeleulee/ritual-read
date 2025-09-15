-- Create reading_stats table with Row Level Security
-- Run this in your Supabase SQL Editor

-- Create reading_stats table
CREATE TABLE reading_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  seconds INTEGER DEFAULT 0,
  pages INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS on reading_stats table
ALTER TABLE reading_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for reading_stats table
CREATE POLICY "Users can view their own reading stats" ON reading_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading stats" ON reading_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading stats" ON reading_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading stats" ON reading_stats
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_reading_stats_updated_at BEFORE UPDATE ON reading_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX reading_stats_user_id_idx ON reading_stats(user_id);
CREATE INDEX reading_stats_date_idx ON reading_stats(date);
CREATE INDEX reading_stats_user_date_idx ON reading_stats(user_id, date);
