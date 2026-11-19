"""Regression for the real bug found 2026-09-16: discovery_items.id was
typed uuid in Supabase, but every real DiscoveryItem id is LAB's own
natural key (e.g. "df7b48a34390"), never a uuid -- every real ingestion
failed with 'invalid input syntax for type uuid'. The Python side
(SupabaseDiscoveryRepository.save) was already correct -- it just sends
str(item.id) verbatim, no uuid coercion -- so this locks that contract in
so nobody "fixes" it into validating/generating a uuid later. The real
fix is the schema migration (discovery_schema.sql); see docs there.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.domain.discovery.entities import DiscoveryItem, DiscoveryScores
from app.domain.shared.ids import DiscoveryItemId
from app.infrastructure.persistence.supabase.discovery_repository import SupabaseDiscoveryRepository

_NATURAL_KEY = "df7b48a34390"  # LAB's own item id shape -- 12 hex chars, not a uuid


class _FakeTable:
    def __init__(self, client):
        self._client = client

    def upsert(self, payload):
        self._client.last_upsert_payload = payload
        return self

    def execute(self):
        return None


class _FakeClient:
    def __init__(self):
        self.last_upsert_payload = None

    def table(self, name):
        assert name == "discovery_items"
        return _FakeTable(self)


def _item(item_id=_NATURAL_KEY):
    return DiscoveryItem.discover(
        item_id=DiscoveryItemId.of(item_id), source_url="https://example.com/a",
        original_url="https://example.com/a", original_title="Un evento real",
        raw_text="Contenido real.", source_name="Example", source_domain="example.com",
        discovered_at=datetime.now(timezone.utc), scores=DiscoveryScores(),
    )


def test_save_sends_labs_natural_key_verbatim_never_a_uuid():
    client = _FakeClient()
    SupabaseDiscoveryRepository(client).save(_item())

    assert client.last_upsert_payload["id"] == _NATURAL_KEY
    # not 36 chars / no dashes -- genuinely not uuid-shaped, sent as-is
    assert "-" not in client.last_upsert_payload["id"]
