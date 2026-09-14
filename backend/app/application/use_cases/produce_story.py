"""ProduceStory — the central orchestrator: Story -> [capability ports,
each called and persisted separately] -> Composition. This is the concrete
answer to "LAB capabilities redistributed as ports, not one JSON dump."

Dependency direction: this module imports ONLY app.domain.* — never a
concrete infrastructure adapter. Adapters are injected by the composition
root (app/container.py).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.shared.ids import StoryId, ProductionId, CompositionId
from app.domain.shared.errors import CapabilityUnavailableError, NotFoundError
from app.domain.story.entities import Story, StorySource
from app.domain.production.entities import Production, ProductionStage, ProductionStatus
from app.domain.composition.entities import Composition, CompositionContent, CompositionKind, CompositionShot, ScriptLine
from app.domain.ports import (
    NewsRepository, StoryRepository, ProductionRepository, CompositionRepository, IntelligenceRepository,
    EditorialIntelligencePort, StoryIntelligencePort, NarrativeDirectionPort, AudioDirectionPort,
    MediaPlanningPort, SequencePlanningPort, AnimationPlanningPort, RenderPort, AssemblyPort,
)


@dataclass
class ProduceStoryInput:
    story_id: str
    news_id: str | None = None


@dataclass
class ProduceStoryResult:
    story: Story
    production: Production
    compositions: list[Composition]


class ProduceStory:
    def __init__(
        self,
        stories: StoryRepository,
        productions: ProductionRepository,
        compositions: CompositionRepository,
        intelligence: IntelligenceRepository,
        news: NewsRepository,
        editorial: EditorialIntelligencePort,
        story_intelligence: StoryIntelligencePort,
        narrative: NarrativeDirectionPort,
        audio: AudioDirectionPort,
        media: MediaPlanningPort,
        sequence: SequencePlanningPort,
        animation: AnimationPlanningPort,
        render: RenderPort,
        assembly: AssemblyPort,
    ) -> None:
        self._stories = stories
        self._productions = productions
        self._compositions = compositions
        self._intelligence = intelligence
        self._news = news
        self._editorial = editorial
        self._story_intelligence = story_intelligence
        self._narrative = narrative
        self._audio = audio
        self._media = media
        self._sequence = sequence
        self._animation = animation
        self._render = render
        self._assembly = assembly

    def execute(self, input: ProduceStoryInput) -> ProduceStoryResult:
        story = self._stories.find_by_id(input.story_id)
        if story is None:
            headline = input.story_id
            source = StorySource(news_id=None, source_url=None, label="manual")
            if input.news_id:
                news_item = self._news.find_by_id(input.news_id)
                if news_item is not None:
                    headline = news_item.headline
                    source = StorySource(news_id=news_item.id, source_url=news_item.provenance.source_url, label="news")
            story = Story.open_from_news(StoryId.of(input.story_id), headline, source)

        story.begin_production()

        # Reusa la Production ya existente para esta Story en vez de crear
        # una nueva cada vez (idempotencia -- ver ConvertNewsToContent).
        existing = self._productions.find_latest_for_story(input.story_id)

        # La señal REAL de "esto lo maneja el Local Runtime" es que existan
        # filas en production_jobs -- nunca se infiere de lab_item_id (que
        # siempre está seteado, también en el flujo legacy). Si el Runtime
        # ya es dueño del ciclo de vida de esta Production, ProduceStory
        # NUNCA le pisa stages/status/errors -- eso causaba el bug real de
        # esta sesión (un click legacy corrompía una Production RUNNING de
        # 14 etapas del Runtime, dejándola FAILED con las 9 etapas viejas).
        # Acá solo arma/actualiza la Composition con lo que ya esté
        # disponible, best-effort, sin tocar la Production para nada.
        runtime_managed = existing is not None and self._productions.has_runtime_jobs(str(existing.id))

        if existing is not None:
            production = existing
            lab_item_id = production.resolved_lab_item_id
            if not runtime_managed:
                # Camino legacy (ej. 793ff158b714, sin Runtime de por medio):
                # reabrir y re-correr el sweep síncrono completo, como siempre.
                production.stages = []
                production.errors = []
                production.completed_at = None
                production.status = ProductionStatus.RUNNING
        else:
            production = Production.start(ProductionId.new(), StoryId.of(input.story_id), datetime.now(timezone.utc))
            lab_item_id = production.resolved_lab_item_id
        compositions: list[Composition] = []

        def run_stage(stage_id, label, fetch, persist, describe):
            if runtime_managed:
                return self._try_capability(fetch, persist)
            return self._run_stage(production, stage_id, label, fetch, persist, describe)

        # Each capability is its OWN call: called and persisted
        # independently. A capability that isn't available yet fails ONLY
        # itself — it never fabricates a result. Todas resuelven contra
        # lab_item_id (la identidad real de ejecución en LAB), no story_id.
        editorial_result = run_stage(
            "editorial", "Inteligencia editorial", lambda: self._editorial.analyze(lab_item_id),
            lambda r: self._intelligence.save_editorial(input.story_id, r), lambda r: r.headline or "analizado",
        )
        story_intel_result = run_stage(
            "story", "Story", lambda: self._story_intelligence.discover(lab_item_id),
            lambda r: self._intelligence.save_story_intelligence(input.story_id, r),
            lambda r: f"{len(r.concepts)} concepto(s), {len(r.hooks)} hook(s)",
        )
        narrative_result = run_stage(
            "narrative", "Narrativa", lambda: self._narrative.plan(lab_item_id),
            lambda r: self._intelligence.save_narrative(input.story_id, r), lambda r: f"{len(r.beats)} beat(s)",
        )
        audio_result = run_stage(
            "audio", "Audio", lambda: self._audio.plan(lab_item_id),
            lambda r: self._intelligence.save_audio(input.story_id, r), lambda r: f"{len(r.tracks)} pista(s)",
        )
        media_result = run_stage(
            "media", "Media", lambda: self._media.plan(lab_item_id),
            lambda r: self._intelligence.save_media_plan(input.story_id, r), lambda r: f"{len(r.scenes)} escena(s)",
        )
        sequence_result = run_stage("sequence", "Sequence", lambda: self._sequence.plan(lab_item_id), None, lambda r: r.sequence_id)
        animation_result = run_stage("animation", "Animation", lambda: self._animation.plan(lab_item_id), None, lambda r: r.animation_plan_id)
        render_result = run_stage(
            "render", "Render", lambda: self._render.result(lab_item_id), None,
            lambda r: f"{r.rendered_shot_count}/{r.shot_count} shots",
        )
        assembly_result = run_stage(
            "assembly", "Assembly", lambda: self._assembly.result(lab_item_id), None,
            lambda r: f"{r.included_duration_seconds}s/{r.declared_duration_seconds}s",
        )

        any_available = any([
            editorial_result, story_intel_result, narrative_result, audio_result,
            media_result, sequence_result, animation_result, render_result, assembly_result,
        ])
        if any_available:
            if editorial_result and editorial_result.headline:
                story.refine_headline(editorial_result.headline)
            story.mark_produced(editorial_result.what_happened if editorial_result else None)

        if story_intel_result or assembly_result:
            # Join AssemblyResult.shots (shot_id/scene_id/disposition/duration)
            # with MediaPlan.scenes (scene_id -> asset_ids) by scene_id — the
            # same join the LAB architecture (Narrative & Audio Direction
            # note) already relies on. Never fabricates a shot: only exists
            # when Assembly actually produced one.
            assets_by_scene = {s.scene_id: s.asset_ids for s in media_result.scenes} if media_result else {}
            shots = [
                CompositionShot(
                    shot_id=s.shot_id, scene_id=s.scene_id, disposition=s.disposition,
                    duration_seconds=s.duration_seconds, asset_refs=assets_by_scene.get(s.scene_id, []),
                )
                for s in assembly_result.shots
            ] if assembly_result else []
            asset_refs = [ref for shot in shots for ref in shot.asset_refs]

            content = CompositionContent(
                angle=editorial_result.angle if editorial_result else None,
                hook=story_intel_result.hooks[0].text if story_intel_result and story_intel_result.hooks else None,
                script=[ScriptLine(s.section, s.text) for s in story_intel_result.script] if story_intel_result else [],
                narrative_summary=f"{len(narrative_result.beats)} beat(s) emocionales" if narrative_result else None,
                media_summary=(
                    f"{assembly_result.included_duration_seconds}s incluidos de {assembly_result.declared_duration_seconds}s declarados"
                    if assembly_result else None
                ),
                asset_refs=asset_refs,
                final_asset_ref=assembly_result.final_asset_ref if assembly_result else None,
                shots=shots,
            )
            composition = Composition.draft(
                CompositionId.new(), StoryId.of(input.story_id), production.id,
                CompositionKind.TIKTOK, content,
            )
            compositions.append(composition)

        self._stories.save(story)

        if not runtime_managed:
            if production.errors and production.progress == 0:
                production.fail("No LAB capability produced a result for this story yet.", datetime.now(timezone.utc))
            else:
                production.complete(datetime.now(timezone.utc))
            self._productions.save(production)
        # runtime_managed: la Production la sigue poseyendo el Runtime --
        # ProduceStory no la toca ni la guarda, solo aportó la Composition.

        for c in compositions:
            self._compositions.save(c)

        return ProduceStoryResult(story=story, production=production, compositions=compositions)

    @staticmethod
    def _run_stage(production: Production, stage_id: str, label: str, fetch, persist, describe):
        try:
            result = fetch()
        except CapabilityUnavailableError as exc:
            production.record_stage(ProductionStage(stage_id, label, done=False, detail=str(exc)))
            production.errors.append(str(exc))
            return None
        if persist:
            persist(result)
        production.record_stage(ProductionStage(stage_id, label, done=True, detail=describe(result)))
        return result

    @staticmethod
    def _try_capability(fetch, persist):
        """Igual que _run_stage pero sin tocar ninguna Production -- para
        cuando el Local Runtime ya es dueño del ciclo de vida (ver
        runtime_managed en execute()). Solo persiste el resultado de
        intelligence si la capability respondió, para que la Composition
        se pueda armar; nunca escribe stages/status/errors."""
        try:
            result = fetch()
        except CapabilityUnavailableError:
            return None
        if persist:
            persist(result)
        return result
