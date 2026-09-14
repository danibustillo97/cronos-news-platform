"""Unit test for the ProduceStory orchestrator using in-memory test doubles
for every port — this isolates the USE CASE's own orchestration logic from
any real I/O (Supabase, filesystem). These are standard unit-test doubles,
not product mocks: nothing here is shown to a user or persisted anywhere
real; they only exist to prove ProduceStory calls each capability
separately and persists each result distinctly.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.domain.shared.errors import CapabilityUnavailableError
from app.domain.intelligence.entities import EditorialIntelligence, StoryIntelligence, NarrativeDirection, AudioDirection, MediaPlan
from app.application.use_cases.produce_story import ProduceStory, ProduceStoryInput


class InMemoryStoryRepo:
    def __init__(self):
        self.saved = {}

    def find_by_id(self, story_id):
        return self.saved.get(story_id)

    def find_by_source_news_id(self, news_id):
        return None

    def list_recent(self, limit):
        return list(self.saved.values())

    def save(self, story):
        self.saved[str(story.id)] = story


class InMemoryProductionRepo:
    def __init__(self):
        self.saved = []
        self.runtime_managed_ids: set[str] = set()  # simula production_jobs reales del Runtime

    def find_by_id(self, production_id):
        return next((p for p in self.saved if str(p.id) == production_id), None)

    def find_latest_for_story(self, story_id):
        matches = [p for p in self.saved if str(p.story_id) == story_id]
        return matches[-1] if matches else None

    def has_runtime_jobs(self, production_id):
        return production_id in self.runtime_managed_ids

    def save(self, production):
        self.saved.append(production)


class InMemoryCompositionRepo:
    def __init__(self):
        self.saved = []

    def find_by_id(self, composition_id):
        return next((c for c in self.saved if str(c.id) == composition_id), None)

    def list_for_story(self, story_id):
        return [c for c in self.saved if str(c.story_id) == story_id]

    def save(self, composition):
        self.saved.append(composition)


class InMemoryIntelligenceRepo:
    def __init__(self):
        self.calls: list[str] = []

    def save_editorial(self, story_id, result):
        self.calls.append("editorial")

    def save_story_intelligence(self, story_id, result):
        self.calls.append("story_intelligence")

    def save_narrative(self, story_id, result):
        self.calls.append("narrative")

    def save_audio(self, story_id, result):
        self.calls.append("audio")

    def save_media_plan(self, story_id, result):
        self.calls.append("media_plan")

    def get_editorial(self, story_id): return None
    def get_story_intelligence(self, story_id): return None
    def get_narrative(self, story_id): return None
    def get_audio(self, story_id): return None
    def get_media_plan(self, story_id): return None


class InMemoryNewsRepo:
    def find_by_id(self, news_id): return None
    def list_recent(self, limit): return []
    def save(self, news): pass


class FakeEditorial:
    def analyze(self, story_id):
        return EditorialIntelligence(headline="Real headline", what_happened="X happened", angle="HUMAN_ANGLE",
                                      narrative_strength="HIGH", why_it_matters="because", recommended_formats=[])


class FakeStoryIntelligence:
    def discover(self, story_id):
        return StoryIntelligence(has_story=True, reason_if_not=None, concepts=[], hooks=[], script=[])


class FakeNarrative:
    def plan(self, story_id):
        return NarrativeDirection(beats=[])


class FakeAudio:
    def plan(self, story_id):
        return AudioDirection(tracks=[], silence_windows=[], ducking_priority=[])


class FakeMedia:
    def plan(self, story_id):
        return MediaPlan(scenes=[])


class UnavailableCapability:
    """Implements every capability port method so it can stand in for ANY
    of them in a test — each call raises, proving ProduceStory handles a
    genuinely unavailable capability without inventing a result."""

    def analyze(self, story_id):
        raise CapabilityUnavailableError("editorial", story_id)

    def discover(self, story_id):
        raise CapabilityUnavailableError("story_intelligence", story_id)

    def plan(self, story_id):
        raise CapabilityUnavailableError("capability", story_id)

    def result(self, story_id):
        raise CapabilityUnavailableError("capability", story_id)


def _build_use_case():
    intelligence_repo = InMemoryIntelligenceRepo()
    use_case = ProduceStory(
        stories=InMemoryStoryRepo(), productions=InMemoryProductionRepo(),
        compositions=InMemoryCompositionRepo(), intelligence=intelligence_repo, news=InMemoryNewsRepo(),
        editorial=FakeEditorial(), story_intelligence=FakeStoryIntelligence(), narrative=FakeNarrative(),
        audio=FakeAudio(), media=FakeMedia(),
        sequence=UnavailableCapability(), animation=UnavailableCapability(),
        render=UnavailableCapability(), assembly=UnavailableCapability(),
    )
    return use_case, intelligence_repo


def test_produce_story_calls_and_persists_each_capability_separately():
    use_case, intelligence_repo = _build_use_case()

    result = use_case.execute(ProduceStoryInput(story_id="story-1"))

    # Each available capability was persisted through its OWN repository
    # method — never one blob write.
    assert set(intelligence_repo.calls) == {"editorial", "story_intelligence", "narrative", "audio", "media_plan"}

    # Unavailable capabilities (sequence/animation/render/assembly here)
    # failed only their own stage, honestly, without faking a result.
    stage_ids = {s.id: s for s in result.production.stages}
    assert stage_ids["sequence"].done is False
    assert stage_ids["editorial"].done is True

    # Story headline was refined from the real editorial result.
    assert result.story.headline == "Real headline"


def test_produce_story_reuses_existing_production_instead_of_duplicating():
    """Bug real: un click manual de 'Producir' (o la propia llamada de
    finalización del Local Runtime al terminar un pipeline real) no debe
    crear una segunda Production compitiendo con la que ya existe para
    esa Story -- find_latest_for_story() ordena por started_at desc, así
    que una duplicada tapaba la real en el workspace."""
    use_case, _ = _build_use_case()

    first = use_case.execute(ProduceStoryInput(story_id="story-3"))
    second = use_case.execute(ProduceStoryInput(story_id="story-3"))

    assert str(first.production.id) == str(second.production.id)
    assert len(use_case._productions.saved) == 2  # save() se llama dos veces, pero es EL MISMO id


def test_produce_story_can_reopen_a_previously_failed_production():
    """record_stage() rechaza escribir sobre una production COMPLETED/FAILED
    -- reusar una ya FAILED debe reabrirla a RUNNING primero, no explotar."""
    intelligence_repo = InMemoryIntelligenceRepo()
    productions = InMemoryProductionRepo()
    use_case = ProduceStory(
        stories=InMemoryStoryRepo(), productions=productions,
        compositions=InMemoryCompositionRepo(), intelligence=intelligence_repo, news=InMemoryNewsRepo(),
        editorial=UnavailableCapability(), story_intelligence=UnavailableCapability(),
        narrative=UnavailableCapability(), audio=UnavailableCapability(), media=UnavailableCapability(),
        sequence=UnavailableCapability(), animation=UnavailableCapability(),
        render=UnavailableCapability(), assembly=UnavailableCapability(),
    )
    first = use_case.execute(ProduceStoryInput(story_id="story-4"))
    assert first.production.status.value == "FAILED"

    use_case._editorial = FakeEditorial()
    use_case._story_intelligence = FakeStoryIntelligence()
    second = use_case.execute(ProduceStoryInput(story_id="story-4"))

    assert str(second.production.id) == str(first.production.id)
    assert second.production.status.value != "FAILED"


def test_produce_story_never_touches_a_runtime_managed_production():
    """EL bug real de esta sesión: una Production con filas reales en
    production_jobs (el Local Runtime corriendo su pipeline) NUNCA debe
    ser tocada por ProduceStory -- ni sus stages, ni su status, ni sus
    errors. Antes de este fix, un click legacy pisaba una Production
    RUNNING de 14 etapas del Runtime con las 9 etapas viejas y la dejaba
    FAILED aunque el Runtime siguiera legítimamente esperando al
    Creative Worker."""
    from app.domain.production.entities import Production, ProductionStage, ProductionStatus
    from app.domain.shared.ids import ProductionId, StoryId

    productions = InMemoryProductionRepo()
    runtime_production = Production(
        id=ProductionId.new(), story_id=StoryId.of("story-5"), status=ProductionStatus.RUNNING,
        stages=[ProductionStage("editorial", "Inteligencia editorial", False, "Esperando Creative Worker")],
        errors=[], started_at=datetime.now(timezone.utc), lab_item_id="story-5",
    )
    productions.save(runtime_production)
    productions.runtime_managed_ids.add(str(runtime_production.id))

    use_case = ProduceStory(
        stories=InMemoryStoryRepo(), productions=productions,
        compositions=InMemoryCompositionRepo(), intelligence=InMemoryIntelligenceRepo(), news=InMemoryNewsRepo(),
        editorial=UnavailableCapability(), story_intelligence=UnavailableCapability(),
        narrative=UnavailableCapability(), audio=UnavailableCapability(), media=UnavailableCapability(),
        sequence=UnavailableCapability(), animation=UnavailableCapability(),
        render=UnavailableCapability(), assembly=UnavailableCapability(),
    )

    result = use_case.execute(ProduceStoryInput(story_id="story-5"))

    # La Production que vuelve es la MISMA, intacta -- sigue RUNNING con
    # su etapa real, nunca se marcó FAILED ni se le tocaron los stages.
    assert result.production.status == ProductionStatus.RUNNING
    assert [s.id for s in result.production.stages] == ["editorial"]
    assert result.production.errors == []
    # Y ProduceStory nunca la volvió a guardar -- el Runtime sigue siendo el único dueño.
    assert len(productions.saved) == 1


def test_produce_story_uses_lab_item_id_not_story_id_for_capability_lookups():
    """Story.id y lab_item_id pueden divergir -- las capabilities deben
    resolverse contra lab_item_id, nunca asumir que son el mismo valor."""
    from app.domain.production.entities import Production, ProductionStatus
    from app.domain.shared.ids import ProductionId, StoryId

    seen_ids: list[str] = []

    class RecordingEditorial:
        def analyze(self, item_id):
            seen_ids.append(item_id)
            raise CapabilityUnavailableError("editorial", item_id)

    productions = InMemoryProductionRepo()
    productions.save(Production(
        id=ProductionId.new(), story_id=StoryId.of("story-6"), status=ProductionStatus.RUNNING,
        stages=[], errors=[], started_at=datetime.now(timezone.utc), lab_item_id="totally-different-lab-item",
    ))

    use_case = ProduceStory(
        stories=InMemoryStoryRepo(), productions=productions,
        compositions=InMemoryCompositionRepo(), intelligence=InMemoryIntelligenceRepo(), news=InMemoryNewsRepo(),
        editorial=RecordingEditorial(), story_intelligence=UnavailableCapability(),
        narrative=UnavailableCapability(), audio=UnavailableCapability(), media=UnavailableCapability(),
        sequence=UnavailableCapability(), animation=UnavailableCapability(),
        render=UnavailableCapability(), assembly=UnavailableCapability(),
    )
    use_case.execute(ProduceStoryInput(story_id="story-6"))

    assert seen_ids == ["totally-different-lab-item"]


def test_produce_story_fails_cleanly_when_nothing_is_available():
    intelligence_repo = InMemoryIntelligenceRepo()
    use_case = ProduceStory(
        stories=InMemoryStoryRepo(), productions=InMemoryProductionRepo(),
        compositions=InMemoryCompositionRepo(), intelligence=intelligence_repo, news=InMemoryNewsRepo(),
        editorial=UnavailableCapability(), story_intelligence=UnavailableCapability(),
        narrative=UnavailableCapability(), audio=UnavailableCapability(), media=UnavailableCapability(),
        sequence=UnavailableCapability(), animation=UnavailableCapability(),
        render=UnavailableCapability(), assembly=UnavailableCapability(),
    )

    result = use_case.execute(ProduceStoryInput(story_id="story-2"))

    assert result.production.status.value == "FAILED"
    assert result.compositions == []
