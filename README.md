# CRONOS

Content Operating System para producción editorial, multimedia y audiovisual.
Automatización primero, IA solo donde agrega valor — ver [`obsidian-vault/Roadmap.md`](obsidian-vault/Roadmap.md) para el estado y las prioridades vigentes.

## Estructura del workspace

```
frontend/         Next.js + TypeScript — portal público y panel /admin (News, Producción, Studio, Distribución)
backend/          Servicio Python (FastAPI) con arquitectura DDD — bounded contexts: news, story, composition, distribution, intelligence, asset
infrastructure/   Base de datos (schemas SQL de Supabase), y en el futuro: docker, scripts, utilidades
obsidian-vault/   Documentación viva del proyecto (roadmap, arquitectura, decisiones)
```

`rpa/` (automatizaciones de scraping) se incorpora como módulo hermano cuando se ejecute la migración descrita en [`infrastructure/scripts/migrate-workspace.ps1`](infrastructure/scripts/migrate-workspace.ps1).

## Arquitectura conceptual

```
SCRAPER → RAW CONTENT → PRODUCTION → EDITORIAL INTELLIGENCE → POST STRUCTURING
  → MEDIA RESOLUTION → PREVIEW → READY → NEWS → STUDIO → PUBLISH → ANALYTICS
```

- **Production** es el centro de procesamiento editorial — News nunca limpia ni reescribe contenido, solo lista lo que ya está listo (`READY`).
- Los bounded contexts del backend (`News`, `Story`, `Composition`, `Distribution`) implementan esta cadena con máquinas de estado propias; ver `backend/app/domain/*/entities.py`.

## Desarrollo local

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && python -m venv venv && ./venv/Scripts/pip install -r requirements.txt && ./venv/Scripts/python -m uvicorn app.presentation.main:app --reload
```

## Documentación

Ver [`obsidian-vault/`](obsidian-vault/) para el roadmap, la arquitectura, y las notas de decisiones (stack técnico, Supabase, ramas activas).
