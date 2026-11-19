"""Reader por defecto de los `Local*Adapter`: primero Supabase (progreso
en vivo, ve etapas mientras corren), y si no hay nada ahí todavía, cae al
export local en disco (compatibilidad con historias ya exportadas antes
de que existiera el Local Runtime — p. ej. el caso de regresión
793ff158b714). Ninguno de los dos se elimina; conviven a propósito
(sección 34 del pedido: implementar, probar, migrar, recién ahí retirar).
"""

from __future__ import annotations

from app.infrastructure.lab.local.export_reader import LabExportBundle, LabExportReader
from app.infrastructure.lab.live.supabase_artifact_reader import SupabaseLabArtifactReader
from app.infrastructure.persistence.supabase.client import get_supabase_client


class CompositeLabReader:
    def __init__(self) -> None:
        self._live = SupabaseLabArtifactReader(get_supabase_client())
        self._export = LabExportReader()

    def is_available(self, story_id: str) -> bool:
        return self.read(story_id) is not None

    def read(self, story_id: str) -> LabExportBundle | None:
        bundle = self._live.read(story_id)
        if bundle is not None:
            return bundle
        return self._export.read(story_id)


def default_reader() -> CompositeLabReader:
    return CompositeLabReader()
