"""ASSET bounded context — a generated/sourced media file with provenance.
Files live in storage (today: LAB's local export dir; tomorrow: Supabase
Storage) — the domain only ever holds a reference, never a raw path exposed
to the frontend.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import ArtifactId, AssetId, CompositionId, StoryId


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


@dataclass(frozen=True)
class MediaGenerationResult:
    """What a real MediaGenerationPort implementation returns -- a file
    that genuinely exists in storage, never a placeholder."""
    storage_ref: str
    mime_type: str
    width: int
    height: int
    provider: str
    model: str


class MediaGenerationJobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class MediaGenerationJob:
    """PHASE 7: fulfills one of an Artifact's declared MediaRequirements
    with a real, generated Asset -- same QUEUED/RUNNING/COMPLETED/FAILED
    shape as ArtifactJob/DiscoveryJob, real async work via BackgroundTasks
    (see RunMediaGenerationJob), never fake progress."""
    id: str
    artifact_id: ArtifactId
    placeholder_id: str
    status: MediaGenerationJobStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    asset_id: str | None = None
    error: str | None = None

    def start(self) -> None:
        if self.status != MediaGenerationJobStatus.QUEUED:
            raise InvalidStateTransition("MediaGenerationJob", self.status.value, MediaGenerationJobStatus.RUNNING.value)
        self.status = MediaGenerationJobStatus.RUNNING

    def complete(self, asset_id: str, finished_at: datetime) -> None:
        if self.status != MediaGenerationJobStatus.RUNNING:
            raise InvalidStateTransition("MediaGenerationJob", self.status.value, MediaGenerationJobStatus.COMPLETED.value)
        self.status = MediaGenerationJobStatus.COMPLETED
        self.asset_id = asset_id
        self.finished_at = finished_at

    def fail(self, error: str, finished_at: datetime) -> None:
        if self.status not in (MediaGenerationJobStatus.QUEUED, MediaGenerationJobStatus.RUNNING):
            raise InvalidStateTransition("MediaGenerationJob", self.status.value, MediaGenerationJobStatus.FAILED.value)
        self.status = MediaGenerationJobStatus.FAILED
        self.error = error
        self.finished_at = finished_at
