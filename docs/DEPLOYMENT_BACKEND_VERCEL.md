# Backend FastAPI en Vercel

El backend (`backend/`) se despliega como un **segundo proyecto de Vercel**, separado del frontend, desde el mismo repositorio. Corre como función serverless; no hay un servidor FastAPI permanente.

## Topología

```
Navegador ──► Vercel: frontend (Next.js)
                 └─ /api/* (proxy, src/app/api/[...path]/route.ts)
                        └──► Vercel: backend (FastAPI serverless) ──► Supabase
                                   │
                                   └─ workflow_dispatch ──► GitHub Actions (workers)
                                                                └──► Supabase
```

- El navegador **nunca** llama al backend directamente: todo pasa por el proxy del frontend (server-to-server), así que no hace falta CORS para el panel.
- El trabajo largo (IA 10–60 s, generación de imágenes, scraping, publicaciones programadas) lo ejecutan los workers de GitHub Actions contra las tablas de jobs de Supabase.

## Qué cambia en serverless (`VERCEL=1`)

| Área | Local (uvicorn) | Vercel |
|---|---|---|
| `POST /api/artifacts/jobs` | Corre el job en `BackgroundTasks` | Deja el job `QUEUED` y dispara `artifact-processing.yml` |
| `POST /api/artifacts/{id}/media/{ph}/generate` | Corre en `BackgroundTasks` | Deja el job `QUEUED` y dispara `media-processing.yml` |
| `POST /api/discovery/jobs` (botón Buscar) | Local Runtime (:8801) | Deja el job `QUEUED` y dispara `discovery-processing.yml` |
| Guardar API keys / proveedor por defecto desde Settings | Escribe `backend/.env` | **501** `NOT_AVAILABLE_ON_SERVERLESS`: configurar en Vercel |
| Subir imagen a un placeholder | Escribe en el workspace LAB local | **501**: pendiente migrar a Supabase Storage |
| Proveedor "Claude Code" (`claude -p`) | Disponible si está instalado | Reporta UNAVAILABLE; usar el proveedor Anthropic |
| Local Runtime (`RUNTIME_BASE_URL`, puerto 8801) | `localhost:8801` | No alcanzable salvo con un túnel público |

Si `GITHUB_DISPATCH_TOKEN` no está configurado o GitHub falla, no se pierde nada: el cron del worker (cada 10/15 min) procesa el job igual.

Para reproducir el comportamiento de Vercel en local: `CRONOS_SERVERLESS=1 uvicorn app.presentation.main:app`.

## Archivos

- `backend/api/index.py`: entrypoint efectivo configurado en `backend/vercel.json` (añade `backend/` a `sys.path` y exporta `app`). `backend/index.py` queda como alias/entrypoint alternativo; la configuración de Vercel enruta explícitamente a `api/index.py`.
- `backend/.python-version`: Python 3.13 (igual que los workflows).
- `backend/.vercelignore`: excluye `venv/`, `tests/`, `.env`.
- `backend/app/infrastructure/serverless/`: detección del entorno y `workflow_dispatch`.

## Paso a paso

### 1. Crear el proyecto del backend
Vercel → **Add New → Project** → importar `cronos-news-platform` →
- **Root Directory:** `backend`
- **Framework Preset:** FastAPI (o "Other"; Vercel detecta `index.py`)
- Nombre sugerido: `cronos-backend`

### 2. Variables de entorno del proyecto backend

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | secret key, antes service_role (Supabase → Project Settings → API Keys) |
| `SUPABASE_PUBLISHABLE_KEY` | publishable key (antes anon) |
| `JOB_EXECUTION` | `github` (envía trabajos largos a GitHub Actions) |
| `ASSET_STORAGE` | `supabase` (evita disco local efímero en Vercel) |
| `ASSET_STORAGE_BUCKET` | `media` (bucket existente en Supabase Storage) |
| `ANTHROPIC_API_KEY` | si se generan artículos desde el panel |
| `ARTIFACT_PROVIDER` | `anthropic` |
| `ADMIN_EMAILS` / `ADMIN_USER_IDS` | mismos valores que el frontend |
| `CORS_ALLOWED_ORIGINS` | opcional; solo si algo llama al backend directamente desde el navegador |
| `GITHUB_DISPATCH_TOKEN` | PAT fine-grained, solo este repo, *Actions: Read and write* |
| `GITHUB_REPOSITORY` | `danibustillo97/cronos-news-platform` |
| `GITHUB_DISPATCH_REF` | `master` en Production; `feature/social-media-studio-v2` en Preview |
| `DISCOVERY_RUNNER` | `github` (por defecto en Vercel) |

Verificar después del deploy: `https://<backend>/health` → `{"status":"ok"}` y `https://<backend>/diagnostics/env` (muestra solo configured/missing, nunca valores).

### 3. Variables del proyecto frontend
- `BACKEND_PUBLIC_URL` = URL del backend (sin `/` final). Esta variable pertenece al frontend; no se configura en el backend.
- **No** definir `NEXT_PUBLIC_API_BASE_URL`: así el navegador usa el proxy `/api/*` y no hay CORS ni exposición de la URL.
- Resto: ver `docs/DEPLOYMENT_VERCEL.md`.

### 4. Secrets de GitHub Actions
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` y, opcionalmente, `SCRAPER_SOURCES`. `BACKEND_PUBLIC_URL` se configura en Vercel para el frontend, no como variable del backend. Ver `docs/GITHUB_ACTIONS.md`.

## Límites del plan Hobby (gratis)

- **Uso no comercial.** Mostrar publicidad real (módulo `ads`) o monetizar requiere plan Pro, para frontend y backend.
- **Cuerpo de petición máx. 4.5 MB**: el límite de 10 MB del upload no aplica en Vercel.
- **Duración de función**: hasta 300 s con Fluid Compute; los endpoints síncronos de IA (SEO fix, resolución de claims) entran, pero los jobs largos van por GitHub Actions.
- **Cold starts**: la primera petición tras inactividad tarda algo más (importa todo el contenedor).

## Pendiente (fase 2)

1. Subida de imágenes y `/assets` → Supabase Storage (hoy dependen del disco local del LAB).
2. Credenciales de proveedores desde el panel → secret store (hoy solo variables de Vercel).
3. Local Runtime / LAB accesible desde la nube (túnel) o mover esa lógica a workers.
