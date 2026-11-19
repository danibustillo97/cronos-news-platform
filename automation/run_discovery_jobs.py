from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
AUTOMATION = ROOT / "automation"
sys.path.insert(0, str(AUTOMATION))

from app.container import get_container
from scraper import fetch_feed, save_candidate, parse_sources


def main() -> int:
    container = get_container()
    jobs = container.discovery_job_repo.list_recent(limit=100)
    processed = 0
    for job in jobs:
        if job.status.value != "QUEUED":
            continue
        job.start()
        container.discovery_job_repo.save(job)
        saved = 0
        try:
            import os
            sources = parse_sources(os.getenv("SCRAPER_SOURCES", ""))
            for source in sources:
                records = fetch_feed(source, 15.0)
                from urllib.parse import urlparse
                source_name = urlparse(source).hostname or source
                for record in records:
                    if save_candidate(container, record, source_name, 15.0):
                        saved += 1
            now = datetime.now(timezone.utc)
            job.complete(items_found=saved, finished_at=now)
            container.discovery_job_repo.save(job)
            processed += 1
        except Exception as exc:
            now = datetime.now(timezone.utc)
            job.fail(str(exc), now)
            container.discovery_job_repo.save(job)
    print(f"discovery worker triggered {processed} queued jobs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
