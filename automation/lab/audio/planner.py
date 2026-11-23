"""
audio_plan.json -- load/save/validate. Un solo documento vigente por
historia (mismo patron que narrative_direction.json/sequence.json/
animation_plan.json/render_plan.json -- replanificar sobreescribe, sin
historial de versiones en esta primera etapa).

Lee narrative_direction.json (solo lectura, lab.narrative.planner.load) --
nunca lo escribe, nunca escribe ningun otro artifact existente. Cada track
y cada silence_window referencia un beat_id real de narrative_direction.json
-- nunca scene_id ni shot_id: Audio Direction trabaja al mismo nivel
narrativo/emocional que Narrative Direction, no a nivel de ejecucion
temporal (eso es responsabilidad de Sequence/Animation/Render/Assembly).

Este modulo nunca decide un valor ejecutable -- ni un archivo, ni un
proveedor, ni un timestamp de FFmpeg. Solo intencion: que capa de audio
hace falta en que beat, si un silencio ahi es deliberado y como se
manifestaria en el mix, y la regla fija de prioridad de mezcla.
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

from lab.audio.constants import (
    AUDIO_PLAN_STATUS, AUDIO_ROLES, DUCKING_PRIORITY_ORDER, FADE_TYPES,
    SILENCE_TREATMENTS,
)
from lab.audio.paths import audio_plan_path
from lab.narrative.planner import load as load_narrative_direction


def load(story_id: str) -> Optional[dict[str, Any]]:
    path = audio_plan_path(story_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save(story_id: str, audio_plan: dict[str, Any]) -> None:
    path = audio_plan_path(story_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(audio_plan, ensure_ascii=False, indent=2), encoding="utf-8")


def default_ducking_rules() -> dict[str, Any]:
    """La prioridad de mezcla es fija por diseño (NARRATION > SFX > MUSIC >
    AMBIENCE) -- no es una decisión por historia. init_audio_plan() la usa
    como default para que la skill no tenga que reescribirla cada vez."""
    return {"priority_order": list(DUCKING_PRIORITY_ORDER)}


def init_audio_plan(
    story_id: str,
    *,
    audio_plan_id: str = "audio_001",
    narrative_direction_id: str,
    tracks: list[dict[str, Any]],
    silence_windows: Optional[list[dict[str, Any]]] = None,
    ducking_rules: Optional[dict[str, Any]] = None,
    status: str = "DRAFT",
) -> dict[str, Any]:
    """Crea (o reemplaza) audio_plan.json. No valida criterio editorial
    (eso lo decidió la skill) -- validate_audio_plan() hace la validación
    estructural antes de que esto se considere aceptado (ver
    lab.cli audio-record)."""
    if status not in AUDIO_PLAN_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(AUDIO_PLAN_STATUS)})")

    audio_plan = {
        "audio_plan_id": audio_plan_id,
        "narrative_direction_id": narrative_direction_id,
        "story_id": story_id,
        "status": status,
        "tracks": tracks,
        "silence_windows": silence_windows or [],
        "ducking_rules": ducking_rules if ducking_rules is not None else default_ducking_rules(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save(story_id, audio_plan)
    return audio_plan


def set_status(story_id: str, status: str) -> dict[str, Any]:
    if status not in AUDIO_PLAN_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(AUDIO_PLAN_STATUS)})")
    audio_plan = load(story_id)
    if audio_plan is None:
        raise ValueError(f"No hay audio_plan.json para la historia {story_id!r}")
    audio_plan["status"] = status
    _save(story_id, audio_plan)
    return audio_plan


def validate_audio_plan(story_id: str) -> list[str]:
    """Devuelve una lista de errores (vacía si es válida). No lanza --
    lab.cli audio-record decide qué hacer con los errores."""
    audio_plan = load(story_id)
    if audio_plan is None:
        return [f"No hay audio_plan.json para la historia {story_id!r}"]

    narrative_direction = load_narrative_direction(story_id)
    if narrative_direction is None:
        return [f"audio_plan.json existe pero no hay narrative_direction.json para {story_id!r} (referencia rota)"]

    errors: list[str] = []

    if audio_plan.get("narrative_direction_id") != narrative_direction.get("narrative_direction_id"):
        errors.append(
            f"narrative_direction_id del plan ({audio_plan.get('narrative_direction_id')!r}) no coincide con "
            f"narrative_direction.json ({narrative_direction.get('narrative_direction_id')!r})"
        )

    known_beats = {b["beat_id"]: b for b in narrative_direction.get("beats", [])}

    tracks = audio_plan.get("tracks", [])
    seen_track_ids: set[str] = set()
    seen_role_beat_pairs: set[tuple[str, str]] = set()
    narration_covered_beats: set[str] = set()

    for track in tracks:
        track_id = track.get("track_id", "<sin track_id>")

        if track_id in seen_track_ids:
            errors.append(f"track_id {track_id!r} repetido")
        else:
            seen_track_ids.add(track_id)

        role = track.get("role")
        if role not in AUDIO_ROLES:
            errors.append(f"{track_id}: role {role!r} inválido (válidos: {sorted(AUDIO_ROLES)})")

        beat_id = track.get("beat_id")
        if beat_id not in known_beats:
            errors.append(f"{track_id}: beat_id {beat_id!r} no existe en narrative_direction.json de {story_id!r}")
        elif role in AUDIO_ROLES:
            pair = (role, beat_id)
            if pair in seen_role_beat_pairs:
                errors.append(f"{track_id}: ya existe un track {role!r} para beat_id {beat_id!r} — ambiguo, no puede repetirse")
            else:
                seen_role_beat_pairs.add(pair)
            if role == "NARRATION":
                narration_covered_beats.add(beat_id)

        fade_in = track.get("fade_in")
        if fade_in not in FADE_TYPES:
            errors.append(f"{track_id}: fade_in {fade_in!r} inválido (válidos: {sorted(FADE_TYPES)})")

        fade_out = track.get("fade_out")
        if fade_out not in FADE_TYPES:
            errors.append(f"{track_id}: fade_out {fade_out!r} inválido (válidos: {sorted(FADE_TYPES)})")

    silence_windows = audio_plan.get("silence_windows", [])
    seen_silence_ids: set[str] = set()
    silence_covered_beats: set[str] = set()

    for window in silence_windows:
        silence_id = window.get("silence_id", "<sin silence_id>")

        if silence_id in seen_silence_ids:
            errors.append(f"silence_id {silence_id!r} repetido")
        else:
            seen_silence_ids.add(silence_id)

        beat_id = window.get("beat_id")
        beat = known_beats.get(beat_id)
        if beat is None:
            errors.append(f"{silence_id}: beat_id {beat_id!r} no existe en narrative_direction.json de {story_id!r}")
        else:
            if beat.get("silence_or_emphasis") == "NONE":
                errors.append(
                    f"{silence_id}: beat_id {beat_id!r} tiene silence_or_emphasis='NONE' en narrative_direction.json "
                    f"— no puede tener una ventana de silencio si Narrative Direction no declaró esa intención"
                )
            else:
                silence_covered_beats.add(beat_id)

        treatment = window.get("treatment")
        if treatment not in SILENCE_TREATMENTS:
            errors.append(f"{silence_id}: treatment {treatment!r} inválido (válidos: {sorted(SILENCE_TREATMENTS)})")

    # Elementos obligatorios: un beat que Narrative Direction ya marcó como
    # SILENCE debe tener su ventana de silencio reconocida acá -- no puede
    # quedar sin dirección de audio. EMPHASIS es más débil (puede sostener
    # música/ambiente) -- no es obligatorio, solo SILENCE lo es.
    for beat_id, beat in known_beats.items():
        if beat.get("silence_or_emphasis") == "SILENCE" and beat_id not in silence_covered_beats:
            errors.append(f"beat {beat_id!r}: narrative_direction.json declara silence_or_emphasis='SILENCE' pero no hay ninguna silence_window para ese beat")
        if beat.get("narration_priority") is True and beat_id not in narration_covered_beats:
            errors.append(f"beat {beat_id!r}: narrative_direction.json declara narration_priority=true pero no hay ningún track NARRATION para ese beat")

    ducking_rules = audio_plan.get("ducking_rules")
    if not isinstance(ducking_rules, dict) or ducking_rules.get("priority_order") != list(DUCKING_PRIORITY_ORDER):
        errors.append(
            f"ducking_rules.priority_order debe ser exactamente {list(DUCKING_PRIORITY_ORDER)} "
            f"(prioridad de mezcla fija, no se re-decide por historia), recibido {ducking_rules!r}"
        )

    return errors
