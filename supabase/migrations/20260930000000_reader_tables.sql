-- Reader state: per-user settings, last position, bookmarks and highlights.

create table if not exists public.reader_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  location text not null,
  percent numeric(6,5) not null default 0 check (percent >= 0 and percent <= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  location text not null,
  label text,
  excerpt text,
  created_at timestamptz not null default now()
);
create index if not exists bookmarks_user_book_idx on public.bookmarks (user_id, book_id);

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  cfi_range text not null,
  text text not null default '',
  color text not null default 'yellow'
    check (color in ('yellow', 'green', 'blue', 'pink', 'purple', 'underline')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists highlights_user_book_idx on public.highlights (user_id, book_id);

alter table public.reader_settings enable row level security;
alter table public.reading_positions enable row level security;
alter table public.bookmarks enable row level security;
alter table public.highlights enable row level security;

drop policy if exists "reader_settings_own" on public.reader_settings;
create policy "reader_settings_own" on public.reader_settings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reading_positions_own" on public.reading_positions;
create policy "reading_positions_own" on public.reading_positions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bookmarks_own" on public.bookmarks;
create policy "bookmarks_own" on public.bookmarks
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "highlights_own" on public.highlights;
create policy "highlights_own" on public.highlights
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
