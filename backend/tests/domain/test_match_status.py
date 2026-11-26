from datetime import date, datetime, timezone

from app.domain.football.match_status import belongs_to_today, bogota_day, bogota_today, espn_dates, legacy_bucket, normalize_status


def test_maps_real_provider_states():
    assert normalize_status({"name": "STATUS_FIRST_HALF", "state": "in"}) == "LIVE"
    assert normalize_status({"name": "STATUS_HALFTIME", "state": "in"}) == "HT"
    assert normalize_status({"name": "STATUS_FULL_TIME", "state": "post", "completed": True}) == "FINISHED"
    assert normalize_status({"name": "STATUS_POSTPONED", "state": "post"}) == "POSTPONED"
    assert normalize_status({"name": "STATUS_CANCELED", "state": "post"}) == "CANCELLED"
    assert normalize_status({"state": "post", "completed": False}) == "UNKNOWN"
    assert normalize_status(None) == "UNKNOWN"


def test_legacy_contract_is_kept_and_postponed_is_not_finished():
    assert legacy_bucket("LIVE") == "live"
    assert legacy_bucket("HT") == "live"
    assert legacy_bucket("FINISHED") == "finished"
    assert legacy_bucket("SCHEDULED") == "scheduled"
    assert legacy_bucket("POSTPONED") == "postponed"


def test_colombia_day_not_utc():
    # 01:40 UTC of the 27th is still 20:40 of the 26th in Bogotá
    assert bogota_day("2026-11-27T01:40Z") == date(2026, 11, 26)
    assert bogota_today(datetime(2026, 11, 27, 3, 0, tzinfo=timezone.utc)) == date(2026, 11, 26)
    assert espn_dates(date(2026, 11, 26)) == ["20261125", "20261126"]


def test_yesterday_never_counts_as_today_unless_still_live():
    today = date(2026, 11, 26)
    assert not belongs_to_today("FINISHED", "2026-11-25T20:00Z", today)  # yesterday's result
    assert not belongs_to_today("FINISHED", "2026-11-21T22:30Z", today)  # old round returned by the provider
    assert belongs_to_today("SCHEDULED", "2026-11-27T01:40Z", today)     # 8:40 p. m. in Colombia, today
    assert belongs_to_today("LIVE", "2026-11-26T04:30Z", today)          # kicked off 23:30 yesterday, still playing
    assert not belongs_to_today("FINISHED", "2026-11-26T04:30Z", today)
