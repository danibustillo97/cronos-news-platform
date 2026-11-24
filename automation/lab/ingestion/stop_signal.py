"""File-based cooperative stop signal for a running discovery job.
Runtime and lab.cli run as separate OS processes (lab_adapter.py shells
out via subprocess), so a plain in-memory flag can't cross that boundary
-- a small marker file under the workspace does. Requesting a stop never
kills anything: it just asks run_ingestion's loop to check between
sources and finish cleanly, keeping whatever it already saved (see
run_ingestion's own per-candidate save_item call).
"""
from __future__ import annotations

from pathlib import Path

from lab.core.paths import WORKSPACE_ROOT

_STOP_DIR = WORKSPACE_ROOT / ".control" / "discovery_stop"


def request_stop(job_id: str) -> None:
    _STOP_DIR.mkdir(parents=True, exist_ok=True)
    (_STOP_DIR / job_id).write_text("1", encoding="utf-8")


def is_stop_requested(job_id: str) -> bool:
    return (_STOP_DIR / job_id).exists()


def clear_stop(job_id: str) -> None:
    path = _STOP_DIR / job_id
    if path.exists():
        path.unlink()
