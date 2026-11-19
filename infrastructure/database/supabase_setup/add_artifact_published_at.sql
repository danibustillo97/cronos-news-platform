-- Add published_at column to artifacts table.
--
-- Distinct from created_at (when the Artifact was generated/drafted).
-- Set once, in Artifact.publish() (backend/app/domain/artifact/entities.py),
-- when an APPROVED artifact actually becomes PUBLISHED. Needed so NEXUS
-- Studio's content selector can show a real publication date instead of
-- reusing the artifact's creation timestamp.
ALTER TABLE public.artifacts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
