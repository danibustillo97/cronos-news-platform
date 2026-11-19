from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.container import get_container


def main() -> int:
    get_container().run_due_scheduled_artifact_publications.execute()
    print("scheduled publication cycle completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
