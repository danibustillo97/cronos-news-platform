-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. NEWS TABLE (The core table)
CREATE TABLE IF NOT EXISTS public.news (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Content
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT, -- Rich text content
    excerpt TEXT, -- Short summary for SEO/Cards
    image_url TEXT, -- Main cover image
    images TEXT[], -- Array of additional image URLs
    
    -- Categorization
    category TEXT NOT NULL,
    subcategory TEXT,
    tags TEXT[], -- Array of tags e.g. ['messi', 'inter-miami']
    
    -- SEO (Critical for success)
    seo_title TEXT,
    seo_description TEXT,
    
    -- Status & Dates
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Author (Denormalized for now for speed, or link to auth.users)
    author_id UUID,
    author_name TEXT,
    author_avatar TEXT,
    
    -- Engagement Metrics (Default to 0)
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    
    -- Flags
    featured BOOLEAN DEFAULT FALSE,
    trending BOOLEAN DEFAULT FALSE,
    breaking BOOLEAN DEFAULT FALSE
);

-- 2. INDEXES (For "Super Agile" performance)
CREATE INDEX IF NOT EXISTS idx_news_slug ON public.news(slug);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news(category);
CREATE INDEX IF NOT EXISTS idx_news_status ON public.news(status);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON public.news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_featured ON public.news(featured) WHERE featured = TRUE;

-- 3. RLS POLICIES (Security)
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published news
CREATE POLICY "Public can view published news" 
ON public.news FOR SELECT 
USING (status = 'published');

-- Allow admins (or everyone for dev) to manage news
-- WARNING: In production, change 'true' to an auth check like: auth.role() = 'authenticated'
CREATE POLICY "Enable all access for now" 
ON public.news FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. CATEGORIES TABLE (Optional, for dynamic management later)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES public.categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
