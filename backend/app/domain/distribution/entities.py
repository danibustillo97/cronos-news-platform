"""DISTRIBUTION bounded context — separate from Composition on purpose: a
Composition is content; a DistributionPlan is one (composition, platform)
delivery attempt with its own honest lifecycle.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import CompositionId, DistributionPlanId


class Platform(str, Enum):
    WEB = "WEB"
    TIKTOK = "TIKTOK"
    INSTAGRAM = "INSTAGRAM"
    FACEBOOK = "FACEBOOK"
    YOUTUBE = "YOUTUBE"


class Format(str, Enum):
    ARTICLE = "ARTICLE"
    POST = "POST"
    REEL = "REEL"
    STORY = "STORY"
    SHORT = "SHORT"
    CAROUSEL = "CAROUSEL"
    LONG_FORM = "LONG_FORM"
    VIDEO = "VIDEO"


class DistributionStatus(str, Enum):
    NOT_CONNECTED = "NOT_CONNECTED"
    READY = "READY"
    PENDING = "PENDING"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"


@dataclass
class DistributionPlan:
    id: DistributionPlanId
    composition_id: CompositionId
    platform: Platform
    format: Format
    status: DistributionStatus
    copy: str | None
    publication_url: str | None = None
    failure_reason: str | None = None

    @staticmethod
    def create(
        plan_id: DistributionPlanId, composition_id: CompositionId,
        platform: Platform, format: Format, initial_status: DistributionStatus, copy: str | None,
    ) -> "DistributionPlan":
        return DistributionPlan(
            id=plan_id, composition_id=composition_id, platform=platform,
            format=format, status=initial_status, copy=copy,
        )

    def mark_pending(self) -> None:
        if self.status != DistributionStatus.READY:
            raise InvalidStateTransition("DistributionPlan", self.status.value, DistributionStatus.PENDING.value)
        self.status = DistributionStatus.PENDING

    def mark_published(self, url: str | None) -> None:
        self.status = DistributionStatus.PUBLISHED
        self.publication_url = url

    def mark_failed(self, reason: str) -> None:
        self.status = DistributionStatus.FAILED
        self.failure_reason = reason


@dataclass(frozen=True)
class PublicationRecord:
    """A real, terminal proof of publication — the PUBLICATION bounded
    context's evidence, distinct from a DistributionPlan's in-flight state."""
    distribution_plan_id: DistributionPlanId
    external_id: str | None
    external_url: str | None
