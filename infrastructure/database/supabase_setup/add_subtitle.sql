-- Add subtitle column to news table
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS subtitle TEXT;

-- Index for subtitle might not be necessary unless searching by it, but safe to have if we want consistency
-- CREATE INDEX IF NOT EXISTS idx_news_subtitle ON public.news(subtitle);

-- Ensure RLS policies allow reading subtitle (usually * covers it, but good to know)
