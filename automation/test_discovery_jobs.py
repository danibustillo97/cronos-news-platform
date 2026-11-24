"""Regression tests for the GitHub Actions Discovery worker."""
from __future__ import annotations

from datetime import datetime, timezone

from app.domain.discovery.entities import DiscoveryJob, DiscoveryJobStatus
from automation import run_discovery_jobs as worker


def test_main_marks_queued_jobs_failed_when_no_sources_are_configured(monkeypatch, capsys):
    job = DiscoveryJob(
        id="discovery-test",
        status=DiscoveryJobStatus.QUEUED,
        params={},
        created_at=datetime.now(timezone.utc),
    )

    class JobRepository:
        def __init__(self):
            self.saved = []

        def list_recent(self, limit: int):
            assert limit == 100
            return [job]

        def save(self, value):
            self.saved.append(value)

    class ProfileRepository:
        def get(self):
            return None

    class Container:
        def __init__(self):
            self.discovery_job_repo = JobRepository()
            self.content_profile_repo = ProfileRepository()

    container = Container()
    monkeypatch.setattr(worker, "get_container", lambda: container)
    monkeypatch.setattr(worker, "profile_sources", lambda profile, extra: [])

    assert worker.main() == 0
    assert job.status is DiscoveryJobStatus.FAILED
    assert job.error == "No hay fuentes configuradas: revisa el perfil de contenido"
    assert job.finished_at is not None
    assert job.finished_at.tzinfo is not None
    assert container.discovery_job_repo.saved == [job]
    assert '"status": "FAILED"' in capsys.readouterr().out
