-- Storage RLS policies for per-user folders in "books" bucket (without IF NOT EXISTS for Postgres compatibility)
drop policy if exists "Users can view their own book files" on storage.objects;
drop policy if exists "Users can upload files to their own folder" on storage.objects;
drop policy if exists "Users can update their own book files" on storage.objects;
drop policy if exists "Users can delete their own book files" on storage.objects;

-- Users can view (and generate signed URLs for) their own files
create policy "Users can view their own book files"
  on storage.objects
  for select
  using (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can upload files to their own folder: {user_id}/...
create policy "Users can upload files to their own folder"
  on storage.objects
  for insert
  with check (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own files
create policy "Users can update their own book files"
  on storage.objects
  for update
  using (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
create policy "Users can delete their own book files"
  on storage.objects
  for delete
  using (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );