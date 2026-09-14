-- ⚠️ EJECUTA ESTO EN EL SQL EDITOR DE SUPABASE PARA CORREGIR EL ERROR ⚠️

-- Agrega las columnas faltantes una por una para evitar errores de sintaxis
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS slug TEXT;

-- Asegura que los índices existan para la velocidad
CREATE INDEX IF NOT EXISTS idx_news_subcategory ON public.news(subcategory);
CREATE INDEX IF NOT EXISTS idx_news_slug ON public.news(slug);

-- Comentario: Esto no borra nada, solo agrega lo que falta.
