"""
narrative_direction.json -- load/save/validate. Un solo documento vigente
por historia (mismo patron que sequence.json/animation_plan.json/
render_plan.json -- replanificar sobreescribe, sin historial de versiones
en esta primera etapa).

El arco emocional se declara por beat (no por shot -- los shots no existen
todavia en este punto del pipeline, los crea Sequence). Cada beat referencia
uno o mas scene_id de media_blueprint.json (Fase 3) -- nunca shot_id. Como
scene_id se preserva intacto en SequenceShot/AnimationShot/RenderShot, las
etapas posteriores pueden unir por scene_id sin que este modulo (ni ningun
otro) necesite tocar sus schemas.

Este modulo nunca decide un valor ejecutable -- solo intencion editorial
(emotion, pacing_intention, motion_intensity_intention, etc.). Sequence,
Animation, Render y (a futuro) Assembly siguen siendo las unicas duenas de
sus valores literales.
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

from lab.media.blueprint import load as load_blueprint
from lab.narrative.constants import (
    EMOTIONS, INTENSITY_LEVELS, MOTION_INTENSITY_INTENTIONS, MUSIC_INTENTIONS,
    NARRATIVE_DIRECTION_STATUS, NARRATIVE_FUNCTIONS, PACING_INTENTIONS,
    SILENCE_OR_EMPHASIS_VALUES, TRANSITION_INTENTIONS, VISUAL_RHYTHM_INTENTIONS,
)
from lab.narrative.paths import narrative_direction_path


def load(story_id: str) -> Optional[dict[str, Any]]:
    path = narrative_direction_path(story_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save(story_id: str, narrative_direction: dict[str, Any]) -> None:
    path = narrative_direction_path(story_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(narrative_direction, ensure_ascii=False, indent=2), encoding="utf-8")


def init_narrative_direction(
    story_id: str,
    *,
    narrative_direction_id: str = "narrative_001",
    beats: list[dict[str, Any]],
    status: str = "DRAFT",
) -> dict[str, Any]:
    """Crea (o reemplaza) narrative_direction.json. No valida criterio
    editorial (eso lo decidio la skill) -- validate_narrative_direction()
    hace la validacion estructural antes de que esto se considere aceptado
    (ver lab.cli narrative-record)."""
    if status not in NARRATIVE_DIRECTION_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(NARRATIVE_DIRECTION_STATUS)})")

    narrative_direction = {
        "narrative_direction_id": narrative_direction_id,
        "story_id": story_id,
        "status": status,
        "beats": beats,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save(story_id, narrative_direction)
    return narrative_direction


def set_status(story_id: str, status: str) -> dict[str, Any]:
    if status not in NARRATIVE_DIRECTION_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(NARRATIVE_DIRECTION_STATUS)})")
    narrative_direction = load(story_id)
    if narrative_direction is None:
        raise ValueError(f"No hay narrative_direction.json para la historia {story_id!r}")
    narrative_direction["status"] = status
    _save(story_id, narrative_direction)
    return narrative_direction


def validate_narrative_direction(story_id: str) -> list[str]:
    """Devuelve una lista de errores (vacía si es válida). No lanza --
    lab.cli narrative-record decide qué hacer con los errores."""
    narrative_direction = load(story_id)
    if narrative_direction is None:
        return [f"No hay narrative_direction.json para la historia {story_id!r}"]

    errors: list[str] = []
    blueprint = load_blueprint(story_id)
    known_scene_ids = {s["scene_id"] for s in blueprint["scenes"]} if blueprint else set()

    beats = narrative_direction.get("beats", [])
    if not beats:
        errors.append("narrative_direction.json no tiene ningún beat")

    seen_orders: list[int] = []
    seen_scene_ids: dict[str, str] = {}

    for beat in beats:
        beat_id = beat.get("beat_id", "<sin beat_id>")

        scene_ids = beat.get("scene_ids")
        if not scene_ids:
            errors.append(f"{beat_id}: scene_ids no puede estar vacío")
        else:
            for scene_id in scene_ids:
                if scene_id not in known_scene_ids:
                    errors.append(f"{beat_id}: scene_id {scene_id!r} no existe en media_blueprint.json de {story_id!r}")
                elif scene_id in seen_scene_ids:
                    errors.append(
                        f"{beat_id}: scene_id {scene_id!r} ya pertenece al beat {seen_scene_ids[scene_id]!r} "
                        f"— una escena no puede pertenecer a dos beats emocionales distintos"
                    )
                else:
                    seen_scene_ids[scene_id] = beat_id

        emotion = beat.get("emotion")
        if emotion not in EMOTIONS:
            errors.append(f"{beat_id}: emotion {emotion!r} inválida (válidas: {sorted(EMOTIONS)})")

        emotional_intensity = beat.get("emotional_intensity")
        if emotional_intensity not in INTENSITY_LEVELS:
            errors.append(f"{beat_id}: emotional_intensity {emotional_intensity!r} inválida (válidas: {sorted(INTENSITY_LEVELS)})")

        narrative_function = beat.get("narrative_function")
        if narrative_function not in NARRATIVE_FUNCTIONS:
            errors.append(f"{beat_id}: narrative_function {narrative_function!r} inválida (válidas: {sorted(NARRATIVE_FUNCTIONS)})")

        pacing_intention = beat.get("pacing_intention")
        if pacing_intention not in PACING_INTENTIONS:
            errors.append(f"{beat_id}: pacing_intention {pacing_intention!r} inválida (válidas: {sorted(PACING_INTENTIONS)})")

        visual_rhythm_intention = beat.get("visual_rhythm_intention")
        if visual_rhythm_intention not in VISUAL_RHYTHM_INTENTIONS:
            errors.append(
                f"{beat_id}: visual_rhythm_intention {visual_rhythm_intention!r} inválida "
                f"(válidas: {sorted(VISUAL_RHYTHM_INTENTIONS)})"
            )

        motion_intensity_intention = beat.get("motion_intensity_intention")
        if motion_intensity_intention not in MOTION_INTENSITY_INTENTIONS:
            errors.append(
                f"{beat_id}: motion_intensity_intention {motion_intensity_intention!r} inválida "
                f"(válidas: {sorted(MOTION_INTENSITY_INTENTIONS)})"
            )

        transition_intention = beat.get("transition_intention")
        if transition_intention not in TRANSITION_INTENTIONS:
            errors.append(f"{beat_id}: transition_intention {transition_intention!r} inválida (válidas: {sorted(TRANSITION_INTENTIONS)})")

        music_intention = beat.get("music_intention")
        if music_intention not in MUSIC_INTENTIONS:
            errors.append(f"{beat_id}: music_intention {music_intention!r} inválida (válidas: {sorted(MUSIC_INTENTIONS)})")

        silence_or_emphasis = beat.get("silence_or_emphasis")
        if silence_or_emphasis not in SILENCE_OR_EMPHASIS_VALUES:
            errors.append(
                f"{beat_id}: silence_or_emphasis {silence_or_emphasis!r} inválida "
                f"(válidas: {sorted(SILENCE_OR_EMPHASIS_VALUES)})"
            )

        narration_priority = beat.get("narration_priority")
        if not isinstance(narration_priority, bool):
            errors.append(f"{beat_id}: narration_priority debe ser booleano")

        order = beat.get("order")
        if not isinstance(order, int):
            errors.append(f"{beat_id}: order debe ser un entero")
        else:
            seen_orders.append(order)

    if seen_orders and sorted(seen_orders) != list(range(1, len(seen_orders) + 1)):
        errors.append(f"order de los beats debe ser 1..N sin huecos ni repetidos (recibido: {seen_orders})")

    return errors
