from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.container import get_container
from app.application.use_cases.media_generation import RunMediaGenerationJobInput


def main() -> int:
    container = get_container()
    jobs = container.media_generation_job_repo.list_recent(limit=100)
    processed = 0
    for job in jobs:
        if job.status.value != "QUEUED":
            continue
        container.run_media_generation_job.execute(RunMediaGenerationJobInput(job_id=job.id))
        processed += 1
    print(f"media worker processed {processed} queued jobs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
