import pytest

from app.domain.distribution.entities import Format, Platform
from app.domain.distribution.safe_area import (
    DEFAULT_PROFILES,
    DistributionProfile,
    EdgeInsets,
    Rect,
    get_profile,
    validate_elements,
)


def test_safe_area_shrinks_canvas_by_insets():
    profile = DistributionProfile(
        platform=Platform.TIKTOK, format=Format.REEL,
        canvas_width=1080, canvas_height=1920,
        safe_area_insets=EdgeInsets(top=220, right=140, bottom=400, left=44),
    )
    safe = profile.safe_area
    assert safe.x == 44
    assert safe.y == 220
    assert safe.width == 1080 - 44 - 140
    assert safe.height == 1920 - 220 - 400


def test_element_fully_inside_safe_area_is_ok():
    profile = DistributionProfile(
        platform=Platform.YOUTUBE, format=Format.LONG_FORM,
        canvas_width=1920, canvas_height=1080,
        safe_area_insets=EdgeInsets(),
    )
    result = validate_elements({"logo": Rect(x=10, y=10, width=100, height=50)}, profile)
    assert result.ok
    assert result.violations == []


def test_element_outside_safe_area_is_a_violation():
    profile = DistributionProfile(
        platform=Platform.TIKTOK, format=Format.REEL,
        canvas_width=1080, canvas_height=1920,
        safe_area_insets=EdgeInsets(top=220, right=140, bottom=400, left=44),
    )
    result = validate_elements({"cta": Rect(x=0, y=0, width=200, height=200)}, profile)
    assert not result.ok
    assert result.violations[0].element_id == "cta"


def test_partial_overlap_is_still_a_violation():
    profile = DistributionProfile(
        platform=Platform.INSTAGRAM, format=Format.REEL,
        canvas_width=1080, canvas_height=1920,
        safe_area_insets=EdgeInsets(top=269, right=120, bottom=384, left=65),
    )
    safe = profile.safe_area
    straddling = Rect(x=safe.x - 10, y=safe.y, width=50, height=50)
    result = validate_elements({"subtitle": straddling}, profile)
    assert not result.ok


def test_get_profile_matches_prepare_distribution_platform_format_mapping():
    for platform, format in [
        (Platform.TIKTOK, Format.REEL),
        (Platform.INSTAGRAM, Format.REEL),
        (Platform.FACEBOOK, Format.REEL),
        (Platform.YOUTUBE, Format.SHORT),
    ]:
        assert get_profile(platform, format) is not None


def test_get_profile_returns_none_for_unknown_pair():
    assert get_profile(Platform.WEB, Format.ARTICLE) is None


def test_default_profiles_are_internally_consistent():
    for (platform, format), profile in DEFAULT_PROFILES.items():
        assert profile.platform == platform
        assert profile.format == format
        safe = profile.safe_area
        assert safe.width > 0
        assert safe.height > 0
