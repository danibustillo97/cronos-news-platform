-- Agrega la columna updated_at si no existe
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Asegura que otras columnas críticas existan también
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS seo_description TEXT;
