# NEXUS — Environment Matrix

**Fecha:** 2026-09-15. Complementa `docs/NEXUS_DEPLOYMENT_ARCHITECTURE.md` — este documento es la referencia rápida de "qué corre dónde", esa es la explicación de por qué.

## Componentes por entorno

| Component | Local | Vercel | AWS |
|-----------|-------|--------|-----|
| Frontend | Native (`npm run dev`, :3000) | YES — target real hoy (`nexusnews.info`, sin confirmar auto-deploy desde esta máquina) | Optional — soportado conceptualmente (`deployment.yml frontend.provider: aws`), sin Dockerfile ni implementación |
| Backend | Native (venv + uvicorn `--reload`, :8000) | YES — proyecto Vercel separado, Root Directory `backend`, FastAPI serverless | AWS no implementado |
| Automation (scraper y workers) | Scripts bajo demanda | GitHub Actions (cron/dispatch; no es una función de Vercel) | AWS no implementado |
| Automation (Local Runtime) | Native (venv + uvicorn, :8801) | NO — requiere host/túnel accesible; no está desplegado | AWS no implementado |
| LAB | Native, CLI bajo demanda | NO — operaciones locales no disponibles en serverless | No implementado |
| Nginx | Docker (único contenedor local, :80) | NO — Vercel es su propio edge, no necesita este proxy | Optional, sin diseñar todavía (ver Deployment Architecture §5) |
| Database | Supabase (remoto, siempre) | Supabase (mismo proyecto) | Supabase (mismo proyecto — no hay plan de migrar a RDS) |

## Variables de entorno por servicio

Nombres reales, nunca valores — ver el `.env.example` de cada servicio para la lista completa y comentada.

| Variable | Servicio | Local (default) | Producción |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | frontend | `http://localhost:8000` solo para desarrollo local | **dejar sin definir**: el navegador usa el proxy same-origin `/api/*`; `BACKEND_PUBLIC_URL` apunta al backend desde el servidor Next.js |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | frontend | valores actuales de Supabase como fallback | mismo proyecto Supabase, o uno distinto por ambiente si se decide separar staging/producción |
| `TIKTOK_CLIENT_KEY` / `_SECRET` / `_REDIRECT_URI` / `_DEMO_MODE` | frontend (server-side) | requeridas para probar OAuth real | credenciales reales de producción de TikTok Developer |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | backend | fallback embebido en `client.py` | mismas, o proyecto distinto |
| `SUPABASE_SECRET_KEY` | backend, GitHub Actions | requerida para escrituras privilegiadas | requerida en Vercel backend y workers; nunca exponer como `NEXT_PUBLIC_*` |
| `RUNTIME_BASE_URL` | backend | `http://localhost:8801` | No configurar `localhost` en Vercel; definir solo si se despliega un runtime accesible externamente |
| `LAB_WORKSPACE_PATH` | backend | auto-detectado (`automation/lab/workspace/exports`) | necesario si Automation corre en un host distinto al backend |
| `CORS_ALLOWED_ORIGINS` | backend | vacío (usa defaults locales) | Opcional mientras el navegador use el proxy del frontend; definir solo para clientes que llamen al backend directamente |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | automation (scraper legado) | ya trackeado en git — pendiente rotación | sin cambios (sigue en cron de GitHub Actions, fuera de este matrix de deployment) |
| `OPENROUTER_API_KEY` | automation (scraper legado) | ídem | ídem |

## `nexus.local` vs URL real

| Entorno | URL del frontend | Configurado por |
|---|---|---|
| Local | `http://nexus.local` (o `http://localhost`, nginx responde a ambos) | hosts file (`127.0.0.1 nexus.local`, ya presente en esta máquina) |
| Producción | `https://www.nexusnews.info` (verificado REACHABLE por `nexus status`) | DNS real + Vercel |

**Nunca hardcodear `nexus.local`/`localhost`/`127.0.0.1` como si fueran una URL de producción** — regla ya cumplida en el código auditado en esta tarea (§3 de Deployment Architecture) salvo por los defaults explícitos, documentados como tales, en `api-client.ts` y `main.py`.

## Qué significa cada estado en `nexus status`

| Estado | Significa | Cómo se verifica |
|---|---|---|
| `ONLINE` (local) | El proceso corre y respondió su health check real ahora mismo | HTTP real o puerto real ligado |
| `READY` (LAB) | El CLI de LAB corrió y devolvió datos reales | `lab.cli status` ejecutado de verdad |
| `REACHABLE` (deployment) | Una URL de producción respondió HTTP ahora mismo | `Invoke-WebRequest` real contra la URL |
| `DEPLOYED` | **No implementado** — requeriría credenciales reales de la API de Vercel/AWS que este script no tiene | — |

`REACHABLE` y `DEPLOYED` nunca se muestran como si fueran lo mismo — un sitio puede estar `REACHABLE` (alguien lo está sirviendo) sin que este script pueda confirmar `DEPLOYED` (que el último commit es el que está corriendo). No inventar esa segunda comprobación sin las credenciales reales.
