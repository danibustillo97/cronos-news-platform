# NEXUS

Content Operating System para producción editorial, multimedia y audiovisual.
Automatización primero, IA solo donde agrega valor — ver [`obsidian-vault/Roadmap.md`](obsidian-vault/Roadmap.md) para el estado y las prioridades vigentes.

## Arquitectura

```
NEXUS
│
├── Automation (automation/) — su propio repo git + .claude, ver más abajo
│   ├── src/        Scraper legado (main.py/script.py) — sin venv propio hoy
│   ├── lab/        LAB — planners determinísticos (editorial→...→export), CLI, sin daemon
│   └── runtime/    Local Runtime — puente HTTP real entre backend y LAB (puerto 8801)
│
├── backend/        FastAPI, DDD — news/story/composition/distribution/intelligence/asset/timeline
├── frontend/       Next.js — portal público + panel /admin (News, Producción, Studio, Distribución, SEO)
├── infrastructure/ Schemas SQL de Supabase, docker (nginx), scripts
└── obsidian-vault/ Documentación viva (roadmap, arquitectura, decisiones)
```

`automation/` es un **repo git y `.claude` separados a propósito** (antes `Desktop/RPA_NEWS_SCRIPT`, consolidado acá el 2026-09-15). NEXUS y Automation no se fusionan:

- **NEXUS `.claude`** gobierna arquitectura global, backend, frontend, dominio, integración.
- **`automation/.claude`** gobierna scraping, ingestion, LAB, automatizaciones.

## Cadena conceptual

```
AUTOMATION → RAW CONTENT → CONTENT/INGESTION → PRODUCTION → READY
  → STUDIO → COMPOSITION → DISTRIBUTION → PUBLISH → ANALYTICS
```

- **Production** es el centro de procesamiento editorial — News nunca limpia ni reescribe contenido, solo lista lo que ya está `READY`.
- Los bounded contexts del backend (`News`, `Story`, `Composition`, `Distribution`, `Timeline`) implementan esta cadena con máquinas de estado propias; ver `backend/app/domain/*/entities.py`.

## Arrancar todo con un comando

```powershell
cd C:\Users\User\Desktop\NEXUS
.\nexus.ps1 up        # arranca backend, frontend, Local Runtime, nginx; verifica LAB
.\nexus.ps1 status    # estado real de cada servicio (sin arrancar nada)
.\nexus.ps1 down      # apaga todo
.\nexus.ps1 restart
.\nexus.ps1 logs [backend|frontend|runtime]
.\nexus.ps1 doctor    # diagnóstico: puertos, Docker, .env, deps, DB, nginx, hosts
.\nexus.ps1 ps        # procesos gestionados con pid real
```

Todo chequeo de `nexus.ps1` es real (endpoint HTTP o puerto ligado) — nunca un archivo de PID ni "la carpeta existe". `LAB` se reporta `READY`, no `ONLINE`: no tiene daemon, así que su estado es que el CLI corre de verdad (`lab.cli status`), no que haya un proceso vivo. El scraper legado (`automation/main.py`/`script.py`) no tiene health check a propósito — tiene efectos reales (scrapea sitios en vivo, escribe en Supabase de producción), fingir un chequeo sería peor que no tenerlo.

## URLs

| | URL |
|---|---|
| Plataforma | http://localhost (o http://nexus.local si configuraste el hosts file — ver `nexus doctor`) |
| API | http://localhost/api |
| Studio | http://localhost/studio (hoy es una tab dentro de `/admin`, no una ruta propia) |
| Health | http://localhost/health |

## Puertos

| Servicio | Puerto | Cómo corre |
|---|---|---|
| Frontend (Next.js) | 3000 | nativo (`npm run dev`) |
| Backend (FastAPI) | 8000 | nativo (venv + uvicorn --reload) |
| Local Runtime | 8801 | nativo (venv + uvicorn) |
| Nginx | 80 | Docker — único servicio containerizado, reverse proxy hacia los de arriba vía `host.docker.internal` |
| Database | — | Supabase remoto, no hay Postgres local |

## Desarrollo local (sin `nexus.ps1`)

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && python -m venv venv && ./venv/Scripts/pip install -r requirements.txt && ./venv/Scripts/python -m uvicorn app.presentation.main:app --reload

# Local Runtime
cd automation/runtime && python -m venv venv && ./venv/Scripts/pip install -r requirements.txt && ./venv/Scripts/python -m uvicorn app.main:app --port 8801
```

## Variables de entorno

Nunca centralizadas en un solo archivo — cada servicio tiene el suyo, nunca commiteado (excepto `automation/.env`, que quedó trackeado desde antes de esta consolidación, ver `automation/.gitignore`):

- `backend/.env` — `SUPABASE_SERVICE_ROLE_KEY`
- `automation/.env` — `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`
- `automation/runtime/.env` — `SUPABASE_SERVICE_ROLE_KEY`

`nexus doctor` verifica que existan y qué claves tienen, nunca sus valores.

## Documentación

Ver [`obsidian-vault/`](obsidian-vault/) para el roadmap, la arquitectura, y las notas de decisiones (stack técnico, Supabase, ramas activas, la consolidación a NEXUS).
