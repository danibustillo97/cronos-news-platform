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
- Vercel detecta FastAPI automáticamente y sirve la instancia ASGI exportada desde un entrypoint
  reconocido. No se necesita una reescritura global hacia `/api/index`: esa reescritura altera
  el path que recibe FastAPI y hace que rutas como `/health` respondan 404.
- Consulta la [documentación oficial de FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi).

## Configuración del proyecto

- Nombre: `cronos-backend`.
- Git repository: `danibustillo97/cronos-news-platform`.
- Root Directory: `backend`.
- Framework Preset: `FastAPI`.
- Production Branch: `master`; las ramas feature generan Preview Deployments.
- No configures Build Command, Output Directory ni Install Command personalizados.

Archivos relevantes:

- `backend/api/index.py`: entrypoint que exporta la instancia ASGI `app`.
- `backend/vercel.json`: ajusta la duración máxima de la función y excluye archivos que no deben empaquetarse. No define rewrites.
- `backend/requirements.txt`: dependencias de runtime; no instala pytest ni dependencias de desarrollo.
- `backend/.python-version`: fija Python 3.13.
- `backend/.vercelignore`: excluye entornos virtuales, tests y archivos `.env`.

## Variables de entorno del backend

Configúralas en **Settings → Environment Variables** del proyecto backend. Guarda las credenciales
como variables sensibles; nunca las copies al proyecto frontend.

| Variable | Alcance / uso |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase; requerida |
| `SUPABASE_PUBLISHABLE_KEY` | Validar sesiones de usuario; requerida para rutas autenticadas |
| `SUPABASE_SECRET_KEY` | Operaciones privilegiadas de escritura del backend; requerida para las funciones que escriben |
| `GITHUB_REPOSITORY` | `danibustillo97/cronos-news-platform` |
| `GITHUB_DISPATCH_REF` | `master` en Production; `feature/social-media-studio-v2` en Preview |
| `GITHUB_DISPATCH_TOKEN` | PAT fine-grained, limitado a este repo, permiso Actions: Read and write; requerido para despachar workers de inmediato |
| `DISCOVERY_RUNNER` | `github` para que Discovery use GitHub Actions |
| `ARTIFACT_PROVIDER` | `auto` (valor predeterminado); puede fijarse a `anthropic` si se configura la clave |
| `ANTHROPIC_API_KEY` | Opcional; habilita generación con Anthropic |
| `ANTHROPIC_MODEL` | Opcional; modelo Anthropic |
| `ADMIN_EMAILS` / `ADMIN_USER_IDS` | Opcional cuando el usuario ya tiene rol admin/editor en Supabase `app_metadata`; si se usan, deben contener los administradores autorizados |
| `CORS_ALLOWED_ORIGINS` | Solo si clientes de navegador llaman directamente al backend desde otros orígenes |
| `RUNTIME_BASE_URL` | Solo si el backend debe llamar al Local Runtime desplegado fuera de Vercel |

La integración con GitHub Actions requiere `GITHUB_DISPATCH_TOKEN` para iniciar workers mediante
`workflow_dispatch`. Si no se configura, el backend puede servir endpoints, pero los trabajos
que dependen del despacho inmediato no podrán iniciarse desde esa vía.

En Vercel, el entorno serverless se detecta mediante la variable de plataforma `VERCEL`; no es
necesario inventar o añadir `JOB_EXECUTION`, `ASSET_STORAGE`, `ASSET_STORAGE_BUCKET` ni
`CRONOS_SERVERLESS` como requisitos generales del despliegue.

## Conectar el frontend al backend

En el proyecto Vercel del frontend configura:

- `BACKEND_PUBLIC_URL` = dominio HTTPS del backend, sin slash final.
- En Preview, asigna el dominio de Preview de la rama correspondiente.
- Deja `NEXT_PUBLIC_API_BASE_URL` sin definir para que el navegador use el proxy same-origin `/api/*`.

El frontend ya implementa ese proxy en `frontend/src/app/api/[...path]/route.ts`.
El proxy reenvía el token de sesión de Supabase como Bearer token. La protección administrativa
se aplica en FastAPI mediante `require_admin()`; por eso el proyecto API no debe tener Vercel
Authentication/SSO que bloquee las llamadas servidor-a-servidor del proxy.

## Verificación posterior al despliegue

Revisa estos endpoints directamente en el dominio del backend:

- `/health` → debe responder `{"status":"ok"}`.
- `/docs` → debe mostrar Swagger UI.
- `/diagnostics/env` → debe mostrar estado configured/missing, nunca valores de secretos.

Después prueba el proxy desde el dominio del frontend y valida una ruta pública, más una ruta
administrativa con un usuario autorizado.

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
