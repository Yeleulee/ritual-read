-- Remove duplicate storage INSERT policy; "Users can upload files to their own folder" remains.
drop policy if exists "Users can upload their own book files" on storage.objects;
