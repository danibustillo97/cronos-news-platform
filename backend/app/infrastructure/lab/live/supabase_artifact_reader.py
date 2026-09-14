"""Misma interfaz que `LabExportReader` (`.read(story_id) -> LabExportBundle
| None`), pero leyendo desde `story_intelligence` en Supabase en vez del
filesystem local de LAB — esto es lo que permite que los 7
`Local*Adapter` sigan funcionando SIN cambiar una línea de su lógica de
mapeo (duck-typing por shape, no por nombre de archivo, ver cada adapter),
solo cambiando de dónde viene `bundle.documents`.

Por qué esto importa: los adapters existentes leían el export final
(`lab/workspace/exports/<story_id>/`), que solo existe DESPUÉS de que
termina el pipeline completo. Este reader ve el progreso en vivo, porque
el Local Runtime (RPA_NEWS_SCRIPT/runtime/) espeja cada artifact a
`story_intelligence` apenas la etapa que lo produce termina — no al final.
"""

from __future__ import annotations

from app.infrastructure.lab.local.export_reader import LabExportBundle
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


class SupabaseLabArtifactReader:
    def __init__(self, client) -> None:
        self._client = client

    def is_available(self, story_id: str) -> bool:
        return self.read(story_id) is not None

    def read(self, story_id: str) -> LabExportBundle | None:
        try:
            rows = self._client.table("story_intelligence").select("payload").eq(
                "story_id", story_id
            ).execute().data
        except Exception as exc:  # noqa: BLE001
            raise_if_schema_missing(exc, "story_intelligence")
            raise
        if not rows:
            return None

        documents: list[dict] = []
        list_documents: list[list] = []
        for row in rows:
            payload = row.get("payload")
            if isinstance(payload, dict):
                documents.append(payload)
            elif isinstance(payload, list):
                list_documents.append(payload)

        return LabExportBundle(
            story_id=story_id, documents=documents, list_documents=list_documents,
            video_files=[], image_files=[],
        )
