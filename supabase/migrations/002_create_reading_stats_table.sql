-- Reading stats per day per user
create table if not exists public.reading_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  seconds integer not null default 0,
  pages integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_stats_user_date_unique unique (user_id, date)
);

alter table public.reading_stats enable row level security;

-- Policies: users can only manage their own rows
create policy "Users can view their own reading stats" on public.reading_stats
  for select using (auth.uid() = user_id);

create policy "Users can insert their own reading stats" on public.reading_stats
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own reading stats" on public.reading_stats
  for update using (auth.uid() = user_id);

create policy "Users can delete their own reading stats" on public.reading_stats
  for delete using (auth.uid() = user_id);

-- Trigger to update updated_at on row updates
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_reading_stats_updated_at on public.reading_stats;
create trigger set_reading_stats_updated_at
before update on public.reading_stats
for each row execute function public.set_updated_at();


