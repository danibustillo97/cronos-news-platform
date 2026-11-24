"""Presentación HTTP del Local Runtime -- el puente físico entre
news/backend (ExecutionRuntimePort/LocalRuntimeAdapter) y LAB, y el
contrato del Creative Worker (humano + Claude Code, ver orchestrator.py).
Este archivo solo define rutas y delega: no conoce subprocess ni Claude
Code (lab_adapter.py), no conoce Supabase directo (supabase_mirror.py).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import orchestrator, supabase_mirror
from .domain import PIPELINE, StageKind

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("runtime")

RUNTIME_ID = "local"
RUNTIME_VERSION = "0.1.0"
CAPABILITIES = [s.name for s in PIPELINE]
HEARTBEAT_INTERVAL_SECONDS = 15

_started_at = datetime.now(timezone.utc).isoformat()

app = FastAPI(title="CRONOS Local Runtime")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.exception_handler(RuntimeError)
async def _runtime_error(request: Request, exc: RuntimeError):
    # No exponer nada del entorno más allá del mensaje ya-genérico que
    # supabase_mirror arma (nunca incluye la key en sí) -- solo lo
    # convertimos en un 503 honesto en vez de un 500 opaco.
    return JSONResponse(status_code=503, content={"error": "RUNTIME_CONFIG_MISSING", "message": str(exc)})


@app.on_event("startup")
async def _on_startup() -> None:
    try:
        supabase_mirror.register_runtime(CAPABILITIES)
    except Exception as exc:  # noqa: BLE001
        logger.error("No se pudo registrar el runtime en Supabase al arrancar: %s", exc)
    asyncio.create_task(_heartbeat_loop())


async def _heartbeat_loop() -> None:
    while True:
        try:
            supabase_mirror.heartbeat()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Heartbeat falló: %s", exc)
        await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    try:
        supabase_mirror.mark_disconnected()
    except Exception:  # noqa: BLE001
        pass


@app.get("/status")
def status() -> dict:
    return {
        "runtime_id": RUNTIME_ID, "version": RUNTIME_VERSION, "status": "CONNECTED",
        "capabilities": CAPABILITIES, "last_seen": datetime.now(timezone.utc).isoformat(),
        "started_at": _started_at,
    }


@app.get("/capabilities")
def capabilities() -> dict:
    return {"stages": CAPABILITIES}


@app.get("/diagnostics/env")
def diagnostics_env() -> dict:
    """Igual que news/backend GET /diagnostics/env: reporta SOLO
    configured/missing, jamás el valor, y desde ESTE proceso (el que
    realmente corre supabase_mirror.get_client())."""
    using_service_role = bool(os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    return {
        "env_file_loaded_from": str(supabase_mirror._ENV_FILE),
        "env_file_exists": supabase_mirror._ENV_FILE.exists(),
        "SUPABASE_URL": "configured" if os.getenv("SUPABASE_URL") else "using_default",
        "SUPABASE_PUBLISHABLE_KEY": "configured" if (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")) else "missing",
        "SUPABASE_SECRET_KEY": "configured" if using_service_role else "missing",
        "client_will_use": "service_role" if using_service_role else "anon_or_missing",
    }


class IngestRequest(BaseModel):
    title: str
    source_url: str
    content: str
    image_url: str | None = None
    source: str | None = None


@app.post("/ingest")
def ingest(body: IngestRequest) -> dict:
    """Ingesta síncrona de una News ya conocida (viene de Supabase, no de
    scraping) -- devuelve el item_id que news/backend usa como story_id."""
    from . import lab_adapter

    args = ["--title", body.title, "--source-url", body.source_url, "--content", body.content]
    if body.image_url:
        args += ["--image-url", body.image_url]
    if body.source:
        args += ["--source", body.source]
    result = lab_adapter.run_cli("ingest-item", *args)
    if not result.ok or not result.parsed:
        raise HTTPException(status_code=502, detail=result.to_dict())
    lab_result = result.parsed.get("result") or {}
    # "existing" == ya se había ingerido antes -- éxito, idempotente, SIEMPRE
    # con el item_id real (ver ERROR 1: nunca item_id=None en este caso).
    if lab_result.get("status") in ("ingested", "existing"):
        return {"item_id": lab_result["item_id"], "status": lab_result["status"]}
    # rejected_quality / duplicate_unresolvable: error real, no un item_id inventado.
    raise HTTPException(status_code=409, detail=lab_result)


class StartProductionRequest(BaseModel):
    story_id: str
    item_id: str


@app.post("/productions/{production_id}/start")
async def start_production(production_id: str, body: StartProductionRequest) -> dict:
    # async def a propósito: asyncio.create_task() (dentro de
    # start_production_task) exige un event loop corriendo en el hilo
    # actual -- un endpoint `def` normal, FastAPI lo corre en un
    # threadpool sin loop propio, y esto fallaba con "no running event
    # loop" (bloqueo real encontrado en esta sesión, no un problema de RLS/key).
    orchestrator.start_production_task(production_id, body.story_id, body.item_id)
    return {"production_id": production_id, "status": "RUNNING"}


@app.post("/productions/{production_id}/cancel")
async def cancel_production(production_id: str) -> dict:
    cancelled = orchestrator.cancel_production(production_id)
    return {"production_id": production_id, "cancelled": cancelled}


@app.post("/productions/{production_id}/resume")
async def resume_production(production_id: str, body: StartProductionRequest) -> dict:
    # Mismo mecanismo que start -- run_production ya salta las etapas DONE.
    orchestrator.start_production_task(production_id, body.story_id, body.item_id)
    return {"production_id": production_id, "status": "RUNNING"}


# ── Creative Worker contract ─────────────────────────────────────────
# El Runtime nunca lanza Claude Code. Estas dos rutas son el contrato
# completo: un humano ve qué está pendiente, corre la skill real de LAB
# él mismo, y reporta el resultado -- eso reanuda el pipeline determinista
# solo. Ver docs del plan / mensaje de la conversación, sección 5-8.

@app.get("/creative-jobs")
def creative_jobs() -> dict:
    """Todo lo que está QUEUED esperando un Creative Worker -- para cada
    uno, el comando real que hay que correr en Claude Code."""
    pending = supabase_mirror.list_waiting_creative_jobs()
    out = []
    for job in pending:
        stage = next((s for s in PIPELINE if s.name == job["stage"]), None)
        production = supabase_mirror.get_production(job["production_id"])
        story_id = production["story_id"] if production else None
        out.append({
            "production_id": job["production_id"],
            "story_id": story_id,
            "item_id": story_id,  # story_id ES el item_id de LAB (mismo valor, ver ConvertNewsToContent)
            "stage": job["stage"],
            "slash_command": f"/{stage.slash_command} {story_id}" if stage and stage.slash_command else None,
            "queued_at": job.get("started_at"),
        })
    return {"jobs": out}


class CreativeStageDoneRequest(BaseModel):
    stage: str
    ok: bool = True
    error: str | None = None


@app.post("/productions/{production_id}/creative-stage-done")
async def creative_stage_done(production_id: str, body: CreativeStageDoneRequest) -> dict:
    production = supabase_mirror.get_production(production_id)
    if production is None:
        raise HTTPException(status_code=404, detail=f"Production {production_id} no encontrada")
    story_id = production["story_id"]

    stage = next((s for s in PIPELINE if s.name == body.stage), None)
    if stage is None or stage.kind is not StageKind.CLAUDE:
        raise HTTPException(status_code=400, detail=f"{body.stage!r} no es una etapa CLAUDE válida")

    await orchestrator.advance_after_creative_stage(
        production_id, story_id, story_id, body.stage, body.ok, body.error,
    )
    return {"production_id": production_id, "stage": body.stage, "accepted": True}


# ── Discovery ─────────────────────────────────────────────────────────
# Purely deterministic (lab.ingestion.run -- fetch/extract/quality/dedupe,
# no Claude anywhere in it), unlike Production. Fire-and-forget: this
# responds 202 immediately and reports real progress back to news/backend
# via PATCH /api/discovery/jobs/{id} (see orchestrator.run_discovery).

class DiscoveryRunRequest(BaseModel):
    params: dict = {}


@app.post("/discovery/jobs/{job_id}/run", status_code=202)
async def run_discovery(job_id: str, body: DiscoveryRunRequest) -> dict:
    orchestrator.start_discovery_task(job_id, body.params)
    return {"job_id": job_id, "status": "RUNNING"}


@app.post("/discovery/jobs/{job_id}/stop")
def stop_discovery(job_id: str) -> dict:
    """A real, cooperative stop -- never kills the run-scraper subprocess.
    See orchestrator.request_discovery_stop / lab.cli discovery-request-stop."""
    result = orchestrator.request_discovery_stop(job_id)
    if not result.ok:
        raise HTTPException(status_code=502, detail=result.to_dict())
    return {"job_id": job_id, "stop_requested": True}


# ── Media generation (Artifact/Publish) ─────────────────────────────────
# Synchronous, like /ingest: a real Gemini/Cloudflare call takes a few
# seconds, not minutes -- no job queue needed. news/backend is the one
# that wraps this in its own async job (see RunMediaGenerationJob), same
# relationship as ArtifactGenerationPort's own synchronous LLM call.

class GenerateMediaRequest(BaseModel):
    story_id: str
    placeholder_id: str
    prompt: str
    aspect_ratio: str = "16:9"
    provider: str | None = None


@app.post("/media/generate")
def generate_media(body: GenerateMediaRequest) -> dict:
    from . import lab_adapter

    result = lab_adapter.generate_article_image(
        body.story_id, body.placeholder_id, body.prompt, body.aspect_ratio, body.provider,
    )
    if not result.ok or not result.parsed:
        raise HTTPException(status_code=502, detail=result.to_dict())
    return result.parsed
