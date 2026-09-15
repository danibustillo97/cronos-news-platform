from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.persistence.supabase import client as supabase_client_module
from app.presentation.error_handlers import register_error_handlers
from app.presentation.api import news, stories, compositions, discovery, categories, assets, runtime, settings, artifacts
from app.presentation.api.stories import productions_router

app = FastAPI(title="CRONOS Backend", version="0.1.0")

# Local dev origins are always allowed; CORS_ALLOWED_ORIGINS (comma-separated)
# adds real ones on top -- e.g. the Vercel frontend URL in production. Never
# hardcode a production domain here; it differs per environment (staging vs
# production, custom domain vs *.vercel.app preview) -- see
# docs/NEXUS_ENVIRONMENT_MATRIX.md.
_DEFAULT_ORIGINS = ["http://localhost:3000", "http://nexus.local", "http://localhost"]
_extra_origins = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_ORIGINS + _extra_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(news.router)
app.include_router(stories.router)
app.include_router(compositions.router)
app.include_router(discovery.router)
app.include_router(categories.router)
app.include_router(assets.router)
app.include_router(runtime.router)
app.include_router(settings.router)
app.include_router(artifacts.router)
app.include_router(productions_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/diagnostics/env")
def diagnostics_env() -> dict:
    """Reporta SOLO si cada variable está configurada o no en ESTE proceso
    (el mismo que atiende /api/*, no otra terminal) -- nunca el valor.
    also which key `get_supabase_client()` ends up using, sin revelarla,
    para poder distinguir "estoy usando anon" de "estoy usando service_role"."""
    using_service_role = bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    return {
        "env_file_loaded_from": str(supabase_client_module._ENV_FILE),
        "env_file_exists": supabase_client_module._ENV_FILE.exists(),
        "SUPABASE_URL": "configured" if os.getenv("SUPABASE_URL") else "using_default",
        "SUPABASE_KEY": "configured" if os.getenv("SUPABASE_KEY") else "missing",
        "SUPABASE_SERVICE_ROLE_KEY": "configured" if using_service_role else "missing",
        "client_will_use": "service_role" if using_service_role else "anon (falls back)",
    }
