""""Convertir en contenido" — el único punto de entrada real desde News
hacia producción (sección 7 del pedido). El usuario nunca ve un story_id,
production_id ni nada de LAB: entra un news_id, sale la Production ya
disparada contra el Local Runtime real.

NEWS NO PRODUCE. LAB PRODUCE. Este caso de uso solo resuelve/crea la
Story, crea la Production, y le pide al runtime que arranque — el
pipeline real (editorial..export) lo corre automation/runtime/, no
este proceso.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import StoryId, ProductionId
from app.domain.story.entities import Story, StorySource
from app.domain.production.entities import Production
from app.domain.ports import (
    NewsRepository, StoryRepository, ProductionRepository, ExecutionRuntimePort,
)


@dataclass
class ConvertNewsToContentResult:
    story_id: str
    production_id: str
    already_existed: bool


class ConvertNewsToContent:
    def __init__(
        self, news: NewsRepository, stories: StoryRepository, productions: ProductionRepository,
        runtime: ExecutionRuntimePort,
    ) -> None:
        self._news = news
        self._stories = stories
        self._productions = productions
        self._runtime = runtime

    def execute(self, news_id: str) -> ConvertNewsToContentResult:
        # Idempotencia (sección 25 del pedido): pulsar el botón dos veces
        # no crea dos Productions — la Story ya resuelta para este news_id
        # es la señal de "ya se convirtió antes".
        existing_story = self._stories.find_by_source_news_id(news_id)
        if existing_story is not None:
            production = self._productions.find_latest_for_story(str(existing_story.id))
            if production is not None:
                return ConvertNewsToContentResult(
                    story_id=str(existing_story.id), production_id=str(production.id), already_existed=True,
                )

        news_item = self._news.find_by_id(news_id)
        if news_item is None:
            raise NotFoundError("news", news_id)

        item_id = self._runtime.ingest(
            title=news_item.headline,
            source_url=news_item.provenance.source_url or "",
            content=news_item.normalized_content or news_item.summary or news_item.headline,
            image_url=None,
            source=news_item.provenance.source_name,
        )

        story_id = StoryId.of(item_id)
        source = StorySource(news_id=news_item.id, source_url=news_item.provenance.source_url, label="news")
        story = Story.open_from_news(story_id, news_item.headline, source)
        story.begin_production()

        # lab_item_id explícito -- HOY vale lo mismo que item_id porque acá
        # es donde se mintea la Story con ese mismo id (ver StoryId.of(item_id)
        # arriba), pero se pasa aparte a propósito: es la identidad real de
        # ejecución en LAB, story_id es identidad editorial. No asumir que
        # siempre van a coincidir en el resto del código.
        production = Production.start(ProductionId.new(), story_id, datetime.now(timezone.utc), lab_item_id=item_id)

        self._stories.save(story)
        self._productions.save(production)

        self._runtime.start_production(str(production.id), str(story_id), item_id)

        return ConvertNewsToContentResult(story_id=str(story_id), production_id=str(production.id), already_existed=False)
