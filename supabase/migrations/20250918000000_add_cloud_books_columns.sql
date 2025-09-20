-- Add columns to support persistent storage paths for books
alter table if exists public.books
  add column if not exists bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists cover_path text;

-- Optional helpful indexes
create index if not exists books_storage_path_idx on public.books(storage_path);


