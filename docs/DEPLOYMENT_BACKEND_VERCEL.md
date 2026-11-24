# Backend FastAPI en Vercel

El backend (`backend/`) se despliega como un **proyecto Vercel independiente** del frontend,
desde el mismo repositorio. Vercel ejecuta FastAPI como una Python Function; no se mantiene
un servidor Uvicorn permanente.

## Topología

```
Navegador ──► Vercel: frontend (Next.js)
                 └─ /api/* (proxy, frontend/src/app/api/[...path]/route.ts)
                        └──► Vercel: backend (FastAPI / Python Function) ──► Supabase
                                   │
                                   └─ workflow_dispatch ──► GitHub Actions (workers)
                                                                └──► Supabase
```

- El navegador llama al mismo origen del frontend. Next.js reenvía las peticiones al backend mediante
  `BACKEND_PUBLIC_URL`; no se necesita CORS para ese flujo.
- Los trabajos largos (scraping, IA, generación multimedia y publicaciones programadas) se procesan
  mediante GitHub Actions y Supabase, no como tareas en segundo plano dentro de la función web.
- Vercel soporta FastAPI en Python 3.13 y lo ejecuta como una función serverless. Consulta la
  [documentación oficial de FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi).

## Estado del código

La rama ya contiene los archivos necesarios para desplegar el backend:

- `backend/api/index.py`: entrypoint que exporta la instancia ASGI `app`.
- `backend/vercel.json`: configura la función y reescribe las rutas hacia el entrypoint.
- `backend/requirements.txt`: dependencias de runtime; no instala pytest ni dependencias de desarrollo.
- `backend/.python-version`: fija Python 3.13.
- `backend/.vercelignore`: excluye entornos virtuales, tests y archivos `.env`.

## Crear el proyecto backend en Vercel

1. Abre [Vercel New Project](https://vercel.com/new) y selecciona el repositorio
   `danibustillo97/cronos-news-platform`.
2. Asigna un nombre como `cronos-backend`.
3. En **Root Directory**, selecciona `backend`. Mantén ese directorio como raíz del proyecto backend.
4. Framework Preset: **FastAPI** si Vercel lo detecta; de lo contrario deja la detección automática.
5. No configures un Build Command, Output Directory ni Install Command personalizado.
   Vercel debe instalar `backend/requirements.txt` y detectar `api/index.py`.
6. En **Production Branch**, usa `master`. Los pushes a
   `feature/social-media-studio-v2` deben generar Preview Deployments.
7. Añade las variables de entorno siguientes antes del primer deploy y despliega.

## Variables de entorno del proyecto backend

Configúralas en **Settings → Environment Variables** del proyecto backend. Las variables marcadas
como secretas deben guardarse como Environment Variables sensibles.

| Variable | Valor / uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SECRET_KEY` | Secret key de Supabase para escrituras privilegiadas |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key para validar sesiones |
| `JOB_EXECUTION` | `github` |
| `ASSET_STORAGE` | `supabase` |
| `ASSET_STORAGE_BUCKET` | `media` (el bucket debe existir) |
| `GITHUB_DISPATCH_TOKEN` | PAT fine-grained, solo este repo, permiso Actions: Read and write |
| `GITHUB_REPOSITORY` | `danibustillo97/cronos-news-platform` |
| `GITHUB_DISPATCH_REF` | `master` en Production; `feature/social-media-studio-v2` en Preview |
| `DISCOVERY_RUNNER` | `github` |
| `ANTHROPIC_API_KEY` | Si se generan artículos con Anthropic |
| `ARTIFACT_PROVIDER` | `anthropic` |
| `ADMIN_EMAILS` / `ADMIN_USER_IDS` | Los mismos valores autorizados por el frontend |
| `CORS_ALLOWED_ORIGINS` | Solo si clientes de navegador llaman directamente al backend |

No agregues `NEXT_PUBLIC_*` con secretos. Nunca pongas `SUPABASE_SECRET_KEY` ni
`GITHUB_DISPATCH_TOKEN` en el proyecto frontend.

## Conectar el frontend al backend

En el proyecto Vercel del frontend, configura:

- `BACKEND_PUBLIC_URL` = dominio HTTPS del proyecto backend, sin slash final.
- Deja `NEXT_PUBLIC_API_BASE_URL` sin definir en Preview y Production para que el navegador use
  el proxy same-origin `/api/*`.

El frontend ya implementa ese proxy en `frontend/src/app/api/[...path]/route.ts`.

## Verificación posterior al despliegue

Revisa estos endpoints directamente en el dominio del backend:

- `/health` → debe responder `{"status":"ok"}`.
- `/docs` → debe mostrar Swagger UI.
- `/diagnostics/env` → debe mostrar estado configured/missing, nunca los valores de secretos.

Después configura `BACKEND_PUBLIC_URL` en el frontend y prueba el flujo desde el dominio del portal.
No consideres el despliegue completo hasta validar también una ruta pública y una ruta protegida.

## Consideraciones de serverless

| Área | Local | Vercel |
|---|---|---|
| Endpoints API | FastAPI en Uvicorn | Python Function |
| Jobs de Artifact y Media | BackgroundTasks | Encola en Supabase y despacha GitHub Actions |
| Discovery | Local Runtime | GitHub Actions |
| Configuración de credenciales | Archivo `backend/.env` | Variables de entorno Vercel |
| Archivos locales del LAB | Workspace local | No persistentes ni disponibles en serverless |

Los archivos del filesystem de una función no son almacenamiento persistente. Los assets de producción
deben ir a Supabase Storage. Local Runtime y LAB siguen requiriendo un host separado si se necesitan
desde la nube.

