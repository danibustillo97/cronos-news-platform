from datetime import datetime, timedelta, timezone

from app.domain.discovery.scoring import (
    FRESHNESS_WINDOW_HOURS, compute_completeness_score, compute_freshness_score, compute_material_score,
)


def test_freshness_is_none_without_published_at():
    assert compute_freshness_score(None, datetime.now(timezone.utc)) is None


def test_freshness_is_one_at_zero_age():
    now = datetime.now(timezone.utc)
    assert compute_freshness_score(now, now) == 1.0


def test_freshness_decays_linearly_to_zero_at_window_edge():
    now = datetime.now(timezone.utc)
    published = now - timedelta(hours=FRESHNESS_WINDOW_HOURS)
    assert compute_freshness_score(published, now) == 0.0


def test_freshness_never_goes_negative_past_the_window():
    now = datetime.now(timezone.utc)
    published = now - timedelta(hours=FRESHNESS_WINDOW_HOURS * 10)
    assert compute_freshness_score(published, now) == 0.0


def test_completeness_all_present_is_one():
    score = compute_completeness_score(has_title=True, has_content=True, has_image=True, has_published_at=True, has_author=True)
    assert score == 1.0


def test_completeness_partial():
    score = compute_completeness_score(has_title=True, has_content=True, has_image=False, has_published_at=False, has_author=False)
    assert score == 2 / 5


def test_material_score_zero_without_material():
    assert compute_material_score(0) == 0.0


def test_material_score_one_with_any_material():
    assert compute_material_score(1) == 1.0
    assert compute_material_score(5) == 1.0
