from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.domain.shared.errors import NotFoundError
from app.domain.composition.entities import Composition
from app.domain.ports import CompositionRepository


@dataclass
class ReviewCompositionInput:
    composition_id: str
    decision: Literal["APPROVE", "REJECT"]
    reason: str | None = None


class ReviewComposition:
    def __init__(self, compositions: CompositionRepository) -> None:
        self._compositions = compositions

    def execute(self, input: ReviewCompositionInput) -> Composition:
        composition = self._compositions.find_by_id(input.composition_id)
        if composition is None:
            raise NotFoundError("Composition", input.composition_id)

        if input.decision == "APPROVE":
            composition.approve()
        else:
            composition.reject(input.reason or "No reason given")

        self._compositions.save(composition)
        return composition
