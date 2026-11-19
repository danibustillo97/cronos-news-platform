from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.container import get_container
from app.application.use_cases.artifact import RunArtifactJobInput


def main() -> int:
    container = get_container()
    jobs = container.artifact_job_repo.list_recent(limit=100)
    processed = 0
    for job in jobs:
        if job.status.value != "QUEUED":
            continue
        container.run_artifact_job.execute(RunArtifactJobInput(job_id=job.id))
        processed += 1
    print(f"artifact worker processed {processed} queued jobs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
