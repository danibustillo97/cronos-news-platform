-- ⚠️ IMPORTANT: Run this script in your Supabase SQL Editor to fix the upload error.
-- Go to: https://supabase.com/dashboard/project/_/sql

-- 1. Create the 'media' bucket (Public) if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RESET POLICIES (Delete old ones to avoid conflicts)
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;

-- 3. Enable Public Read Access (Everyone can view images)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'media' );

-- 4. Enable Public Upload Access (Allow Anon users to upload)
CREATE POLICY "Public Upload Access"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'media' );

-- 5. Enable Update/Delete (Optional, for managing files)
CREATE POLICY "Public Update Access"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'media' );

CREATE POLICY "Public Delete Access"
ON storage.objects FOR DELETE
USING ( bucket_id = 'media' );
