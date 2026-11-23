"""Aplicación: orquesta una Production completa corriendo `domain.PIPELINE`
en orden, contra un único item_id de LAB. No sabe de FastAPI ni de HTTP
(eso es `main.py`); no sabe de subprocess de LAB (eso es `lab_adapter.py`).

Etapas DETERMINISTIC: el Runtime las corre solo, vía lab_adapter.run_cli.

Etapas CLAUDE (editorial intelligence, story concepts, hooks, script,
narrative direction, audio direction, media planning): el Runtime NO
lanza Claude Code -- eso requeriría un subprocess con permisos elevados
sin supervisión humana, que está deliberadamente fuera de lo que este
proceso hace. En su lugar, el Runtime marca la Production como
WAITING_CREATIVE_WORKER (estado real, no un error) y se detiene. Un
humano corre la skill/command real de LAB (.claude/commands/lab-*.md) en
su propia sesión de Claude Code, y cuando termina reporta el resultado a
POST /productions/{id}/creative-stage-done -- eso reanuda el pipeline
automáticamente desde la siguiente etapa (ver report_creative_done.py).
"""

from __future__ import annotations

import asyncio
import functools
import logging
import os
import time

import httpx

from . import artifacts, lab_adapter, supabase_mirror
from .domain import PIPELINE, Stage, StageKind

logger = logging.getLogger("runtime.orchestrator")

NEWS_BACKEND_URL = os.getenv("NEWS_BACKEND_URL", "http://localhost:8000")

STAGE_LABELS: dict[str, str] = {
    "editorial": "Inteligencia editorial",
    "media_init": "Media (inicio)",
    "media_plan": "Media (plan)",
    "media_generate": "Media (generación)",
    "narrative_direction": "Dirección narrativa",
    "narrative_review": "Dirección narrativa (review)",
    "audio_direction": "Dirección de audio",
    "audio_review": "Dirección de audio (review)",
    "sequence_plan": "Secuencia",
    "sequence_review": "Secuencia (review)",
    "animation_plan": "Animación",
    "render": "Render",
    "assembly": "Assembly",
    "export": "Export",
}

# item_id -> asyncio.Task, para poder cancelar producciones en curso
_RUNNING_TASKS: dict[str, asyncio.Task] = {}


def _finalize_composition(story_id: str) -> None:
    """Al terminar una Production, reusa el caso de uso ProduceStory que
    YA existe en news/backend (POST /api/stories/{id}/produce) para armar
    la Composition a partir de todo lo que ahora hay en story_intelligence
    -- el Runtime no reimplementa esa lógica de mapeo, solo dispara el
    endpoint que ya la tiene."""
    try:
        httpx.post(f"{NEWS_BACKEND_URL}/api/stories/{story_id}/produce", json={}, timeout=30)
    except httpx.HTTPError as exc:
        logger.warning("No se pudo finalizar la composition de %s en news/backend: %s", story_id, exc)


def _run_deterministic_stage(stage: Stage, item_id: str) -> tuple[bool, dict]:
    """Corre una Stage DETERMINISTIC (uno o más lab.cli commands encadenados).
    Nunca lanza -- el detalle trae el error real."""
    details: dict = {"steps": []}
    try:
        for cmd in stage.cli_commands:
            result = lab_adapter.run_cli(cmd, item_id)
            details["steps"].append({"cli": cmd, **result.to_dict()})
            if not result.ok:
                return False, details
        return True, details
    except Exception as exc:  # noqa: BLE001 -- se reporta, no se oculta
        details["exception"] = str(exc)
        return False, details


def _waiting_detail(stage: Stage, item_id: str) -> str:
    return (
        f"Esperando Creative Worker -- correr /{stage.slash_command} {item_id} en una sesión de "
        f"Claude Code sobre RPA_NEWS_SCRIPT, después reportar con report_creative_done.py "
        f"{item_id} {stage.name} --ok (ver runtime/report_creative_done.py)"
    )


def _mark_stage(stage_states: list[dict], stage_name: str, **fields) -> None:
    for st in stage_states:
        if st["id"] == stage_name:
            st.update(fields)


async def _persist_artifacts(story_id: str, stage: Stage, item_id: str) -> None:
    loop = asyncio.get_running_loop()
    found = await loop.run_in_executor(None, artifacts.collect_stage_artifacts, stage.name, item_id)
    for kind, payload in found.items():
        await loop.run_in_executor(None, supabase_mirror.upsert_intelligence, story_id, kind, payload)


async def run_production(production_id: str, story_id: str, item_id: str) -> None:
    """Corre PIPELINE desde la primera etapa no-DONE. Se detiene (sin
    fallar) en la primera etapa CLAUDE pendiente -- eso es
    WAITING_CREATIVE_WORKER, un estado real, no un error (sección 7/18
    del pedido). Reanuda solo hasta la próxima etapa CLAUDE o hasta el
    final. Nunca fabrica progreso ni completa una etapa creativa sola."""
    loop = asyncio.get_running_loop()
    already_done = await loop.run_in_executor(None, supabase_mirror.completed_stages, production_id)

    supabase_mirror.set_production_status(production_id, "RUNNING")
    stage_states = [
        {"id": s.name, "label": STAGE_LABELS.get(s.name, s.name), "done": s.name in already_done, "detail": None}
        for s in PIPELINE
    ]
    supabase_mirror.set_production_stages(production_id, stage_states)

    for stage in PIPELINE:
        if stage.name in already_done:
            continue

        if stage.kind is StageKind.CLAUDE:
            _mark_stage(stage_states, stage.name, detail=_waiting_detail(stage, item_id))
            await loop.run_in_executor(None, supabase_mirror.set_production_stages, production_id, stage_states)
            await loop.run_in_executor(
                None, functools.partial(supabase_mirror.start_job, production_id, stage.name, status="QUEUED"),
            )
            logger.info("Production %s esperando Creative Worker en etapa %s (%s)", production_id, stage.name, item_id)
            return  # se detiene acá -- report_creative_done.py reanuda

        job_id = await loop.run_in_executor(None, supabase_mirror.start_job, production_id, stage.name)
        ok, details = await loop.run_in_executor(None, _run_deterministic_stage, stage, item_id)
        error = None if ok else _summarize_error(stage, details)
        await loop.run_in_executor(
            None, functools.partial(supabase_mirror.finish_job, job_id, ok=ok, lab_job_id=None, error=error),
        )

        if ok:
            await _persist_artifacts(story_id, stage, item_id)
            _mark_stage(stage_states, stage.name, done=True, detail=None)
            await loop.run_in_executor(None, supabase_mirror.set_production_stages, production_id, stage_states)
            continue

        if stage.optional:
            logger.warning("Etapa opcional %s falló para %s, se sigue: %s", stage.name, item_id, error)
            _mark_stage(stage_states, stage.name, detail=f"Falló (opcional, se saltó): {error}")
            await loop.run_in_executor(None, supabase_mirror.set_production_stages, production_id, stage_states)
            continue

        supabase_mirror.set_production_status(production_id, "FAILED", error=error)
        logger.error("Production %s falló en etapa %s: %s", production_id, stage.name, error)
        return

    supabase_mirror.set_production_status(production_id, "COMPLETED")
    await loop.run_in_executor(None, _finalize_composition, story_id)


async def advance_after_creative_stage(
    production_id: str, story_id: str, item_id: str, stage_name: str, ok: bool, error: str | None,
) -> None:
    """Lo llama POST /productions/{id}/creative-stage-done cuando el
    Creative Worker (humano) terminó de correr la skill real de LAB.
    Marca esa etapa DONE/FAILED con los artifacts que ya existen en disco
    (el Runtime no los inventa, los lee -- ver artifacts.py) y retoma
    `run_production` para que el resto del pipeline determinista siga
    solo, sin que el usuario mueva nada (sección 8 del pedido)."""
    loop = asyncio.get_running_loop()
    stage = next((s for s in PIPELINE if s.name == stage_name), None)
    if stage is None:
        raise ValueError(f"Etapa desconocida: {stage_name!r}")

    if ok:
        await _persist_artifacts(story_id, stage, item_id)
        found = await loop.run_in_executor(None, artifacts.collect_stage_artifacts, stage_name, item_id)
        if not found and not stage.optional:
            # El humano dijo "listo" pero no hay ningún artifact nuevo en
            # disco -- no confiar ciegamente, esto es exactamente el caso
            # "no fake completion" de la sección 18 del pedido.
            ok = False
            error = (
                f"report_creative_done marcó {stage_name} como OK pero no se encontró ningún "
                f"artifact nuevo para {item_id} -- ¿corriste la skill real?"
            )

    job_id = await loop.run_in_executor(None, supabase_mirror.latest_job_id, production_id, stage_name)
    if job_id:
        await loop.run_in_executor(
            None, functools.partial(supabase_mirror.finish_job, job_id, ok=ok, lab_job_id=None, error=error),
        )

    if not ok:
        supabase_mirror.set_production_status(production_id, "FAILED", error=error or f"{stage_name} falló (Creative Worker)")
        logger.error("Production %s falló en etapa creativa %s: %s", production_id, stage_name, error)
        return

    start_production_task(production_id, story_id, item_id)


def _summarize_error(stage: Stage, details: dict) -> str:
    if "exception" in details:
        return f"{stage.name}: {details['exception']}"
    last = details["steps"][-1] if details["steps"] else {}
    stderr = (last.get("stderr") or "").strip()
    parsed = last.get("parsed")
    if isinstance(parsed, dict) and parsed.get("error"):
        return f"{stage.name}: {parsed['error']}"
    return f"{stage.name}: returncode={last.get('returncode')} {stderr[-500:]}"


def start_production_task(production_id: str, story_id: str, item_id: str) -> None:
    """Dispara `run_production` en background -- no bloquea el request
    HTTP que lo pidió (POST /productions/{id}/start responde enseguida)."""
    if production_id in _RUNNING_TASKS and not _RUNNING_TASKS[production_id].done():
        return  # ya corriendo -- idempotente, no duplica (sección 25 del pedido)
    task = asyncio.create_task(run_production(production_id, story_id, item_id))
    _RUNNING_TASKS[production_id] = task


def cancel_production(production_id: str) -> bool:
    task = _RUNNING_TASKS.get(production_id)
    if task and not task.done():
        task.cancel()
        supabase_mirror.set_production_status(production_id, "FAILED", error="Cancelado por el usuario")
        return True
    return False


# ── Discovery ─────────────────────────────────────────────────────────
# `run-scraper` is deterministic (fetch/extract/quality/dedupe, no Claude
# involved at all) -- unlike Production, there's no Creative Worker
# hand-off here. This is the only thing this Runtime does that news/
# backend calls "Automation" for: bringing in real raw content. Turning
# that content into a DiscoveryItem domain entity (classification, scores)
# is news/backend's job, done by reading the same workspace files
# directly (same pattern export_reader.py already uses for exports) --
# this module only runs the ingestion and reports back which item ids it
# produced, never the domain mapping itself.

_RUNNING_DISCOVERY_TASKS: dict[str, asyncio.Task] = {}


_REPORT_STATUS_ATTEMPTS = 3
_REPORT_STATUS_RETRY_DELAY_SECONDS = 2


def _report_discovery_status(job_id: str, status: str, **fields) -> None:
    """PATCHes the real job status back to news/backend. httpx.patch does
    NOT raise for a 4xx/5xx response -- only for connection-level errors
    -- so this used to consider the report "sent" even when the backend
    failed to process it, leaving the job silently stuck at RUNNING
    forever (real bug: a 500 from a failed ingestion, 2026-09-16).
    Retries a transient failure (connection error or 5xx) a bounded
    number of times; a 4xx is a real client-side error (bad payload) that
    retrying won't fix, so it's logged once and not retried."""
    url = f"{NEWS_BACKEND_URL}/api/discovery/jobs/{job_id}"
    payload = {"status": status, **fields}
    last_error = "unknown"

    for attempt in range(1, _REPORT_STATUS_ATTEMPTS + 1):
        try:
            resp = httpx.patch(url, json=payload, timeout=30)
        except httpx.HTTPError as exc:
            last_error = f"connection error: {exc}"
        else:
            if resp.status_code < 300:
                return
            if 400 <= resp.status_code < 500:
                logger.error(
                    "Reporte de discovery job %s (%s) rechazado por el backend (%d, no reintentable): %s",
                    job_id, status, resp.status_code, resp.text[:500],
                )
                return
            last_error = f"HTTP {resp.status_code}: {resp.text[:500]}"

        if attempt < _REPORT_STATUS_ATTEMPTS:
            logger.warning(
                "Reporte de discovery job %s (%s) intento %d/%d falló: %s -- reintentando",
                job_id, status, attempt, _REPORT_STATUS_ATTEMPTS, last_error,
            )
            time.sleep(_REPORT_STATUS_RETRY_DELAY_SECONDS)

    logger.error(
        "No se pudo reportar el discovery job %s (%s) al backend tras %d intentos: %s",
        job_id, status, _REPORT_STATUS_ATTEMPTS, last_error,
    )


async def run_discovery(job_id: str, params: dict) -> None:
    _report_discovery_status(job_id, "RUNNING")
    args: list[str] = ["--job-id", job_id]
    if params.get("max_sources") is not None:
        args += ["--max-sources", str(params["max_sources"])]
    if params.get("max_items") is not None:
        args += ["--max-items", str(params["max_items"])]

    try:
        # run_cli is a blocking subprocess call -- off the event loop so
        # the /status heartbeat and other requests stay responsive while
        # a real scrape (network I/O against ~50+ sources) runs.
        result = await asyncio.to_thread(lab_adapter.run_cli, "run-scraper", *args)
    except Exception as exc:  # noqa: BLE001
        _report_discovery_status(job_id, "FAILED", error=str(exc))
        return

    if not result.ok:
        stderr = (result.stderr or "").strip()
        error = (result.parsed or {}).get("error") if isinstance(result.parsed, dict) else None
        _report_discovery_status(job_id, "FAILED", error=error or stderr[-500:] or f"returncode={result.returncode}")
        return

    job_result = (result.parsed or {}).get("result") or {}
    item_ids = job_result.get("saved_item_ids", [])
    # A real, cooperative stop was honored -- report CANCELLED (not
    # COMPLETED) so the UI shows what actually happened, while still
    # keeping whatever real items the loop saved before it stopped.
    final_status = "CANCELLED" if job_result.get("stopped") else "COMPLETED"
    _report_discovery_status(job_id, final_status, items_found=len(item_ids), item_ids=item_ids)


def start_discovery_task(job_id: str, params: dict) -> None:
    if job_id in _RUNNING_DISCOVERY_TASKS and not _RUNNING_DISCOVERY_TASKS[job_id].done():
        return  # ya corriendo -- idempotente
    task = asyncio.create_task(run_discovery(job_id, params))
    _RUNNING_DISCOVERY_TASKS[job_id] = task


def request_discovery_stop(job_id: str) -> None:
    """A real, cooperative stop -- writes the signal run_ingestion's loop
    checks between sources via lab.cli's own subprocess (never kills it).
    Fire-and-forget from this function's own perspective: run_discovery
    is what actually reports CANCELLED once the subprocess honors it and
    returns."""
    lab_adapter.request_discovery_stop(job_id)
