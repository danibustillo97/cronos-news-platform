from __future__ import annotations

import logging
import os

import httpx

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.persistence.supabase import client as supabase_client_module
from app.presentation.error_handlers import register_error_handlers
from app.presentation.auth import require_admin
from app.presentation.api import (
    stories, compositions, discovery, categories, assets, runtime, settings, artifacts, published_content,
    artifact_providers, ads, sports, location, studio, editorial, portal, radio, polls, players, capsules, picks, social, research, matches, insights, ad_slots,
)
from app.presentation.api.stories import productions_router

logger = logging.getLogger("cronos.scheduled_publications")


app = FastAPI(title="CRONOS Backend", version="0.1.0")

# Local dev origins are always allowed; CORS_ALLOWED_ORIGINS (comma-separated)
# adds real ones on top -- e.g. the Vercel frontend URL in production. Never
# hardcode a production domain here; it differs per environment (staging vs
# production, custom domain vs *.vercel.app preview) -- see
# docs/NEXUS_ENVIRONMENT_MATRIX.md.
_DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000", "http://nexus.local", "http://localhost"]
_extra_origins = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_ORIGINS + _extra_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(stories.router, dependencies=[require_admin()])
app.include_router(compositions.router, dependencies=[require_admin()])
app.include_router(discovery.router, dependencies=[require_admin()])
app.include_router(categories.router)
app.include_router(assets.router, dependencies=[require_admin()])
app.include_router(runtime.router, dependencies=[require_admin()])
app.include_router(settings.router)
app.include_router(artifacts.router, dependencies=[require_admin()])
app.include_router(artifact_providers.router, dependencies=[require_admin()])
app.include_router(published_content.router)
app.include_router(ad_slots.router)  # /api/ads/slots before /api/ads/{banner_id}
app.include_router(ad_slots.admin_router, dependencies=[require_admin()])
app.include_router(ads.router)
app.include_router(sports.router)
app.include_router(location.router)
app.include_router(studio.router, dependencies=[require_admin()])
app.include_router(productions_router, dependencies=[require_admin()])
app.include_router(editorial.router, dependencies=[require_admin()])
app.include_router(portal.router)  # GET public, PUT admin (per route)
app.include_router(radio.router, dependencies=[require_admin()])
app.include_router(polls.router)  # public: list, read, vote
app.include_router(polls.admin_router, dependencies=[require_admin()])
app.include_router(players.router)  # public read-only ESPN proxy
app.include_router(capsules.router)  # public: feed, list, read
app.include_router(capsules.admin_router, dependencies=[require_admin()])
app.include_router(picks.router)  # public: data-driven parlay suggestions
app.include_router(social.router)  # public: reactions and comments
app.include_router(social.admin_router, dependencies=[require_admin()])
app.include_router(research.router, dependencies=[require_admin()])
app.include_router(matches.router)  # public: live match centre + scorer insights
app.include_router(insights.router)  # public: self-publishing match previews/impacts


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/diagnostics/env")
def diagnostics_env(verify_github: bool = False) -> dict:
    """Reporta configuración sin revelar secretos. Si verify_github=true,
    valida en modo solo lectura que el token puede consultar los workflows."""
    using_service_role = bool(os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    token = os.getenv("GITHUB_DISPATCH_TOKEN", "")
    repository = os.getenv("GITHUB_REPOSITORY", "")
    github_check: dict = {
        "token_configured": bool(token),
        "repository_configured": bool(repository),
        "dispatch_ref": os.getenv("GITHUB_DISPATCH_REF", "master"),
        "verification": "not_requested",
    }

    if verify_github:
        if not token or not repository:
            github_check["verification"] = "missing_configuration"
        else:
            try:
                response = httpx.get(
                    f"https://api.github.com/repos/{repository}/actions/workflows",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    params={"per_page": 1},
                    timeout=6.0,
                )
                github_check["http_status"] = response.status_code
                if response.status_code == 200:
                    github_check["verification"] = "authenticated_actions_read"
                    github_check["visible_workflows"] = response.json().get("total_count", 0)
                elif response.status_code == 401:
                    github_check["verification"] = "token_rejected"
                elif response.status_code == 403:
                    github_check["verification"] = "actions_permission_or_rate_limit"
                else:
                    github_check["verification"] = "github_api_error"
            except httpx.HTTPError:
                github_check["verification"] = "github_api_unreachable"

    return {
        "env_file_loaded_from": str(supabase_client_module._ENV_FILE),
        "env_file_exists": supabase_client_module._ENV_FILE.exists(),
        "SUPABASE_URL": "configured" if os.getenv("SUPABASE_URL") else "missing",
        "SUPABASE_PUBLISHABLE_KEY": "configured" if (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")) else "missing",
        "SUPABASE_SECRET_KEY": "configured" if using_service_role else "missing",
        "client_will_use": "service_role" if using_service_role else "anon (falls back)",
        "github_dispatch": github_check,
    }
