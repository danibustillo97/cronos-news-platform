---
title: Supabase
tags:
  - backend
  - supabase
---

# 🗄️ Supabase

Proyecto Supabase: `mxvdnfaeqjifnxqmxbri` (`https://mxvdnfaeqjifnxqmxbri.supabase.co`).

Cliente en `src/lib/supabaseClient.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = '...'   // hardcodeado, no usa .env
const supabaseKey = '...'   // anon key, hardcodeada
export const supabase = createClient(supabaseUrl, supabaseKey)
```

## Setup / esquema

- `supabase_setup.sql` — crea el bucket público `media` y sus políticas RLS de storage.
- `supabase_schema_update.sql` — actualizaciones de esquema (tablas de noticias/artículos).
- `supabase_setup/`:
  - `schema.sql` — esquema base
  - `add_subtitle.sql` — agrega columna de subtítulo
  - `fix_missing_columns.sql`, `fix_schema_sync_error.sql` — parches puntuales de sincronización de esquema

## ⚠️ Seguridad

> [!warning] Credenciales hardcodeadas
> El cliente Supabase usa una **anon key hardcodeada en el código fuente** (`src/lib/supabaseClient.ts`), en vez de `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`. La anon key de Supabase está diseñada para ser pública (se protege con RLS), así que no es una fuga crítica por sí sola, pero:
> - No hay ningún `.env.example` en el repo — nadie más puede levantar el proyecto sin adivinar las credenciales.
> - Complica rotar la key o usar un proyecto de Supabase distinto en dev/staging/prod.

> [!danger] Políticas de storage muy permisivas
> `supabase_setup.sql` otorga **INSERT, UPDATE y DELETE públicos** (rol `public`, sin auth) sobre el bucket `media`. Cualquiera con la URL del proyecto podría subir, sobrescribir o borrar archivos del bucket. Vale la pena revisar si esto es intencional (demo/hobby project) o si el panel admin debería restringir estas operaciones a usuarios autenticados.

## Recomendación (para cuando se retome el trabajo)

1. Migrar a variables de entorno (`.env.local` + `NEXT_PUBLIC_*`), agregar `.env.example` al repo.
2. Revisar si las políticas de `storage.objects` para `media` deberían requerir `auth.role() = 'authenticated'` en vez de `public`.

Ver también [[Master (producción)]].
