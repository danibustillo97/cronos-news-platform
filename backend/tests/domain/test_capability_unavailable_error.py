"""CapabilityUnavailableError debe distinguir dos causas reales -- nunca
un solo mensaje genérico "no hay resultado" (sección 8 del pedido:
LAB workspace item not found vs LAB execution has not produced artifacts yet)."""
from __future__ import annotations

from app.domain.shared.errors import CapabilityUnavailableError


def test_item_not_found_reason_has_distinct_message():
    exc = CapabilityUnavailableError("editorial_intelligence", "abc123", reason="item_not_found")
    assert "workspace item not found" in str(exc)
    assert "abc123" in str(exc)
    assert exc.reason == "item_not_found"


def test_artifact_not_ready_is_the_default_reason_and_has_distinct_message():
    exc = CapabilityUnavailableError("render", "abc123")
    assert "has not produced the render artifact yet" in str(exc)
    assert exc.reason == "artifact_not_ready"
    assert str(CapabilityUnavailableError("render", "x", reason="item_not_found")) != str(exc)
