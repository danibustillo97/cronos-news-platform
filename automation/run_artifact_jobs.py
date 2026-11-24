"""Worker for AI article drafts (artifact-processing.yml).

1. Jobs stuck in RUNNING for more than STALE_AFTER_MINUTES (the previous
   worker was killed by a timeout or crashed) are marked FAILED with a clear
   message -- never left spinning forever, never silently re-billed.
2. Every QUEUED job is claimed atomically and generated once.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.container import get_container  # noqa: E402
from app.application.use_cases.artifact import RunArtifactJobInput  # noqa: E402

STALE_AFTER_MINUTES = 15


def main() -> int:
    container = get_container()
    now = datetime.now(timezone.utc)
    recovered = container.artifact_job_repo.fail_stale_running(now - timedelta(minutes=STALE_AFTER_MINUTES), now)

    queued = [j for j in container.artifact_job_repo.list_recent(limit=100) if j.status.value == "QUEUED"]
    statuses: dict[str, int] = {}
    for job in reversed(queued):  # oldest first
        result = container.run_artifact_job.execute(RunArtifactJobInput(job_id=job.id))
        statuses[result.status.value] = statuses.get(result.status.value, 0) + 1
    print(json.dumps({"recovered_stale": recovered, "queued": len(queued), "results": statuses}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
