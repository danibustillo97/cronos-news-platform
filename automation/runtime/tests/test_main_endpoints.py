"""Regresión del bug real encontrado en esta sesión: los endpoints
POST /productions/{id}/start|cancel|resume eran `def` (síncronos) pero
llamaban asyncio.create_task() por dentro -- FastAPI corre un endpoint
`def` en un threadpool SIN event loop propio, así que fallaba con
"no running event loop" (nada que ver con RLS/service_role_key, era
un bug de la sesión anterior). TestClient reproduce el mismo entorno de
threadpool que producción, a diferencia de llamar la función a mano."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app import main as main_module  # noqa: E402


def _client(monkeypatch):
    m = MagicMock()
    m.register_runtime = MagicMock()
    m.heartbeat = MagicMock()
    m.mark_disconnected = MagicMock()
    monkeypatch.setattr(main_module, "supabase_mirror", m)
    monkeypatch.setattr(main_module.orchestrator, "supabase_mirror", m)
    return TestClient(main_module.app)


def test_start_production_does_not_raise_no_running_event_loop(monkeypatch):
    client = _client(monkeypatch)
    resp = client.post("/productions/test-prod-1/start", json={"story_id": "s1", "item_id": "s1"})
    assert resp.status_code == 200, resp.text
    assert "no running event loop" not in resp.text
    assert resp.json()["status"] == "RUNNING"


def test_cancel_production_endpoint_runs_without_error(monkeypatch):
    client = _client(monkeypatch)
    resp = client.post("/productions/test-prod-2/cancel")
    assert resp.status_code == 200, resp.text


def test_resume_production_endpoint_runs_without_error(monkeypatch):
    client = _client(monkeypatch)
    resp = client.post("/productions/test-prod-3/resume", json={"story_id": "s1", "item_id": "s1"})
    assert resp.status_code == 200, resp.text


def test_run_discovery_endpoint_returns_202_without_event_loop_error(monkeypatch):
    # Same class of bug as production start/cancel/resume: this endpoint
    # also calls asyncio.create_task() internally, so it must be an
    # `async def` -- this test exists to catch a regression if that ever
    # changes back to `def` by accident. lab_adapter.run_cli is mocked so
    # the background task never actually launches a real scrape.
    client = _client(monkeypatch)
    monkeypatch.setattr(main_module.orchestrator, "_report_discovery_status", MagicMock())
    monkeypatch.setattr(main_module.orchestrator.lab_adapter, "run_cli", MagicMock(
        return_value=MagicMock(ok=True, parsed={"result": {"saved_item_ids": []}}),
    ))
    resp = client.post("/discovery/jobs/test-job-1/run", json={"params": {"max_sources": 1}})
    assert resp.status_code == 202, resp.text
    assert "no running event loop" not in resp.text
    assert resp.json()["status"] == "RUNNING"


def test_generate_media_returns_real_result_from_lab_adapter(monkeypatch):
    client = _client(monkeypatch)
    from app import lab_adapter as lab_adapter_module

    monkeypatch.setattr(lab_adapter_module, "generate_article_image", MagicMock(
        return_value=MagicMock(ok=True, parsed={
            "story_id": "s1", "placeholder_id": "FEATURE_IMAGE", "relative_path": "media/FEATURE_IMAGE.jpeg",
            "mime_type": "image/jpeg", "width": 1024, "height": 1024, "provider": "cloudflare", "model": "flux",
        }),
    ))
    resp = client.post("/media/generate", json={
        "story_id": "s1", "placeholder_id": "FEATURE_IMAGE", "prompt": "Un prompt real",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["relative_path"] == "media/FEATURE_IMAGE.jpeg"


def test_generate_media_returns_502_on_real_provider_failure(monkeypatch):
    client = _client(monkeypatch)
    from app import lab_adapter as lab_adapter_module

    monkeypatch.setattr(lab_adapter_module, "generate_article_image", MagicMock(
        return_value=MagicMock(ok=False, parsed={"error": "429 RESOURCE_EXHAUSTED"}, to_dict=lambda: {
            "ok": False, "returncode": 1, "stdout": "", "stderr": "", "parsed": {"error": "429 RESOURCE_EXHAUSTED"},
        }),
    ))
    resp = client.post("/media/generate", json={
        "story_id": "s1", "placeholder_id": "FEATURE_IMAGE", "prompt": "Un prompt real",
    })
    assert resp.status_code == 502, resp.text
