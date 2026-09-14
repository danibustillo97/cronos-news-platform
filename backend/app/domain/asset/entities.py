"""ASSET bounded context — a generated/sourced media file with provenance.
Files live in storage (today: LAB's local export dir; tomorrow: Supabase
Storage) — the domain only ever holds a reference, never a raw path exposed
to the frontend.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.domain.shared.ids import AssetId, CompositionId, StoryId


class AssetType(str, Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    VOICE = "VOICE"
    SUBTITLE = "SUBTITLE"
    LOGO = "LOGO"
    GRAPHIC = "GRAPHIC"
    FONT = "FONT"


@dataclass(frozen=True)
class Asset:
    id: AssetId
    story_id: StoryId
    composition_id: CompositionId | None
    type: AssetType
    provenance: str | None
    storage_ref: str  # opaque reference resolved by StoragePort, never a raw filesystem path
    created_at: datetime
    # Generation prompt, dimensions, duration and any other provider-specific
    # data live here (rule: no dedicated columns until a real use case reads
    # them back — e.g. searching/regenerating by prompt is not wired yet).
    metadata: dict = field(default_factory=dict)
