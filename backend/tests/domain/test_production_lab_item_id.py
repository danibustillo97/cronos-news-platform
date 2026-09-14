"""Production.lab_item_id -- identidad de ejecución en LAB, explícitamente
distinta de story_id (CRONOS, sesión "STORY <-> LAB IDENTITY BRIDGE")."""
from __future__ import annotations

from datetime import datetime, timezone

from app.domain.production.entities import Production, ProductionStatus
from app.domain.shared.ids import ProductionId, StoryId


def test_start_defaults_lab_item_id_to_story_id_when_not_given():
    p = Production.start(ProductionId.new(), StoryId.of("story-1"), datetime.now(timezone.utc))
    assert p.lab_item_id == "story-1"
    assert p.resolved_lab_item_id == "story-1"


def test_start_accepts_a_distinct_lab_item_id():
    p = Production.start(ProductionId.new(), StoryId.of("story-1"), datetime.now(timezone.utc), lab_item_id="different-lab-item")
    assert p.lab_item_id == "different-lab-item"
    assert p.resolved_lab_item_id == "different-lab-item"
    assert str(p.story_id) != p.lab_item_id


def test_resolved_lab_item_id_falls_back_for_legacy_rows_without_the_field():
    """Filas viejas de Supabase sin la columna lab_item_id (ej. las que
    existían antes de este fix) deben seguir resolviendo LAB correctamente."""
    p = Production(
        id=ProductionId.new(), story_id=StoryId.of("793ff158b714"), status=ProductionStatus.RUNNING,
        stages=[], errors=[], started_at=datetime.now(timezone.utc), lab_item_id=None,
    )
    assert p.resolved_lab_item_id == "793ff158b714"
