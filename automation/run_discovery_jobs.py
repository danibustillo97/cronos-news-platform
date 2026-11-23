"""Discovery worker (GitHub Actions: .github/workflows/discovery-processing.yml).

Runs every QUEUED discovery job over the RSS/Atom feeds in SCRAPER_SOURCES and saves new
candidates to Supabase. "Detener" in the editorial is honoured between feeds, and one broken
feed no longer fails the whole search (see RunQueuedDiscoveryJobs in
backend/app/application/use_cases/discovery.py).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "automation"))

from app.application.use_cases.discovery import RunQueuedDiscoveryJobs  # noqa: E402
from app.container import get_container  # noqa: E402
from scraper import fetch_feed, parse_sources, save_candidate  # noqa: E402

FEED_TIMEOUT_SECONDS = 15.0


def main() -> int:
    container = get_container()
    sources = parse_sources(os.getenv("SCRAPER_SOURCES", ""))
    worker = RunQueuedDiscoveryJobs(
        container.discovery_job_repo,
        fetch_records=lambda source: fetch_feed(source, FEED_TIMEOUT_SECONDS),
        save_record=lambda record, source_name: save_candidate(container, record, source_name, FEED_TIMEOUT_SECONDS),
    )
    processed = worker.execute(sources)
    print(f"discovery worker ran {processed} queued job(s) over {len(sources)} source(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
