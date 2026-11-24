import httpx
import pytest
from fastapi import BackgroundTasks

from app.infrastructure import serverless
from app.infrastructure.lab.local.local_storage_adapter import LocalLabStorageAdapter
from app.infrastructure.serverless import ReadOnlyEnvironmentError, dispatch_workflow, is_serverless
from app.presentation.api.artifacts import _run_or_hand_off


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for var in ("VERCEL", "CRONOS_SERVERLESS", "GITHUB_DISPATCH_TOKEN", "GITHUB_REPOSITORY", "GITHUB_DISPATCH_REF"):
        monkeypatch.delenv(var, raising=False)


def test_is_serverless_detects_vercel(monkeypatch):
    assert not is_serverless()
    monkeypatch.setenv("VERCEL", "1")
    assert is_serverless()


def test_local_server_runs_job_in_process():
    tasks = BackgroundTasks()
    _run_or_hand_off(tasks, "artifact-processing.yml", print, "job-1")
    assert [(t.func, t.args) for t in tasks.tasks] == [(print, ("job-1",))]


def test_serverless_hands_job_off_to_github_actions(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    tasks = BackgroundTasks()
    _run_or_hand_off(tasks, "artifact-processing.yml", print, "job-1")
    assert [(t.func, t.args) for t in tasks.tasks] == [(dispatch_workflow, ("artifact-processing.yml",))]


def test_dispatch_skipped_without_configuration(monkeypatch):
    def fail(*_a, **_k):
        raise AssertionError("must not call GitHub when not configured")
    monkeypatch.setattr(serverless.httpx, "post", fail)
    assert dispatch_workflow("artifact-processing.yml") is False


def test_dispatch_posts_workflow_dispatch(monkeypatch):
    monkeypatch.setenv("GITHUB_DISPATCH_TOKEN", "t0k")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/repo")
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append((url, json, headers["Authorization"]))
        return httpx.Response(204)

    monkeypatch.setattr(serverless.httpx, "post", fake_post)
    assert dispatch_workflow("media-processing.yml") is True
    assert calls == [(
        "https://api.github.com/repos/owner/repo/actions/workflows/media-processing.yml/dispatches",
        {"ref": "master"},
        "Bearer t0k",
    )]


def test_dispatch_never_raises_on_network_error(monkeypatch):
    monkeypatch.setenv("GITHUB_DISPATCH_TOKEN", "t0k")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/repo")

    def boom(*_a, **_k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(serverless.httpx, "post", boom)
    assert dispatch_workflow("artifact-processing.yml") is False


def test_local_upload_refused_on_serverless(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    with pytest.raises(ReadOnlyEnvironmentError):
        LocalLabStorageAdapter(base_url="http://x").save_upload("story", "a.png", b"img")
