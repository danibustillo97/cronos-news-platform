"""Editorial autopilot (runs right after the scraper in scraper.yml).

Modo automático OFF -> does nothing (articles are written by hand).
Modo automático ON  -> picks the best fresh candidates and the Anthropic API
writes a draft for each, within the per-run and per-day limits configured
in the panel. Drafts land in Revisión; nothing is published automatically.
"""
from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.container import get_container  # noqa: E402


def main() -> int:
    report = get_container().run_editorial_autopilot.execute()
    print(json.dumps(dataclasses.asdict(report), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
