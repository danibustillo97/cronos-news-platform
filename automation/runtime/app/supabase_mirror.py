"""Todo lo que el Runtime escribe/lee en Supabase vive acá -- el resto
del Runtime (orchestrator, main) nunca importa `supabase` directamente.
Mismo patrón que `news/backend/app/infrastructure/persistence/supabase/`.

Reglas de las tablas que este módulo toca (ver
news/supabase_setup/cronos_platform_schema.sql):
  - runtime_registrations: un único row 'local', heartbeat.
  - production_jobs: una fila por etapa ejecutada de una producción.
  - story_intelligence: un row por (story_id, kind) -- cada artifact de
    LAB que la etapa produjo, tal cual, sin transformarlo.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from supabase import Client, create_client

_DEFAULT_URL = "https://mxvdnfaeqjifnxqmxbri.supabase.co"
_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"  # runtime/.env


def _load_env_file() -> None:
    """Mismo parser manual que lab/config/settings.py -- runtime/.env
    (gitignored) es donde va SUPABASE_SERVICE_ROLE_KEY localmente, nunca
    en código/logs/commits."""
    if not _ENV_FILE.exists():
        return
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip()


_load_env_file()


@lru_cache(maxsize=1)
def get_client() -> Client:
    url = os.getenv("SUPABASE_URL", _DEFAULT_URL)
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not key:
        raise RuntimeError(
            "Falta SUPABASE_SECRET_KEY en el entorno del Runtime -- "
            "las tablas nuevas (production_jobs, runtime_registrations, story_intelligence "
            "en escritura) exigen role 'authenticated' por RLS; el Runtime corre server-side, "
            "fuera del browser, así que puede usar una key con privilegios reales."
        )
    return create_client(url, key)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def register_runtime(capabilities: list[str]) -> None:
    get_client().table("runtime_registrations").upsert({
        "id": "local", "status": "CONNECTED",
        "capabilities": capabilities, "last_heartbeat_at": _now(),
    }).execute()


def heartbeat() -> None:
    get_client().table("runtime_registrations").update({
        "status": "CONNECTED", "last_heartbeat_at": _now(),
    }).eq("id", "local").execute()


def mark_disconnected() -> None:
    get_client().table("runtime_registrations").update({"status": "DISCONNECTED"}).eq("id", "local").execute()


def start_job(production_id: str, stage: str, status: str = "RUNNING") -> str:
    row = get_client().table("production_jobs").insert({
        "production_id": production_id, "stage": stage, "status": status,
    }).execute()
    return row.data[0]["id"]


def latest_job_id(production_id: str, stage: str) -> str | None:
    rows = get_client().table("production_jobs").select("id").eq(
        "production_id", production_id
    ).eq("stage", stage).order("started_at", desc=True).limit(1).execute()
    return rows.data[0]["id"] if rows.data else None


def get_production(production_id: str) -> dict | None:
    row = get_client().table("productions").select("id,story_id,status").eq(
        "id", production_id
    ).maybe_single().execute()
    return row.data if row and row.data else None


def list_waiting_creative_jobs() -> list[dict]:
    """Todo lo que está QUEUED (esperando Creative Worker) -- lo que
    GET /creative-jobs expone para que un humano sepa qué correr."""
    rows = get_client().table("production_jobs").select(
        "id,production_id,stage,started_at"
    ).eq("status", "QUEUED").order("started_at").execute()
    return rows.data or []


def finish_job(job_id: str, *, ok: bool, lab_job_id: str | None, error: str | None) -> None:
    get_client().table("production_jobs").update({
        "status": "DONE" if ok else "FAILED",
        "lab_job_id": lab_job_id, "error": error, "finished_at": _now(),
    }).eq("id", job_id).execute()


def completed_stages(production_id: str) -> set[str]:
    """Etapas ya en DONE para esta producción -- usado para resumir sin
    repetir trabajo (idempotencia, no relanzar desde cero)."""
    rows = get_client().table("production_jobs").select("stage,status").eq(
        "production_id", production_id
    ).eq("status", "DONE").execute()
    return {r["stage"] for r in rows.data}


def upsert_intelligence(story_id: str, kind: str, payload: dict) -> None:
    get_client().table("story_intelligence").upsert(
        {"story_id": story_id, "kind": kind, "payload": payload},
        on_conflict="story_id,kind",
    ).execute()


def set_production_status(production_id: str, status: str, *, error: str | None = None) -> None:
    update = {"status": status}
    if status in ("COMPLETED", "FAILED"):
        update["completed_at"] = _now()
    if error:
        get_client().table("productions").update(update).eq("id", production_id).execute()
        client = get_client()
        existing = client.table("productions").select("errors").eq("id", production_id).execute()
        errors = (existing.data[0]["errors"] if existing.data else []) or []
        errors.append(error)
        client.table("productions").update({"errors": errors}).eq("id", production_id).execute()
    else:
        get_client().table("productions").update(update).eq("id", production_id).execute()


def set_production_stages(production_id: str, stages: list[dict]) -> None:
    get_client().table("productions").update({"stages": stages}).eq("id", production_id).execute()
