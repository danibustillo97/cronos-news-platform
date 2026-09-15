-- SECURITY REMEDIATION -- run in Supabase SQL Editor.
--
-- supabase_setup.sql granted INSERT/UPDATE/DELETE on the `media` storage
-- bucket to the public role with no restriction beyond bucket_id -- any
-- anonymous request with the project URL can upload, overwrite, or delete
-- any file in the bucket. This tightens writes to authenticated sessions,
-- matching the same auth.role() = 'authenticated' pattern already used
-- for every table in cronos_platform_schema.sql. Reads stay public
-- (the bucket serves public site assets).
--
-- Safe to re-run (drops + recreates the same policy names).

DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;

CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'media' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'media' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
USING ( bucket_id = 'media' AND auth.role() = 'authenticated' );

-- "Public Read Access" (SELECT) is intentionally left untouched -- the
-- bucket serves public site assets, read access is meant to be public.
