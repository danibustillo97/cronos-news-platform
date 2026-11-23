"""Prueba el contrato Creative Worker (orchestrator.py) sin tocar
Supabase ni lanzar ningún subprocess real -- todo lo que habla con el
mundo exterior (supabase_mirror, lab_adapter, artifacts, httpx) va
mockeado. Lo que se prueba es la DECISIÓN: qué hace el orchestrator
frente a una etapa CLAUDE vs DETERMINISTIC, y que nunca marca una etapa
creativa como terminada sin evidencia real (artifacts en disco)."""

import asyncio
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import orchestrator  # noqa: E402
from app.domain import PIPELINE  # noqa: E402


@pytest.fixture
def mirror(monkeypatch):
    m = MagicMock()
    m.completed_stages.return_value = set()
    m.start_job.return_value = "job-1"
    m.get_production.return_value = {"id": "prod-1", "story_id": "item-1", "status": "RUNNING"}
    m.latest_job_id.return_value = "job-1"
    monkeypatch.setattr(orchestrator, "supabase_mirror", m)
    return m


@pytest.fixture
def no_finalize(monkeypatch):
    monkeypatch.setattr(orchestrator, "_finalize_composition", MagicMock())


def test_first_stage_is_claude_and_pipeline_stops_waiting(mirror, no_finalize, monkeypatch):
    """editorial es la primera etapa y es CLAUDE -- run_production debe
    detenerse ahí (QUEUED), nunca intentar correrla ni marcarla done."""
    run_cli = MagicMock()
    monkeypatch.setattr(orchestrator.lab_adapter, "run_cli", run_cli)

    asyncio.run(orchestrator.run_production("prod-1", "item-1", "item-1"))

    run_cli.assert_not_called()
    mirror.set_production_status.assert_any_call("prod-1", "RUNNING")
    # nunca se llamó set_production_status con COMPLETED ni FAILED
    statuses = [c.args[1] for c in mirror.set_production_status.call_args_list]
    assert "COMPLETED" not in statuses
    assert "FAILED" not in statuses
    # se encoló el job de la etapa creativa, status QUEUED
    mirror.start_job.assert_any_call("prod-1", "editorial", status="QUEUED")


def test_deterministic_stage_runs_via_lab_adapter(mirror, no_finalize, monkeypatch):
    """Con 'editorial' ya DONE, la siguiente etapa (media_init,
    DETERMINISTIC) debe correr vía lab_adapter.run_cli de verdad."""
    mirror.completed_stages.return_value = {"editorial"}
    run_cli = MagicMock()
    run_cli.return_value.ok = True
    run_cli.return_value.to_dict.return_value = {"ok": True}
    monkeypatch.setattr(orchestrator.lab_adapter, "run_cli", run_cli)
    monkeypatch.setattr(orchestrator.artifacts, "collect_stage_artifacts", MagicMock(return_value={}))

    asyncio.run(orchestrator.run_production("prod-1", "item-1", "item-1"))

    run_cli.assert_any_call("media-init", "item-1")
    # se detiene en media_plan (CLAUDE), la siguiente etapa
    mirror.start_job.assert_any_call("prod-1", "media_plan", status="QUEUED")


def test_advance_rejects_ok_report_without_real_artifacts(mirror, no_finalize, monkeypatch):
    """Si el humano reporta --ok pero no hay ningún artifact nuevo en
    disco para esa etapa, el Runtime NO le cree -- lo marca FAILED con un
    error explícito (sección 18 del pedido: no fake completion)."""
    monkeypatch.setattr(orchestrator.artifacts, "collect_stage_artifacts", MagicMock(return_value={}))
    monkeypatch.setattr(orchestrator, "start_production_task", MagicMock())

    asyncio.run(orchestrator.advance_after_creative_stage(
        "prod-1", "item-1", "item-1", "editorial", True, None,
    ))

    fail_calls = [c for c in mirror.set_production_status.call_args_list if c.args[1] == "FAILED"]
    assert fail_calls, "esperaba que se marcara FAILED al no encontrar artifacts reales"
    orchestrator.start_production_task.assert_not_called()


def test_advance_resumes_pipeline_when_artifacts_are_real(mirror, no_finalize, monkeypatch):
    """Si sí hay artifacts reales, se persisten y el pipeline se retoma
    solo -- el usuario no mueve nada más."""
    monkeypatch.setattr(
        orchestrator.artifacts, "collect_stage_artifacts",
        MagicMock(return_value={"editorial_analysis": {"angle": "x"}}),
    )
    resume = MagicMock()
    monkeypatch.setattr(orchestrator, "start_production_task", resume)

    asyncio.run(orchestrator.advance_after_creative_stage(
        "prod-1", "item-1", "item-1", "editorial", True, None,
    ))

    mirror.upsert_intelligence.assert_any_call("item-1", "editorial_analysis", {"angle": "x"})
    resume.assert_called_once_with("prod-1", "item-1", "item-1")


def test_pipeline_stage_names_have_no_typos_vs_labels():
    """Todas las etapas del pipeline real tienen un label humano -- si se
    agrega una etapa nueva sin agregarle label, este test la detecta."""
    for stage in PIPELINE:
        assert stage.name in orchestrator.STAGE_LABELS, f"falta label para la etapa {stage.name!r}"


# ── _report_discovery_status: real bug found 2026-09-16 -- httpx.patch
# doesn't raise for a 4xx/5xx response, so a failed callback used to be
# silently treated as "reported", leaving the job stuck at RUNNING
# forever with no error anywhere. ─────────────────────────────────────

class _FakeResponse:
    def __init__(self, status_code, text="{}"):
        self.status_code = status_code
        self.text = text


def test_report_discovery_status_succeeds_on_2xx(monkeypatch):
    patch = MagicMock(return_value=_FakeResponse(200))
    monkeypatch.setattr(orchestrator.httpx, "patch", patch)
    sleep = MagicMock()
    monkeypatch.setattr(orchestrator.time, "sleep", sleep)

    orchestrator._report_discovery_status("job-1", "COMPLETED", items_found=3)

    assert patch.call_count == 1
    sleep.assert_not_called()


def test_report_discovery_status_does_not_retry_on_4xx(monkeypatch):
    patch = MagicMock(return_value=_FakeResponse(422, "bad payload"))
    monkeypatch.setattr(orchestrator.httpx, "patch", patch)
    sleep = MagicMock()
    monkeypatch.setattr(orchestrator.time, "sleep", sleep)

    orchestrator._report_discovery_status("job-1", "COMPLETED", items_found=3)

    assert patch.call_count == 1  # a 4xx is a real client error -- retrying won't fix it
    sleep.assert_not_called()


def test_report_discovery_status_retries_on_5xx_then_gives_up(monkeypatch):
    patch = MagicMock(return_value=_FakeResponse(500, "internal error"))
    monkeypatch.setattr(orchestrator.httpx, "patch", patch)
    sleep = MagicMock()
    monkeypatch.setattr(orchestrator.time, "sleep", sleep)

    orchestrator._report_discovery_status("job-1", "COMPLETED", items_found=3)

    assert patch.call_count == orchestrator._REPORT_STATUS_ATTEMPTS  # bounded, not infinite
    assert sleep.call_count == orchestrator._REPORT_STATUS_ATTEMPTS - 1


def test_report_discovery_status_retries_on_connection_error_then_succeeds(monkeypatch):
    import httpx as httpx_module

    patch = MagicMock(side_effect=[httpx_module.ConnectError("refused"), _FakeResponse(200)])
    monkeypatch.setattr(orchestrator.httpx, "patch", patch)
    sleep = MagicMock()
    monkeypatch.setattr(orchestrator.time, "sleep", sleep)

    orchestrator._report_discovery_status("job-1", "RUNNING")

    assert patch.call_count == 2
    assert sleep.call_count == 1
