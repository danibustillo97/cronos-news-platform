from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.application.use_cases.editorial_automation import (
    RunEditorialAutopilot, UpdateEditorialAutomation, UpdateEditorialAutomationInput, candidate_rank,
)
from app.domain.artifact.entities import ArtifactJob, ArtifactJobStatus
from app.domain.automation.entities import EditorialAutomationSettings
from app.domain.discovery.entities import DiscoveryItem, DiscoveryScores, DiscoveryStatus
from app.domain.ports import ProviderUnavailableError
from app.domain.shared.ids import DiscoveryItemId, StoryId

NOW = datetime(2026, 11, 23, 15, 0, tzinfo=timezone.utc)


class SettingsRepo:
    def __init__(self, settings):
        self.settings = settings
        self.saved = None

    def get(self):
        return self.settings

    def save(self, settings):
        self.saved = settings


class ItemsRepo:
    def __init__(self, items):
        self.items = items
        self.last_filters = None

    def list(self, filters):
        self.last_filters = filters
        return [i for i in self.items if i.status == filters.status]


class JobsRepo:
    def __init__(self, jobs=()):
        self.jobs = list(jobs)

    def list_recent(self, limit=20):
        return self.jobs[:limit]


class Recorder:
    """Stands in for DecideDiscoveryItem / TriggerArtifact / RunArtifactJob."""
    def __init__(self, fail_on=None, result_status="COMPLETED", raise_exc=None):
        self.calls = []
        self.fail_on = fail_on
        self.result_status = result_status
        self.raise_exc = raise_exc

    def execute(self, input):
        self.calls.append(input)
        if self.raise_exc:
            raise self.raise_exc
        if self.fail_on and getattr(input, "story_id", None) == self.fail_on:
            raise RuntimeError("boom")
        return SimpleNamespace(id=f"job-{len(self.calls)}", status=SimpleNamespace(value=self.result_status))


def _item(item_id, title, text_len=800, freshness=0.9, completeness=0.8, age_h=1.0, source="n.test"):
    item = DiscoveryItem.discover(
        item_id=DiscoveryItemId.of(item_id), source_url=f"https://{source}/{item_id}",
        original_url=f"https://{source}/{item_id}", original_title=title, raw_text="x" * text_len,
        source_name=source, source_domain=source, discovered_at=NOW - timedelta(hours=age_h),
        published_at=NOW - timedelta(hours=age_h),
        scores=DiscoveryScores(freshness_score=freshness, completeness_score=completeness),
    )
    return item


def _autopilot(settings, items, jobs=(), trigger=None, run=None):
    decide, trigger, run = Recorder(), trigger or Recorder(), run or Recorder()
    use_case = RunEditorialAutopilot(SettingsRepo(settings), ItemsRepo(items), JobsRepo(jobs), decide, trigger, run)
    return use_case, decide, trigger, run


def test_autopilot_does_nothing_when_off():
    use_case, decide, trigger, run = _autopilot(EditorialAutomationSettings(enabled=False), [_item("a", "A")])
    report = use_case.execute(NOW)
    assert not report.enabled and decide.calls == [] and trigger.calls == []


def test_autopilot_picks_best_candidates_within_run_budget():
    items = [_item("old", "Vieja", age_h=40), _item("best", "Mejor nota", age_h=0.5),
             _item("thin", "Muy corta", text_len=50, age_h=0.2), _item("mid", "Nota media", age_h=6)]
    use_case, decide, trigger, run = _autopilot(EditorialAutomationSettings(enabled=True, max_articles_per_run=2), items)
    report = use_case.execute(NOW)
    assert report.generated == ["best", "mid"]
    assert [c.decision for c in decide.calls] == ["SELECT", "SEND_TO_EDITORIAL"] * 2
    assert {c.provider for c in trigger.calls} == {"anthropic"}
    assert report.candidates == 3  # "thin" filtered by min_text_chars


def test_autopilot_respects_daily_limit():
    today_jobs = [ArtifactJob(id=f"j{i}", story_id=StoryId.of("s"), status=ArtifactJobStatus.COMPLETED,
                              created_at=NOW - timedelta(hours=2), provider="anthropic") for i in range(3)]
    yesterday = ArtifactJob(id="y", story_id=StoryId.of("s"), status=ArtifactJobStatus.COMPLETED,
                            created_at=NOW - timedelta(days=1), provider="anthropic")
    settings = EditorialAutomationSettings(enabled=True, max_articles_per_run=2, max_articles_per_day=4)
    use_case, *_ , trigger, run = _autopilot(settings, [_item("a", "A uno"), _item("b", "B dos")],
                                             jobs=today_jobs + [yesterday])
    report = use_case.execute(NOW)
    assert report.budget == 1 and report.generated == ["a"]

    settings = EditorialAutomationSettings(enabled=True, max_articles_per_run=2, max_articles_per_day=3)
    use_case, *_ = _autopilot(settings, [_item("a", "A")], jobs=today_jobs)
    assert "límite diario" in use_case.execute(NOW).reason


def test_autopilot_skips_same_story_from_two_sources():
    items = [_item("a", "Messi renueva con el Inter Miami hasta 2028", source="as.com", text_len=2000),
             _item("b", "Messi renueva con el Inter Miami hasta 2028", source="ole.com.ar")]
    use_case, decide, _trigger, _run = _autopilot(EditorialAutomationSettings(enabled=True, max_articles_per_run=2), items)
    assert use_case.execute(NOW).generated == ["a"]            # one story, written from the copy with most text
    assert ("b", "ARCHIVE") in [(c.item_id, c.decision) for c in decide.calls]  # the other outlet's copy is archived


def test_autopilot_one_failure_does_not_stop_batch():
    use_case, *_ = _autopilot(EditorialAutomationSettings(enabled=True, max_articles_per_run=2),
                              [_item("a", "Uno primero"), _item("b", "Dos segundo", freshness=0.5)],
                              trigger=Recorder(fail_on="a"))
    report = use_case.execute(NOW)
    assert report.failed == ["a"] and report.generated == ["b"]


def test_autopilot_stops_when_provider_unavailable():
    use_case, *_ = _autopilot(EditorialAutomationSettings(enabled=True, max_articles_per_run=2),
                              [_item("a", "Uno primero"), _item("b", "Dos segundo")],
                              trigger=Recorder(raise_exc=ProviderUnavailableError("sin key")))
    report = use_case.execute(NOW)
    assert report.failed == ["a"] and report.generated == [] and "sin key" in report.reason


def test_rank_prefers_known_freshness():
    assert candidate_rank(_item("a", "A", freshness=0.0)) > candidate_rank(_item("b", "B", freshness=None))


class Resolver:
    def __init__(self, fail):
        self.fail = fail
        self.calls = []

    def resolve(self, requested):
        self.calls.append(requested)
        if self.fail:
            raise ProviderUnavailableError("anthropic no está disponible")


def test_enabling_requires_working_anthropic_provider():
    repo = SettingsRepo(EditorialAutomationSettings())
    with pytest.raises(ProviderUnavailableError):
        UpdateEditorialAutomation(repo, Resolver(fail=True)).execute(UpdateEditorialAutomationInput(True, 2, 10, 400))
    assert repo.saved is None

    resolver = Resolver(fail=True)
    saved = UpdateEditorialAutomation(repo, resolver).execute(UpdateEditorialAutomationInput(False, 2, 10, 400))
    assert saved.enabled is False and resolver.calls == []  # turning OFF never needs the provider


def test_settings_validation():
    with pytest.raises(ValueError):
        EditorialAutomationSettings(enabled=True, max_articles_per_run=5, max_articles_per_day=2)
