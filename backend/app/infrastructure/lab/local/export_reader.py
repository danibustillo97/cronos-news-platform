"""Shared, low-level reader for a LAB story export directory
(RPA_NEWS_SCRIPT/lab/workspace/exports/<story_id>/). This is the ONLY place
that knows LAB's real export is a directory of JSON files on disk — every
capability adapter composes this, but the shape-detection for ITS OWN
capability lives in that adapter, not here (this class only walks files and
hands back parsed JSON documents + media file paths).
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_VIDEO_EXT = {".mp4", ".mov", ".webm"}


def resolve_workspace_root() -> Path:
    override = os.getenv("LAB_WORKSPACE_PATH")
    if override:
        return Path(override)
    # This file is at news/backend/app/infrastructure/lab/local/export_reader.py;
    # parents[6] is Desktop, the sibling directory of both `news` and RPA_NEWS_SCRIPT.
    return Path(__file__).resolve().parents[6] / "RPA_NEWS_SCRIPT" / "lab" / "workspace" / "exports"


@dataclass(frozen=True)
class LabExportBundle:
    story_id: str
    documents: list[dict]  # only object-shaped JSON — every capability adapter scans this safely
    list_documents: list[list]  # bare top-level JSON arrays (e.g. asset_registry.json)
    video_files: list[tuple[str, str]]  # (role, relative_path) — role is "final" or "shot"
    image_files: list[str]  # relative paths


class LabExportReader:
    def is_available(self, story_id: str) -> bool:
        return (resolve_workspace_root() / story_id).is_dir()

    def read(self, story_id: str) -> LabExportBundle | None:
        export_dir = resolve_workspace_root() / story_id
        if not export_dir.is_dir():
            return None
        return self._read_uncached(story_id, str(export_dir))

    @staticmethod
    @lru_cache(maxsize=32)
    def _read_uncached(story_id: str, export_dir: str) -> LabExportBundle:
        root = Path(export_dir)
        documents: list[dict] = []
        list_documents: list[list] = []
        video_files: list[tuple[str, str]] = []
        image_files: list[str] = []

        for path in root.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            ext = path.suffix.lower()
            if ext == ".json":
                try:
                    parsed = json.loads(path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                if isinstance(parsed, dict):
                    documents.append(parsed)
                elif isinstance(parsed, list):
                    list_documents.append(parsed)
            elif ext in _VIDEO_EXT:
                role = "final" if "final" in rel.lower() else "shot"
                video_files.append((role, rel))
            elif ext in _IMAGE_EXT:
                image_files.append(rel)

        return LabExportBundle(
            story_id=story_id, documents=documents, list_documents=list_documents,
            video_files=video_files, image_files=image_files,
        )
