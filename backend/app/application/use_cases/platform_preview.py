"""GetPlatformPreview (P10) -- combines the same Sequence Quick Reel/Story
Reel would build (via Timeline's real builder, P7) with the same
DistributionProfile Safe Area (P6) already defines, so a preview UI never
maintains its own parallel model of "what this will look like" -- it reads
exactly what render and export would read.

Deliberately does NOT attempt to flag Safe Area violations here: that
needs the on-screen rect of each *overlay* element (subtitle, CTA, logo),
and nothing in this workspace positions those yet (Timeline's TEXT track
is modeled but unpopulated, see CRONOS - Timeline Core) -- computing
violations against the video shot's own rect would be meaningless (a
full-bleed video is expected to fill the frame; Safe Area exists to guard
overlays layered on top of it, not the background video itself). Once a
real overlay-positioning piece exists, it calls validate_elements (P6)
itself; this use case only assembles the two things that already exist.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.shared.errors import NotFoundError
from app.domain.distribution.entities import Format, Platform
from app.domain.distribution.safe_area import DistributionProfile, get_profile
from app.domain.ports import CompositionRepository
from app.domain.timeline.builder import build_timeline_from_composition
from app.domain.timeline.entities import Sequence


@dataclass(frozen=True)
class PlatformPreview:
    sequence: Sequence
    profile: DistributionProfile


@dataclass
class GetPlatformPreviewInput:
    composition_id: str
    platform: Platform
    format: Format


class GetPlatformPreview:
    def __init__(self, compositions: CompositionRepository) -> None:
        self._compositions = compositions

    def execute(self, input: GetPlatformPreviewInput) -> PlatformPreview:
        composition = self._compositions.find_by_id(input.composition_id)
        if composition is None:
            raise NotFoundError("Composition", input.composition_id)

        profile = get_profile(input.platform, input.format)
        if profile is None:
            raise NotFoundError("DistributionProfile", f"{input.platform.value}/{input.format.value}")

        sequence = build_timeline_from_composition(composition)
        return PlatformPreview(sequence=sequence, profile=profile)
