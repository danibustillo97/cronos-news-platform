"""
assembly_plan.json -- load/save/init/validate. Un solo documento vigente
por historia (mismo patron que render_plan.json/animation_plan.json --
replanificar sobreescribe, sin versionado todavia).

init_assembly_plan() lee render_plan.json y animation_plan.json reales
(solo lectura) -- ambos obligatorios, Assembly no puede existir sin la
cadena Sequence -> Animation -> Render ya resuelta. narrative_direction.json
y audio_plan.json se leen tambien (solo lectura) pero son OPCIONALES: son
capas nuevas, no todas las historias ya procesadas por Sequence/Animation/
Render las tienen todavia -- su ausencia no es un error, solo queda
narrative_direction_id/audio_plan_id en null.

Por cada RenderShot, classify_disposition() decide sin ambiguedad si el
shot entra al video fisico (INCLUDED, render_plan.json dice status DONE),
se excluye porque nunca tuvo un asset real (EXCLUDED_NO_ASSET, texto-only
-- nunca se inventa un tratamiento visual, mismo criterio que
lab.render.renderer) o queda bloqueado porque el render sigue pendiente o
fallo de verdad (BLOCKED_NOT_RENDERED -- nunca se oculta como una exclusion
silenciosa). resolve_transition_execution() y
lab.assembly.motion.resolve_motion_execution() documentan, para cada shot
INCLUDED, la diferencia entre lo declarado por etapas anteriores y lo que
esta primera version de Assembly aplica de verdad -- nunca en silencio.

Nada de esto ejecuta FFmpeg ni genera ningun archivo -- eso es
lab.assembly.assembler.
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

import lab.animation.planner as animation_planner
import lab.audio.planner as audio_planner
import lab.narrative.planner as narrative_planner
import lab.render.planner as render_planner
from lab.assembly.constants import ASSEMBLY_PLAN_STATUS, SHOT_DISPOSITION, TRANSITION_APPLIED_VALUES
from lab.assembly.motion import resolve_motion_execution
from lab.assembly.paths import assembly_plan_path
from lab.render.paths import rendered_video_path
from lab.sequence.constants import TRANSITION_TYPES


def load(story_id: str) -> Optional[dict[str, Any]]:
    path = assembly_plan_path(story_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save(story_id: str, plan: dict[str, Any]) -> None:
    path = assembly_plan_path(story_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")


def classify_disposition(render_shot: dict[str, Any]) -> tuple[str, str]:
    """Sin ambiguedad, en este orden: primero si hay asset, despues si ya
    se renderizo de verdad. Nunca convierte un shot bloqueado (asset real,
    render pendiente/fallido) en una exclusion silenciosa."""
    if render_shot.get("asset_id") is None:
        return "EXCLUDED_NO_ASSET", (
            "shot sin asset_id (texto-only) -- sin tratamiento visual definido por ninguna etapa anterior"
        )

    status = render_shot.get("status")
    if status == "DONE":
        return "INCLUDED", ""
    if status == "FAILED":
        return "BLOCKED_NOT_RENDERED", f"render_plan.json marca este shot como FAILED: {render_shot.get('error')!r}"
    # PENDING (o cualquier otro valor no DONE/FAILED) -- el asset existe
    # pero todavia no se corrio (o no se termino de correr) render-execute.
    return "BLOCKED_NOT_RENDERED", "render_plan.json marca este shot como PENDING -- correr render-execute primero"


def resolve_transition_execution(declared: Optional[str]) -> dict[str, Any]:
    """v1 solo ejecuta CUT -- el demuxer concat de FFmpeg corta duro entre
    clips sin filtro extra. NONE/CUT declarados ya coinciden con eso
    (downgraded=false); FADE/DISSOLVE quedan aplicados como CUT con
    downgraded=true, nunca en silencio. DISSOLVE real necesitaria xfade
    (clips solapados, no el demuxer concat) -- etapa futura, no esta."""
    downgraded = declared in ("FADE", "DISSOLVE")
    return {"declared": declared, "applied": "CUT", "downgraded": downgraded}


def build_assembly_shot(render_shot: dict[str, Any], animation_shot: Optional[dict[str, Any]]) -> dict[str, Any]:
    """Funcion pura, sin I/O -- no lee ni escribe ningun archivo. animation_shot
    puede ser None solo si render_plan.json quedó con una referencia rota
    (animation_shot_id que ya no existe en animation_plan.json); eso se
    reporta como BLOCKED_NOT_RENDERED, nunca se inventa un AnimationShot."""
    if animation_shot is None:
        disposition, reason = "BLOCKED_NOT_RENDERED", (
            f"animation_shot_id {render_shot.get('animation_shot_id')!r} no existe en animation_plan.json — referencia rota"
        )
    else:
        disposition, reason = classify_disposition(render_shot)

    render_shot_id = render_shot["render_shot_id"]
    included = disposition == "INCLUDED"

    return {
        "assembly_shot_id": f"assembly_{render_shot['shot_id']}",
        "render_shot_id": render_shot_id,
        "animation_shot_id": render_shot.get("animation_shot_id"),
        "shot_id": render_shot["shot_id"],
        "scene_id": render_shot["scene_id"],
        "order": render_shot["order"],
        "duration_seconds": render_shot["duration_seconds"],
        "disposition": disposition,
        "disposition_reason": reason,
        "source_video_path": f"videos/rendered/{render_shot_id}.mp4" if included else None,
        "motion": resolve_motion_execution(animation_shot["motion"]["type"]) if included else None,
        "transition_in": resolve_transition_execution(animation_shot.get("transition_in")) if included else None,
        "transition_out": resolve_transition_execution(animation_shot.get("transition_out")) if included else None,
    }


def init_assembly_plan(
    story_id: str, *, assembly_plan_id: str = "assembly_001", status: str = "DRAFT"
) -> dict[str, Any]:
    """Crea (o reemplaza) assembly_plan.json a partir de render_plan.json y
    animation_plan.json reales -- falla si cualquiera de los dos no existe
    (correr Fase 4.2 primero). narrative_direction.json/audio_plan.json son
    opcionales -- su ausencia no es un error, solo quedan las referencias
    en null."""
    if status not in ASSEMBLY_PLAN_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(ASSEMBLY_PLAN_STATUS)})")

    render_plan = render_planner.load(story_id)
    if render_plan is None:
        raise ValueError(f"No hay render_plan.json para la historia {story_id!r} — correr Fase 4.2 primero")

    animation_plan = animation_planner.load(story_id)
    if animation_plan is None:
        raise ValueError(f"No hay animation_plan.json para la historia {story_id!r} — correr Fase 4.2 primero")

    narrative_direction = narrative_planner.load(story_id)
    audio_plan = audio_planner.load(story_id)

    animation_shots_by_id = {s["animation_shot_id"]: s for s in animation_plan["shots"]}
    shots = [
        build_assembly_shot(rs, animation_shots_by_id.get(rs.get("animation_shot_id")))
        for rs in render_plan["shots"]
    ]

    declared_total = round(sum(s["duration_seconds"] for s in shots), 3)
    included_total = round(sum(s["duration_seconds"] for s in shots if s["disposition"] == "INCLUDED"), 3)

    plan = {
        "assembly_plan_id": assembly_plan_id,
        "render_plan_id": render_plan["render_plan_id"],
        "animation_plan_id": animation_plan["animation_plan_id"],
        "narrative_direction_id": narrative_direction["narrative_direction_id"] if narrative_direction else None,
        "audio_plan_id": audio_plan["audio_plan_id"] if audio_plan else None,
        "story_id": story_id,
        "target_aspect_ratio": render_plan["target_aspect_ratio"],
        "target_width": render_plan["target_width"],
        "target_height": render_plan["target_height"],
        "status": status,
        "shots": shots,
        "declared_total_duration_seconds": declared_total,
        "included_duration_seconds": included_total,
        "output": {"status": "PENDING", "relative_path": None, "error": None},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save(story_id, plan)
    return plan


def set_status(story_id: str, status: str) -> dict[str, Any]:
    if status not in ASSEMBLY_PLAN_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(ASSEMBLY_PLAN_STATUS)})")
    plan = load(story_id)
    if plan is None:
        raise ValueError(f"No hay assembly_plan.json para la historia {story_id!r}")
    plan["status"] = status
    _save(story_id, plan)
    return plan


def validate_assembly_plan(story_id: str) -> list[str]:
    """Devuelve una lista de errores (vacía si es válida). No lanza."""
    plan = load(story_id)
    if plan is None:
        return [f"No hay assembly_plan.json para la historia {story_id!r}"]

    render_plan = render_planner.load(story_id)
    if render_plan is None:
        return [f"assembly_plan.json existe pero no hay render_plan.json para {story_id!r} (referencia rota)"]

    animation_plan = animation_planner.load(story_id)
    if animation_plan is None:
        return [f"assembly_plan.json existe pero no hay animation_plan.json para {story_id!r} (referencia rota)"]

    errors: list[str] = []

    if plan.get("story_id") != story_id:
        errors.append(f"story_id del plan ({plan.get('story_id')!r}) no coincide con {story_id!r}")
    if plan.get("render_plan_id") != render_plan.get("render_plan_id"):
        errors.append(
            f"render_plan_id del plan ({plan.get('render_plan_id')!r}) no coincide con "
            f"render_plan.json ({render_plan.get('render_plan_id')!r})"
        )
    if plan.get("animation_plan_id") != animation_plan.get("animation_plan_id"):
        errors.append(
            f"animation_plan_id del plan ({plan.get('animation_plan_id')!r}) no coincide con "
            f"animation_plan.json ({animation_plan.get('animation_plan_id')!r})"
        )

    # narrative_direction_id/audio_plan_id: referencias OPCIONALES. Si el
    # plan declara una, debe coincidir con el artifact real actual -- si el
    # plan la dejó en null, no se exige nada (pudo no existir al planificar).
    narrative_direction_id = plan.get("narrative_direction_id")
    if narrative_direction_id is not None:
        narrative_direction = narrative_planner.load(story_id)
        if narrative_direction is None:
            errors.append(f"narrative_direction_id ({narrative_direction_id!r}) declarado pero ya no hay narrative_direction.json para {story_id!r}")
        elif narrative_direction_id != narrative_direction.get("narrative_direction_id"):
            errors.append(
                f"narrative_direction_id del plan ({narrative_direction_id!r}) no coincide con "
                f"narrative_direction.json ({narrative_direction.get('narrative_direction_id')!r})"
            )

    audio_plan_id = plan.get("audio_plan_id")
    if audio_plan_id is not None:
        audio_plan = audio_planner.load(story_id)
        if audio_plan is None:
            errors.append(f"audio_plan_id ({audio_plan_id!r}) declarado pero ya no hay audio_plan.json para {story_id!r}")
        elif audio_plan_id != audio_plan.get("audio_plan_id"):
            errors.append(
                f"audio_plan_id del plan ({audio_plan_id!r}) no coincide con "
                f"audio_plan.json ({audio_plan.get('audio_plan_id')!r})"
            )

    animation_shots_by_id = {s["animation_shot_id"]: s for s in animation_plan.get("shots", [])}
    render_shots_by_id = {s["render_shot_id"]: s for s in render_plan.get("shots", [])}
    assembly_shots = plan.get("shots", [])

    if not assembly_shots:
        errors.append("assembly_plan.json no tiene ningún shot")

    for assembly_shot in assembly_shots:
        aid = assembly_shot.get("assembly_shot_id", "<sin assembly_shot_id>")
        render_shot_id = assembly_shot.get("render_shot_id")
        render_shot = render_shots_by_id.get(render_shot_id)

        if render_shot is None:
            errors.append(f"{aid}: render_shot_id {render_shot_id!r} no existe en render_plan.json de {story_id!r}")
            continue

        # Coherencia -- no solo "existe", coincide con el RenderShot de origen.
        for field in ("shot_id", "scene_id", "order", "duration_seconds"):
            if assembly_shot.get(field) != render_shot.get(field):
                errors.append(
                    f"{aid}: {field} ({assembly_shot.get(field)!r}) no coincide con el "
                    f"RenderShot {render_shot_id!r} ({render_shot.get(field)!r})"
                )

        # La disposición se re-deriva del render_plan.json REAL (no del que
        # había cuando se planificó) -- si render_plan.json cambió desde
        # entonces (ej. render-execute corrió después), esto lo detecta.
        animation_shot = animation_shots_by_id.get(render_shot.get("animation_shot_id"))
        if animation_shot is None:
            expected_disposition, expected_reason = "BLOCKED_NOT_RENDERED", (
                f"animation_shot_id {render_shot.get('animation_shot_id')!r} no existe en animation_plan.json — referencia rota"
            )
        else:
            expected_disposition, expected_reason = classify_disposition(render_shot)

        disposition = assembly_shot.get("disposition")
        if disposition != expected_disposition:
            errors.append(
                f"{aid}: disposition ({disposition!r}) no coincide con el estado actual de render_plan.json "
                f"(esperado {expected_disposition!r}) — replanificar con assembly-plan"
            )
        if disposition not in SHOT_DISPOSITION:
            errors.append(f"{aid}: disposition {disposition!r} inválida (válidas: {sorted(SHOT_DISPOSITION)})")

        included = disposition == "INCLUDED"

        source_video_path = assembly_shot.get("source_video_path")
        if not included:
            if source_video_path is not None:
                errors.append(f"{aid}: disposition {disposition!r} no está INCLUDED, source_video_path debe ser null")
            if assembly_shot.get("motion") is not None:
                errors.append(f"{aid}: disposition {disposition!r} no está INCLUDED, motion debe ser null")
            if assembly_shot.get("transition_in") is not None or assembly_shot.get("transition_out") is not None:
                errors.append(f"{aid}: disposition {disposition!r} no está INCLUDED, transition_in/transition_out deben ser null")
        else:
            expected_path = f"videos/rendered/{render_shot_id}.mp4"
            if source_video_path != expected_path:
                errors.append(f"{aid}: source_video_path ({source_video_path!r}) debe ser {expected_path!r}")
            elif not rendered_video_path(story_id, render_shot_id).exists():
                errors.append(f"{aid}: source_video_path declara {expected_path!r} pero el archivo no existe en disco")

            motion = assembly_shot.get("motion") or {}
            if animation_shot is not None and motion.get("declared_type") != animation_shot["motion"]["type"]:
                errors.append(
                    f"{aid}: motion.declared_type ({motion.get('declared_type')!r}) no coincide con "
                    f"AnimationShot {render_shot.get('animation_shot_id')!r} ({animation_shot['motion']['type']!r})"
                )
            if motion.get("applied") not in ("STATIC",):
                errors.append(f"{aid}: motion.applied {motion.get('applied')!r} inválido (válido en esta etapa: 'STATIC')")

            for field in ("transition_in", "transition_out"):
                declared_source = animation_shot.get(field) if animation_shot is not None else None
                transition = assembly_shot.get(field) or {}
                if transition.get("declared") != declared_source:
                    errors.append(
                        f"{aid}: {field}.declared ({transition.get('declared')!r}) no coincide con "
                        f"AnimationShot {render_shot.get('animation_shot_id')!r} ({declared_source!r})"
                    )
                if transition.get("applied") not in TRANSITION_APPLIED_VALUES:
                    errors.append(f"{aid}: {field}.applied {transition.get('applied')!r} inválido (válidos: {sorted(TRANSITION_APPLIED_VALUES)})")
                expected_downgraded = transition.get("declared") in ("FADE", "DISSOLVE")
                if transition.get("downgraded") != expected_downgraded:
                    errors.append(f"{aid}: {field}.downgraded ({transition.get('downgraded')!r}) debería ser {expected_downgraded!r}")
                if transition.get("declared") is not None and transition.get("declared") not in TRANSITION_TYPES:
                    errors.append(f"{aid}: {field}.declared {transition.get('declared')!r} inválido (válidos: {sorted(TRANSITION_TYPES)})")

    # Orden idéntico al de render_plan.json.
    plan_order = [s.get("order") for s in assembly_shots]
    render_order = [s.get("order") for s in render_plan.get("shots", [])]
    if plan_order != render_order:
        errors.append(
            f"El orden de los shots del assembly_plan ({plan_order}) no coincide "
            f"exactamente con el de render_plan.json ({render_order})"
        )

    output = plan.get("output") or {}
    if output.get("status") not in ("PENDING", "DONE", "FAILED"):
        errors.append(f"output.status {output.get('status')!r} inválido (válidos: PENDING/DONE/FAILED)")

    return errors
