"""Worker for the panel's "Buscar noticias" button (discovery-processing.yml).

Takes every QUEUED discovery job and runs the same ingestion as the
scheduled scraper (scraper.ingest). "Detener" is cooperative: the API marks
the job CANCELLING and this worker checks it between sources.
"""
from __future__ import annotations

import dataclasses
import json
from datetime import datetime, timezone
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "automation"))

from app.container import get_container  # noqa: E402
from app.domain.discovery.entities import DiscoveryJobStatus  # noqa: E402
from scraper import ScraperSettings, ingest, profile_sources  # noqa: E402


def run_job(container, job, sources, settings, profile=None) -> dict:
    repo = container.discovery_job_repo
    now = lambda: datetime.now(timezone.utc)  # noqa: E731

    if job.status == DiscoveryJobStatus.CANCELLING:  # stopped before it ever started
        job.cancel(items_found=0, finished_at=now())
        repo.save(job)
        return {"job": job.id, "status": job.status.value, "saved": 0}

    job.start()
    repo.save(job)

    params = job.params or {}
    if params.get("max_sources"):
        sources = sources[: int(params["max_sources"])]
    if params.get("max_items"):
        settings = dataclasses.replace(settings, max_new_items=int(params["max_items"]))

    def should_stop() -> bool:
        current = repo.find_by_id(job.id)
        return current is not None and current.status == DiscoveryJobStatus.CANCELLING

    try:
        report = ingest(container, sources, settings, should_stop=should_stop, profile=profile)
    except Exception as exc:  # noqa: BLE001
        job.fail(f"{type(exc).__name__}: {str(exc)[:200]}", now())
        repo.save(job)
        return {"job": job.id, "status": job.status.value, "saved": 0}

    latest = repo.find_by_id(job.id) or job
    if report.stopped or latest.status == DiscoveryJobStatus.CANCELLING:
        latest.cancel(items_found=report.saved, finished_at=now())
        job = latest
    elif report.sources and report.failed_sources == len(report.sources):
        job.fail("Todas las fuentes fallaron: " + "; ".join(f"{s.host}: {s.error}" for s in report.sources)[:400], now())
    else:
        job.complete(items_found=report.saved, finished_at=now())
    repo.save(job)
    return {"job": job.id, "status": job.status.value, "saved": report.saved, "failed_sources": report.failed_sources}


def main() -> int:
    container = get_container()
    profile = container.content_profile_repo.get()
    sources = profile_sources(profile, os.getenv("SCRAPER_SOURCES", ""))
    settings = ScraperSettings.from_env()
    pending = [j for j in container.discovery_job_repo.list_recent(limit=100)
               if j.status in (DiscoveryJobStatus.QUEUED, DiscoveryJobStatus.CANCELLING)]
    results = []
    for job in reversed(pending):  # oldest first
        if not sources:
            job.fail("No hay fuentes configuradas: revisa el perfil de contenido", datetime.now(timezone.utc))
            container.discovery_job_repo.save(job)
            results.append({"job": job.id, "status": job.status.value})
            continue
        results.append(run_job(container, job, sources, settings, profile))
    print(json.dumps({"processed": len(results), "jobs": results}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
