"""ASSET bounded context — a generated/sourced media file with provenance.
Files live in storage (today: LAB's local export dir; tomorrow: Supabase
Storage) — the domain only ever holds a reference, never a raw path exposed
to the frontend.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from app.domain.shared.ids import AssetId, CompositionId, StoryId


class AssetType(str, Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"


@dataclass(frozen=True)
class Asset:
    id: AssetId
    story_id: StoryId
    composition_id: CompositionId | None
    type: AssetType
    provenance: str | None
    storage_ref: str  # opaque reference resolved by StoragePort, never a raw filesystem path
    metadata: dict = field(default_factory=dict)
