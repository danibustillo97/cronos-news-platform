-- Real, admin-managed sponsor banners (house ads) -- one row per creative,
-- keyed to the same AdPosition slots the frontend's <AdSlot> already
-- reserves space for (frontend/src/components/ads/AdSlot.tsx). Each
-- position has a fixed pixel size (enforced client-side on upload in the
-- admin panel) so a banner always fills its slot exactly, never stretched
-- or cropped. Run this in the Supabase SQL editor, like every other
-- schema file in this project -- not applied automatically.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.ad_banners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Matches AdPosition in frontend/src/components/ads/AdSlot.tsx exactly
    -- -- only the 5 positions a real page actually renders.
    position TEXT NOT NULL CHECK (position IN (
        'HOME_TOP', 'HOME_FEED', 'ARTICLE_TOP', 'ARTICLE_END', 'SIDEBAR_DESKTOP'
    )),

    image_url TEXT NOT NULL,
    link_url TEXT NOT NULL,
    alt_text TEXT,

    -- The real pixel size of the uploaded creative -- informational once
    -- stored (the admin upload form already rejected a mismatched image
    -- before this row ever gets created), but kept so the public read
    -- side can size the <img> without waiting on it to load.
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_banners_position ON public.ad_banners(position) WHERE active = TRUE;

ALTER TABLE public.ad_banners ENABLE ROW LEVEL SECURITY;

-- Reads are public (the public site fetches its own banners through the
-- backend, which itself just needs a policy that allows the anon key to
-- read active rows -- same shape as every other public content table).
CREATE POLICY "Public can view active ad banners"
ON public.ad_banners FOR SELECT
USING (active = TRUE);

-- No public/authenticated write policy: creates, edits and deletes all go
-- through the FastAPI backend's service-role Supabase client (see
-- app/infrastructure/persistence/supabase/ad_banner_repository.py), which
-- bypasses RLS entirely -- same rule api-client.ts documents for every
-- other business write in this project ("Next.js/the browser is not the
-- backend"). The admin UI never talks to Supabase directly for this.
