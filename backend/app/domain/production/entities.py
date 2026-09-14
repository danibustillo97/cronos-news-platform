"""PRODUCTION bounded context — the process of turning a Story into content.
Production is not "a button that calls LAB": it tracks which capabilities
ran, their stage status, and which Compositions/outputs resulted.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.domain.shared.ids import ProductionId, StoryId


class ProductionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass(frozen=True)
class ProductionStage:
    id: str
    label: str
    done: bool
    detail: str | None


@dataclass
class Production:
    id: ProductionId
    story_id: StoryId
    status: ProductionStatus
    stages: list[ProductionStage]
    errors: list[str]
    started_at: datetime
    completed_at: datetime | None = None
    # La identidad real del workspace item de LAB que esta Production
    # ejecuta. HOY se mintea igual a story_id (ConvertNewsToContent usa el
    # item_id que devuelve LAB como id de la Story) pero son conceptos
    # DISTINTOS a propósito -- story_id es identidad editorial/de negocio,
    # lab_item_id es la identidad de ejecución física en LAB. Nunca asumir
    # que coinciden por regla; siempre resolver LAB usando este campo.
    # None = producciones legacy creadas antes de este campo (existentes
    # como 793ff158b714) -- el repositorio hace fallback a story_id al leerlas.
    lab_item_id: str | None = None

    @staticmethod
    def start(production_id: ProductionId, story_id: StoryId, started_at: datetime, lab_item_id: str | None = None) -> "Production":
        return Production(
            id=production_id, story_id=story_id, status=ProductionStatus.RUNNING,
            stages=[], errors=[], started_at=started_at, lab_item_id=lab_item_id or str(story_id),
        )

    @property
    def resolved_lab_item_id(self) -> str:
        """Nunca None en uso real -- start() siempre lo setea; esto es
        solo para productions legacy leídas de filas viejas sin la columna."""
        return self.lab_item_id or str(self.story_id)

    @property
    def progress(self) -> float:
        if not self.stages:
            return 0.0
        return sum(1 for s in self.stages if s.done) / len(self.stages)

    def record_stage(self, stage: ProductionStage) -> None:
        if self.status in (ProductionStatus.COMPLETED, ProductionStatus.FAILED):
            raise ValueError(f"Cannot record stages on a {self.status.value} production")
        self.stages = [s for s in self.stages if s.id != stage.id] + [stage]

    def complete(self, completed_at: datetime) -> None:
        self.status = ProductionStatus.COMPLETED
        self.completed_at = completed_at

    def fail(self, reason: str, failed_at: datetime) -> None:
        self.status = ProductionStatus.FAILED
        self.errors = [*self.errors, reason]
        self.completed_at = failed_at
