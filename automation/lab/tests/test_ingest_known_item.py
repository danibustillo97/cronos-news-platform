"""Prueba el fix de ERROR 1 (CRONOS, sesión "FIX REAL NEWS -> RUNTIME ->
LAB"): ingest_known_item() nunca debe devolver item_id=None para una URL
ya conocida -- debe resolver y devolver el item_id real, siempre.

Aísla el índice de dedupe (compartido entre historias) con un archivo
temporal propio -- nunca toca lab/workspace/.dedupe_index.json real.
"""

import shutil

import pytest

from lab.core.paths import INCOMING_DIR
from lab.core.workspace import WorkflowState, load_item
from lab.ingestion import dedupe, run as ingestion_run

_LONG_CONTENT = "contenido de prueba " * 20  # > MIN_CONTENT_LENGTH


@pytest.fixture(autouse=True)
def _isolated_dedupe_index(tmp_path, monkeypatch):
    monkeypatch.setattr(dedupe, "DEDUPE_INDEX_FILE", tmp_path / "dedupe_index_test.json")
    yield


@pytest.fixture
def _cleanup_incoming():
    created_before = {p.name for p in INCOMING_DIR.glob("*.json")}
    yield
    for path in INCOMING_DIR.glob("*.json"):
        if path.name not in created_before:
            path.unlink()


def test_first_ingest_creates_item_and_records_mapping(_cleanup_incoming):
    result = ingestion_run.ingest_known_item(
        title="Historia de prueba A", source_url="https://test.invalid/a", content=_LONG_CONTENT,
    )
    assert result["status"] == "ingested"
    assert result["item_id"]

    item = load_item(WorkflowState.INGESTED, result["item_id"])
    assert item.source_url == "https://test.invalid/a"
    assert dedupe.find_item_id("https://test.invalid/a", item.extra["slug"]) == result["item_id"]


def test_second_ingest_of_same_url_reuses_item_id_never_none(_cleanup_incoming):
    """ERROR 1 exacto: convertir la misma News dos veces no debe crear un
    segundo item LAB ni devolver item_id=None."""
    first = ingestion_run.ingest_known_item(
        title="Historia de prueba B", source_url="https://test.invalid/b", content=_LONG_CONTENT,
    )
    second = ingestion_run.ingest_known_item(
        title="Historia de prueba B", source_url="https://test.invalid/b", content=_LONG_CONTENT,
    )

    assert second["status"] == "existing"
    assert second["item_id"] is not None
    assert second["item_id"] == first["item_id"]

    # Un solo archivo en INGESTED para esta URL, no dos.
    matches = [p for p in INCOMING_DIR.glob("*.json") if load_item(
        WorkflowState.INGESTED, p.stem
    ).source_url == "https://test.invalid/b"]
    assert len(matches) == 1


def test_legacy_dedupe_entry_without_item_id_self_heals(_cleanup_incoming):
    """Simula un índice de dedupe de ANTES de este fix (url/slug marcados
    como conocidos, sin item_ids) -- debe recuperar el item_id real
    escaneando INGESTED, nunca devolver None ni duplicar."""
    first = ingestion_run.ingest_known_item(
        title="Historia de prueba C", source_url="https://test.invalid/c", content=_LONG_CONTENT,
    )
    item = load_item(WorkflowState.INGESTED, first["item_id"])
    # Vuelve el índice a la forma vieja (is_known=True, sin item_ids) --
    # exactamente el estado que causaba el bug real.
    index = dedupe._load()
    index["item_ids"] = {}
    dedupe._save(index)

    second = ingestion_run.ingest_known_item(
        title="Historia de prueba C", source_url="https://test.invalid/c", content=_LONG_CONTENT,
    )
    assert second["status"] == "existing"
    assert second["item_id"] == item.id

    # Se autocuró: ahora sí queda resoluble sin escanear.
    assert dedupe.find_item_id("https://test.invalid/c", item.extra["slug"]) == item.id
