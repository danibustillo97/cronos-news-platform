"""SAFE AREA — part of the DISTRIBUTION bounded context on purpose (rule:
Safe Area is CORE, never a cosmetic check bolted onto export). A
DistributionProfile is a deterministic, sourced description of where a
platform's own UI chrome can legally sit on a canvas of a given size for a
given (platform, format) pair — the compositor/QA layer validates against
it, it never validates itself after the fact.

Margins below are conservative, sourced approximations (platforms publish
creator guidance, not a pixel-perfect contract, and explicitly recommend
previewing the real result) — see obsidian-vault/CRONOS - Safe Area Engine.md
for sources. Treat these as a floor to validate against, not a guarantee;
Platform Preview (P10) is the real visual check once it exists.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.distribution.entities import Format, Platform


@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    width: float
    height: float

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    def contains(self, other: "Rect") -> bool:
        return (
            other.x >= self.x and other.y >= self.y
            and other.right <= self.right and other.bottom <= self.bottom
        )


@dataclass(frozen=True)
class EdgeInsets:
    """How far (px) a platform's own UI can reach in from each edge."""
    top: float = 0
    right: float = 0
    bottom: float = 0
    left: float = 0


@dataclass(frozen=True)
class UIZone:
    """One named region of the platform's own chrome (e.g. TikTok's bottom
    caption bar) — informational, for preview/QA messaging. The actual
    validation boundary is DistributionProfile.safe_area (the union of every
    zone's reach), not any single zone."""
    name: str
    insets: EdgeInsets


@dataclass(frozen=True)
class DistributionProfile:
    platform: Platform
    format: Format
    canvas_width: int
    canvas_height: int
    safe_area_insets: EdgeInsets
    ui_zones: list[UIZone] = field(default_factory=list)
    supported_export: list[str] = field(default_factory=lambda: ["mp4"])

    @property
    def safe_area(self) -> Rect:
        i = self.safe_area_insets
        return Rect(
            x=i.left, y=i.top,
            width=self.canvas_width - i.left - i.right,
            height=self.canvas_height - i.top - i.bottom,
        )


@dataclass(frozen=True)
class SafeAreaViolation:
    element_id: str
    reason: str


@dataclass(frozen=True)
class SafeAreaValidationResult:
    violations: list[SafeAreaViolation] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.violations


def validate_elements(elements: dict[str, Rect], profile: DistributionProfile) -> SafeAreaValidationResult:
    """Pure, deterministic check — no rendering, no I/O. A critical element
    (subtitle, CTA, logo, hook text...) must sit entirely inside the
    profile's safe area; a partial overlap is still a violation. Never
    silently lets one through — the caller (future QA Engine / export gate)
    decides what to do with a non-ok result, this function only reports."""
    safe = profile.safe_area
    violations = [
        SafeAreaViolation(
            element_id=element_id,
            reason=f"outside safe area ({safe.width:.0f}x{safe.height:.0f} at x={safe.x:.0f},y={safe.y:.0f})",
        )
        for element_id, rect in elements.items()
        if not safe.contains(rect)
    ]
    return SafeAreaValidationResult(violations=violations)


# Sourced 2026-09-14 from platform creator-facing safe-zone guidance
# (aggregated, since none of these publish an official machine-readable
# spec) — see obsidian-vault/CRONOS - Safe Area Engine.md for the exact
# figures and sources per platform. Keyed by (platform, format) because the
# same platform's chrome differs by surface (Instagram Reel != Instagram
# Story != Instagram feed Carousel). Format per platform matches
# PrepareDistribution's _PLATFORM_FORMAT mapping (prepare_distribution.py) —
# TIKTOK/INSTAGRAM/FACEBOOK are REEL there, YOUTUBE is SHORT, so the profile
# keys follow that, not platform naming intuition.
DEFAULT_PROFILES: dict[tuple[Platform, Format], DistributionProfile] = {
    (Platform.TIKTOK, Format.REEL): DistributionProfile(
        platform=Platform.TIKTOK, format=Format.REEL,
        canvas_width=1080, canvas_height=1920,
        safe_area_insets=EdgeInsets(top=220, right=140, bottom=400, left=44),
        ui_zones=[
            UIZone("top_status", EdgeInsets(top=220)),
            UIZone("right_action_rail", EdgeInsets(right=140)),
            UIZone("bottom_caption", EdgeInsets(bottom=400)),
        ],
    ),
    (Platform.INSTAGRAM, Format.REEL): DistributionProfile(
        platform=Platform.INSTAGRAM, format=Format.REEL,
        canvas_width=1080, canvas_height=1920,
        safe_area_insets=EdgeInsets(top=269, right=120, bottom=384, left=65),
        ui_zones=[
            UIZone("top_bar", EdgeInsets(top=269)),
            UIZone("right_action_rail", EdgeInsets(right=120)),
            UIZone("bottom_caption", EdgeInsets(bottom=384)),
        ],
    ),
    (Platform.FACEBOOK, Format.REEL): DistributionProfile(
        # Facebook Reels chrome is simpler than Instagram's (fewer
        # right-rail buttons, no audio-attribution bar) but no distinct
        # published margins were found — reusing a tightened version of
        # Instagram's as a conservative floor rather than inventing
        # numbers with no source.
        platform=Platform.FACEBOOK, format=Format.REEL,
        canvas_width=1080, canvas_height=1920,
        safe_area_insets=EdgeInsets(top=200, right=90, bottom=320, left=32),
        ui_zones=[
            UIZone("top_bar", EdgeInsets(top=200)),
            UIZone("right_action_rail", EdgeInsets(right=90)),
            UIZone("bottom_caption", EdgeInsets(bottom=320)),
        ],
    ),
    (Platform.YOUTUBE, Format.SHORT): DistributionProfile(
        # Matches Google's own vertical safe-zone template (840x960 safe
        # area starting at x=48,y=288 inside a 1080x1920 canvas) rather than
        # the looser third-party estimates — it's the most authoritative
        # source available even though YouTube doesn't publish it as a
        # numeric spec. Bottom is the deepest inset of any platform here
        # because the description panel and progress bar can expand well
        # past the collapsed state.
        platform=Platform.YOUTUBE, format=Format.SHORT,
        canvas_width=1080, canvas_height=1920,
        safe_area_insets=EdgeInsets(top=288, right=192, bottom=672, left=48),
        ui_zones=[
            UIZone("top_bar", EdgeInsets(top=288)),
            UIZone("right_action_rail", EdgeInsets(right=192)),
            UIZone("bottom_bar", EdgeInsets(bottom=672)),
        ],
    ),
    (Platform.YOUTUBE, Format.LONG_FORM): DistributionProfile(
        # Horizontal long-form: no platform chrome overlays the video
        # itself (unlike the vertical short-form apps), so the safe area is
        # the full 16:9 canvas.
        platform=Platform.YOUTUBE, format=Format.LONG_FORM,
        canvas_width=1920, canvas_height=1080,
        safe_area_insets=EdgeInsets(),
    ),
}


def get_profile(platform: Platform, format: Format) -> DistributionProfile | None:
    return DEFAULT_PROFILES.get((platform, format))
