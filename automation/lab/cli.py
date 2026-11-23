"""
CLI de LAB — el "mecanismo de ejecución local" de Fase 1.

Uso (desde la raíz del repo):
    lab/.venv/Scripts/python.exe -m lab.cli run-scraper
    lab/.venv/Scripts/python.exe -m lab.cli status

Este es literalmente lo que corre el comando de Claude Code
`.claude/commands/lab-run-scraper.md` — ver docs/LAB_CLAUDE_CODE_INTEGRATION.md
para el mecanismo completo (Fase 1 = interactivo: un humano o Claude Code
en sesión invocan esto a demanda; no hay watcher/cola automática todavía,
pero el sistema de jobs de abajo ya está listo para que uno se conecte
sin rediseñar nada).
"""

import argparse
import json
import sys
from pathlib import Path

# Permite `python lab/cli.py ...` además de `python -m lab.cli ...`
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from lab.core.job import create_and_run, record_job  # noqa: E402
from lab.core.logging_setup import get_logger  # noqa: E402
from lab.core.paths import ensure_runtime_dirs  # noqa: E402
from lab.core.workspace import WorkflowState, item_dir, list_items, load_item  # noqa: E402
from lab.editorial.artifacts import list_artifacts  # noqa: E402
from lab.editorial.pipeline import (  # noqa: E402
    mark_stage_done, move_to_review, start_processing,
)
from lab.media import generation as media_generation  # noqa: E402
from lab.media import registry as media_registry  # noqa: E402
from lab.media.blueprint import init_blueprint, load as load_blueprint  # noqa: E402
from lab.media.constants import EXECUTABLE_MEDIA_TYPES, MEDIA_PROVIDERS, MEDIA_TYPES  # noqa: E402
from lab.media.paths import (  # noqa: E402
    character_profiles_dir, ensure_story_media_dirs, generation_requests_path,
    media_plan_path, story_media_dir, visual_style_path,
)
from lab.media.standalone import generate_standalone_image  # noqa: E402
from lab.animation import planner as animation_planner  # noqa: E402
from lab.assembly import planner as assembly_planner  # noqa: E402
from lab.audio import planner as audio_planner  # noqa: E402
from lab.export import planner as export_planner  # noqa: E402
from lab.narrative import planner as narrative_planner  # noqa: E402
from lab.render import planner as render_planner  # noqa: E402
from lab.sequence import planner as sequence_planner  # noqa: E402
import lab.ingestion.run  # noqa: E402,F401  (registra el job "run_scraper")
import lab.media.generation  # noqa: E402,F401  (registra los job types media_generation/media_edit/media_retry)
import lab.render.renderer  # noqa: E402,F401  (registra el job type render_execute)
import lab.assembly.assembler  # noqa: E402,F401  (registra el job type assembly_execute)
import lab.export.packager  # noqa: E402,F401  (registra el job type export_execute)

logger = get_logger(__name__)


def cmd_run_scraper(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    params = {}
    if args.max_sources is not None:
        params["max_sources"] = args.max_sources
    if args.max_items is not None:
        params["max_items"] = args.max_items
    if args.job_id is not None:
        params["job_id"] = args.job_id

    job = create_and_run("run_scraper", params)

    print(json.dumps(job.to_dict(), ensure_ascii=False, indent=2))
    return 0 if job.status.value == "done" else 1


def cmd_discovery_request_stop(args: argparse.Namespace) -> int:
    """Writes the real stop signal run_ingestion's loop checks between
    sources -- never kills the run-scraper process itself."""
    from lab.ingestion import stop_signal

    stop_signal.request_stop(args.job_id)
    print(json.dumps({"job_id": args.job_id, "stop_requested": True}, ensure_ascii=False))
    return 0


def cmd_ingest_item(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    job = create_and_run("ingest_known_item", {
        "title": args.title,
        "source_url": args.source_url,
        "content": args.content,
        "image_url": args.image_url,
        "source": args.source,
    })
    print(json.dumps(job.to_dict(), ensure_ascii=False, indent=2))
    return 0 if job.status.value == "done" else 1


def cmd_status(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    counts = {state.value: len(list_items(state)) for state in WorkflowState if state != WorkflowState.EXPORTED}
    print(json.dumps({"workspace": counts}, ensure_ascii=False, indent=2))
    return 0


def cmd_editorial_start(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    try:
        item = start_processing(args.item_id, note=args.note or "")
    except FileNotFoundError:
        print(json.dumps({"error": f"item {args.item_id} no encontrado en INGESTED"}, ensure_ascii=False))
        return 1
    print(json.dumps({
        "item": item.to_dict(),
        "item_dir": str(item_dir(WorkflowState.PROCESSING, item.id)),
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_editorial_stage_done(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    try:
        item = load_item(WorkflowState.PROCESSING, args.item_id)
        item = mark_stage_done(item, args.stage, note=args.note or "")
    except FileNotFoundError:
        print(json.dumps({"error": f"item {args.item_id} no encontrado en PROCESSING"}, ensure_ascii=False))
        return 1
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps({"item": item.to_dict()}, ensure_ascii=False, indent=2))
    return 0


def cmd_editorial_review(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    try:
        item = load_item(WorkflowState.PROCESSING, args.item_id)
        item = move_to_review(item, note=args.note or "")
    except FileNotFoundError:
        print(json.dumps({"error": f"item {args.item_id} no encontrado en PROCESSING"}, ensure_ascii=False))
        return 1
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps({
        "item": item.to_dict(),
        "item_dir": str(item_dir(WorkflowState.READY_FOR_REVIEW, item.id)),
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_editorial_show(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    for state in (WorkflowState.PROCESSING, WorkflowState.READY_FOR_REVIEW):
        try:
            item = load_item(state, args.item_id)
        except FileNotFoundError:
            continue
        print(json.dumps({
            "item": item.to_dict(),
            "artifacts": list_artifacts(item.id, state),
        }, ensure_ascii=False, indent=2))
        return 0
    print(json.dumps({"error": f"item {args.item_id} no encontrado en PROCESSING ni READY_FOR_REVIEW"}, ensure_ascii=False))
    return 1


def cmd_media_init(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    scene_plan_path = item_dir(WorkflowState.READY_FOR_REVIEW, args.story_id) / "scene_plan.json"
    if not scene_plan_path.exists():
        print(json.dumps({
            "error": f"No hay scene_plan.json para {args.story_id!r} en READY_FOR_REVIEW — "
                     "Fase 2 debe estar completa (con narrative_recommended) antes de planear media."
        }, ensure_ascii=False))
        return 1
    media_dir = ensure_story_media_dirs(args.story_id)
    print(json.dumps({
        "story_id": args.story_id,
        "media_dir": str(media_dir),
        "scene_plan_path": str(scene_plan_path),
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_media_record_plan(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id

    for label, path in (
        ("media_plan.json", media_plan_path(story_id)),
        ("generation_requests.json", generation_requests_path(story_id)),
        ("visual_style.json", visual_style_path(story_id)),
    ):
        if not path.exists():
            print(json.dumps({"error": f"Falta {label} para {story_id!r} — correr la skill lab-media-planning primero"}, ensure_ascii=False))
            return 1

    media_plan = json.loads(media_plan_path(story_id).read_text(encoding="utf-8"))
    visual_style = json.loads(visual_style_path(story_id).read_text(encoding="utf-8"))
    requests_data = json.loads(generation_requests_path(story_id).read_text(encoding="utf-8"))

    for entry in media_plan:
        if entry.get("media_type") not in MEDIA_TYPES:
            print(json.dumps({"error": f"media_type inválido en media_plan.json: {entry.get('media_type')!r} (escena {entry.get('scene_id')!r})"}, ensure_ascii=False))
            return 1

    characters = sorted(p.stem for p in character_profiles_dir(story_id).glob("*.json"))

    blueprint = init_blueprint(
        story_id,
        visual_identity={"style_id": visual_style.get("style_id")},
        characters=characters,
        references=[],
        scenes=[{"scene_id": e["scene_id"], "media_requirement": e} for e in media_plan],
    )

    counts: dict[str, int] = {}
    for entry in media_plan:
        counts[entry["media_type"]] = counts.get(entry["media_type"], 0) + 1
    generation_required = sum(1 for e in media_plan if e.get("generation_required"))
    generation_supported = sum(1 for e in media_plan if e["media_type"] in EXECUTABLE_MEDIA_TYPES)
    needs_future_provider = generation_required - generation_supported

    job = record_job(
        "media_plan",
        params={"story_id": story_id},
        result={"scenes": len(media_plan), "by_media_type": counts, "generation_required": generation_required},
    )

    print(json.dumps({
        "story_id": story_id,
        "job_id": job.id,
        "total_scenes": len(media_plan),
        "by_media_type": counts,
        "generation_required": generation_required,
        "generation_supported_now": generation_supported,
        "needs_future_provider": max(needs_future_provider, 0),
        "pending_requests": sum(1 for r in requests_data.get("requests", []) if r["status"] == "PENDING"),
        "media_blueprint_status": blueprint["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_media_generate(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    try:
        if args.retry:
            result = media_generation.retry_failed(args.story_id, args.retry, provider_name=args.provider)
            results = [result]
        else:
            results = media_generation.process_requests(args.story_id, request_id=args.request_id, provider_name=args.provider)
    except FileNotFoundError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1

    ok = sum(1 for r in results if r["status"] == "done")
    failed = sum(1 for r in results if r["status"] == "failed")
    print(json.dumps({"processed": len(results), "done": ok, "failed": failed, "results": results}, ensure_ascii=False, indent=2))
    return 0 if failed == 0 else 1


def cmd_media_generate_standalone(args: argparse.Namespace) -> int:
    """Una imagen real fuera del pipeline de escenas de video -- para el
    Artifact/Publish de NEXUS backend (portada de un artículo), no para
    Composition. Ver lab/media/standalone.py."""
    try:
        result = generate_standalone_image(
            args.story_id, args.placeholder_id, args.prompt,
            aspect_ratio=args.aspect_ratio, provider_name=args.provider,
        )
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    except Exception as exc:  # noqa: BLE001 -- el proveedor real puede fallar de muchas formas (401/429/timeout)
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1

    print(json.dumps({
        "story_id": args.story_id, "placeholder_id": args.placeholder_id,
        "relative_path": result.relative_path, "mime_type": result.mime_type,
        "width": result.width, "height": result.height,
        "provider": result.provider, "model": result.model,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_media_status(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    if not story_media_dir(story_id).exists():
        print(json.dumps({"error": f"No hay media plan/blueprint para {story_id!r} — correr /lab-media-plan primero"}, ensure_ascii=False))
        return 1

    assets = media_registry.list_assets(story_id)
    blueprint = load_blueprint(story_id)
    requests_data = (
        json.loads(generation_requests_path(story_id).read_text(encoding="utf-8"))
        if generation_requests_path(story_id).exists() else {"requests": []}
    )
    req_by_status: dict[str, int] = {}
    for r in requests_data.get("requests", []):
        req_by_status[r["status"]] = req_by_status.get(r["status"], 0) + 1
    assets_by_status: dict[str, int] = {}
    for a in assets:
        assets_by_status[a["status"]] = assets_by_status.get(a["status"], 0) + 1

    print(json.dumps({
        "story_id": story_id,
        "blueprint_status": blueprint["status"] if blueprint else None,
        "requests_by_status": req_by_status,
        "assets_total": len(assets),
        "assets_by_status": assets_by_status,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_narrative_record(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = narrative_planner.validate_narrative_direction(story_id)
    if errors:
        print(json.dumps({"error": "narrative_direction.json inválido", "details": errors}, ensure_ascii=False, indent=2))
        return 1

    narrative_direction = narrative_planner.load(story_id)
    beats = narrative_direction["beats"]
    scenes_covered = sum(len(b.get("scene_ids") or []) for b in beats)
    emotions_used = sorted({b["emotion"] for b in beats})

    job = record_job(
        "narrative_direction",
        params={"story_id": story_id},
        result={
            "beats": len(beats),
            "scenes_covered": scenes_covered,
            "emotions_used": emotions_used,
        },
    )

    print(json.dumps({
        "story_id": story_id,
        "job_id": job.id,
        "narrative_direction_id": narrative_direction["narrative_direction_id"],
        "total_beats": len(beats),
        "scenes_covered": scenes_covered,
        "emotions_used": emotions_used,
        "status": narrative_direction["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_narrative_review(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = narrative_planner.validate_narrative_direction(story_id)
    if errors:
        print(json.dumps({"error": "narrative_direction.json inválido, no puede pasar a READY_FOR_REVIEW", "details": errors}, ensure_ascii=False, indent=2))
        return 1
    narrative_direction = narrative_planner.set_status(story_id, "READY_FOR_REVIEW")
    print(json.dumps({
        "story_id": story_id,
        "narrative_direction_id": narrative_direction["narrative_direction_id"],
        "status": narrative_direction["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_narrative_status(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    narrative_direction = narrative_planner.load(story_id)
    if narrative_direction is None:
        print(json.dumps({"error": f"No hay narrative_direction.json para {story_id!r} — correr /lab-narrative-direction primero"}, ensure_ascii=False))
        return 1

    beats = narrative_direction["beats"]
    scenes_covered = sum(len(b.get("scene_ids") or []) for b in beats)
    emotions_used = sorted({b["emotion"] for b in beats})

    print(json.dumps({
        "story_id": story_id,
        "narrative_direction_id": narrative_direction["narrative_direction_id"],
        "status": narrative_direction["status"],
        "total_beats": len(beats),
        "scenes_covered": scenes_covered,
        "emotions_used": emotions_used,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_audio_record(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = audio_planner.validate_audio_plan(story_id)
    if errors:
        print(json.dumps({"error": "audio_plan.json inválido", "details": errors}, ensure_ascii=False, indent=2))
        return 1

    audio_plan = audio_planner.load(story_id)
    tracks = audio_plan["tracks"]
    tracks_by_role = {}
    for t in tracks:
        tracks_by_role[t["role"]] = tracks_by_role.get(t["role"], 0) + 1

    job = record_job(
        "audio_direction",
        params={"story_id": story_id},
        result={
            "tracks": len(tracks),
            "tracks_by_role": tracks_by_role,
            "silence_windows": len(audio_plan["silence_windows"]),
        },
    )

    print(json.dumps({
        "story_id": story_id,
        "job_id": job.id,
        "audio_plan_id": audio_plan["audio_plan_id"],
        "narrative_direction_id": audio_plan["narrative_direction_id"],
        "total_tracks": len(tracks),
        "tracks_by_role": tracks_by_role,
        "silence_windows": len(audio_plan["silence_windows"]),
        "status": audio_plan["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_audio_review(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = audio_planner.validate_audio_plan(story_id)
    if errors:
        print(json.dumps({"error": "audio_plan.json inválido, no puede pasar a READY_FOR_REVIEW", "details": errors}, ensure_ascii=False, indent=2))
        return 1
    audio_plan = audio_planner.set_status(story_id, "READY_FOR_REVIEW")
    print(json.dumps({
        "story_id": story_id,
        "audio_plan_id": audio_plan["audio_plan_id"],
        "status": audio_plan["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_audio_status(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    audio_plan = audio_planner.load(story_id)
    if audio_plan is None:
        print(json.dumps({"error": f"No hay audio_plan.json para {story_id!r} — correr /lab-audio-direction primero"}, ensure_ascii=False))
        return 1

    tracks = audio_plan["tracks"]
    tracks_by_role = {}
    for t in tracks:
        tracks_by_role[t["role"]] = tracks_by_role.get(t["role"], 0) + 1

    print(json.dumps({
        "story_id": story_id,
        "audio_plan_id": audio_plan["audio_plan_id"],
        "narrative_direction_id": audio_plan["narrative_direction_id"],
        "status": audio_plan["status"],
        "total_tracks": len(tracks),
        "tracks_by_role": tracks_by_role,
        "silence_windows": len(audio_plan["silence_windows"]),
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_sequence_record(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = sequence_planner.validate_sequence(story_id)
    if errors:
        print(json.dumps({"error": "sequence.json inválido", "details": errors}, ensure_ascii=False, indent=2))
        return 1

    sequence = sequence_planner.load(story_id)
    shots = sequence["shots"]
    transform_required_count = sum(1 for s in shots if s.get("transform_required") is True)
    with_asset = sum(1 for s in shots if s.get("asset_id") is not None)

    job = record_job(
        "sequence_plan",
        params={"story_id": story_id},
        result={
            "shots": len(shots),
            "with_asset": with_asset,
            "text_only": len(shots) - with_asset,
            "transform_required": transform_required_count,
            "total_duration_seconds": sequence["total_duration_seconds"],
        },
    )

    print(json.dumps({
        "story_id": story_id,
        "job_id": job.id,
        "sequence_id": sequence["sequence_id"],
        "total_shots": len(shots),
        "shots_with_asset": with_asset,
        "shots_text_only": len(shots) - with_asset,
        "shots_needing_transform": transform_required_count,
        "total_duration_seconds": sequence["total_duration_seconds"],
        "status": sequence["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_sequence_review(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = sequence_planner.validate_sequence(story_id)
    if errors:
        print(json.dumps({"error": "sequence.json inválido, no puede pasar a READY_FOR_REVIEW", "details": errors}, ensure_ascii=False, indent=2))
        return 1
    sequence = sequence_planner.set_status(story_id, "READY_FOR_REVIEW")
    print(json.dumps({"story_id": story_id, "sequence_id": sequence["sequence_id"], "status": sequence["status"]}, ensure_ascii=False, indent=2))
    return 0


def cmd_sequence_status(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    sequence = sequence_planner.load(story_id)
    if sequence is None:
        print(json.dumps({"error": f"No hay sequence.json para {story_id!r} — correr /lab-sequence-plan primero"}, ensure_ascii=False))
        return 1

    shots = sequence["shots"]
    with_asset = sum(1 for s in shots if s.get("asset_id") is not None)
    transform_required_count = sum(1 for s in shots if s.get("transform_required") is True)

    print(json.dumps({
        "story_id": story_id,
        "sequence_id": sequence["sequence_id"],
        "status": sequence["status"],
        "target_format": sequence["target_format"],
        "target_aspect_ratio": sequence["target_aspect_ratio"],
        "total_shots": len(shots),
        "shots_with_asset": with_asset,
        "shots_text_only": len(shots) - with_asset,
        "shots_needing_transform": transform_required_count,
        "total_duration_seconds": sequence["total_duration_seconds"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_animation_plan(args: argparse.Namespace) -> int:
    """Fase 4.2 etapa 2 -- wrapper fino sobre lab.animation.planner (etapa 1,
    sin cambios): genera/actualiza animation_plan.json desde el sequence.json
    real, valida, registra el job y muestra el resumen. No decide nada por
    su cuenta -- toda la lógica vive en lab/animation/, esto solo la invoca."""
    ensure_runtime_dirs()
    story_id = args.story_id

    try:
        plan = animation_planner.init_animation_plan(story_id)
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1

    errors = animation_planner.validate_animation_plan(story_id)

    shots_summary = [
        {
            "shot_id": s["shot_id"],
            "asset_id": s["asset_id"],
            "strategy": s["strategy"],
            "backend": s["backend"],
            "motion": s["motion"]["type"],
            "source_transform": s["source_transform"],
        }
        for s in plan["shots"]
    ]

    job = record_job(
        "animation_plan",
        params={"story_id": story_id},
        result={
            "shots": len(plan["shots"]),
            "total_duration_seconds": plan["total_duration_seconds"],
            "valid": not errors,
        },
        error="; ".join(errors) if errors else None,
    )

    print(json.dumps({
        "story_id": story_id,
        "sequence_id": plan["sequence_id"],
        "animation_plan_id": plan["animation_plan_id"],
        "job_id": job.id,
        "status": plan["status"],
        "total_shots": len(plan["shots"]),
        "total_duration_seconds": plan["total_duration_seconds"],
        "shots": shots_summary,
        "validation_errors": errors,
    }, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


def cmd_render_plan(args: argparse.Namespace) -> int:
    """Fase 4.2 etapa 4 -- wrapper fino sobre lab.render.planner (etapa 3,
    sin cambios): genera/actualiza render_plan.json desde animation_plan.json
    real, valida, registra el job y muestra el resumen. No decide nada por
    su cuenta -- toda la lógica vive en lab/render/, esto solo la invoca."""
    ensure_runtime_dirs()
    story_id = args.story_id

    try:
        plan = render_planner.init_render_plan(story_id)
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1

    errors = render_planner.validate_render_plan(story_id)

    shots_summary = [
        {
            "shot_id": s["shot_id"], "asset_id": s["asset_id"],
            "backend": s["backend"],
            "transform_geometry": s["transform_geometry"],
            "status": s["status"],
        }
        for s in plan["shots"]
    ]

    job = record_job(
        "render_plan",
        params={"story_id": story_id},
        result={
            "shots": len(plan["shots"]),
            "target_width": plan["target_width"],
            "target_height": plan["target_height"],
            "valid": not errors,
        },
        error="; ".join(errors) if errors else None,
    )

    print(json.dumps({
        "story_id": story_id,
        "animation_plan_id": plan["animation_plan_id"],
        "render_plan_id": plan["render_plan_id"],
        "job_id": job.id,
        "status": plan["status"],
        "target_aspect_ratio": plan["target_aspect_ratio"],
        "target_width": plan["target_width"],
        "target_height": plan["target_height"],
        "total_shots": len(plan["shots"]),
        "shots": shots_summary,
        "validation_errors": errors,
    }, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


def cmd_render_execute(args: argparse.Namespace) -> int:
    """Fase 4.2 etapa 5 -- wrapper fino sobre lab.render.renderer: ejecuta
    FFmpeg de verdad sobre los shots elegibles de render_plan.json (o uno
    solo con --shot-id) como un job real (create_and_run, mismo mecanismo
    que media_generation), reescribe render_plan.json con el resultado real
    de cada shot. No reimplementa nada -- toda la lógica vive en
    lab.render.renderer, esto solo la invoca una vez y reporta el job."""
    ensure_runtime_dirs()
    story_id = args.story_id

    job = create_and_run("render_execute", {"story_id": story_id, "render_shot_id": args.shot_id})

    if job.result is None:
        # El handler lanzó antes de devolver un resultado (ej. no hay
        # render_plan.json todavía) -- job.py ya lo registró como failed.
        print(json.dumps({"error": job.error}, ensure_ascii=False))
        return 1

    result = job.result
    print(json.dumps({
        "story_id": story_id,
        "job_id": job.id,
        "processed": len(result["results"]),
        "done": result["done"],
        "failed": result["failed"],
        "pending": result["pending"],
        "results": result["results"],
    }, ensure_ascii=False, indent=2))
    return 0 if result["failed"] == 0 else 1


def cmd_assembly_plan(args: argparse.Namespace) -> int:
    """Última etapa de Fase 4.2 -- wrapper fino sobre lab.assembly.planner:
    genera/actualiza assembly_plan.json desde render_plan.json/
    animation_plan.json reales (y narrative_direction.json/audio_plan.json
    si existen), valida, registra el job y muestra el resumen. No decide
    nada por su cuenta -- toda la lógica vive en lab/assembly/, esto solo
    la invoca."""
    ensure_runtime_dirs()
    story_id = args.story_id

    try:
        plan = assembly_planner.init_assembly_plan(story_id)
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1

    errors = assembly_planner.validate_assembly_plan(story_id)

    shots_summary = [
        {
            "shot_id": s["shot_id"],
            "disposition": s["disposition"],
            "disposition_reason": s["disposition_reason"],
            "order": s["order"],
            "duration_seconds": s["duration_seconds"],
        }
        for s in plan["shots"]
    ]
    by_disposition = {}
    for s in plan["shots"]:
        by_disposition[s["disposition"]] = by_disposition.get(s["disposition"], 0) + 1

    job = record_job(
        "assembly_plan",
        params={"story_id": story_id},
        result={
            "shots": len(plan["shots"]),
            "by_disposition": by_disposition,
            "declared_total_duration_seconds": plan["declared_total_duration_seconds"],
            "included_duration_seconds": plan["included_duration_seconds"],
            "valid": not errors,
        },
        error="; ".join(errors) if errors else None,
    )

    print(json.dumps({
        "story_id": story_id,
        "render_plan_id": plan["render_plan_id"],
        "animation_plan_id": plan["animation_plan_id"],
        "narrative_direction_id": plan["narrative_direction_id"],
        "audio_plan_id": plan["audio_plan_id"],
        "assembly_plan_id": plan["assembly_plan_id"],
        "job_id": job.id,
        "status": plan["status"],
        "total_shots": len(plan["shots"]),
        "by_disposition": by_disposition,
        "declared_total_duration_seconds": plan["declared_total_duration_seconds"],
        "included_duration_seconds": plan["included_duration_seconds"],
        "shots": shots_summary,
        "validation_errors": errors,
    }, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


def cmd_assembly_review(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = assembly_planner.validate_assembly_plan(story_id)
    if errors:
        print(json.dumps({"error": "assembly_plan.json inválido, no puede pasar a READY_FOR_REVIEW", "details": errors}, ensure_ascii=False, indent=2))
        return 1
    plan = assembly_planner.set_status(story_id, "READY_FOR_REVIEW")
    print(json.dumps({
        "story_id": story_id,
        "assembly_plan_id": plan["assembly_plan_id"],
        "status": plan["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_assembly_status(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    plan = assembly_planner.load(story_id)
    if plan is None:
        print(json.dumps({"error": f"No hay assembly_plan.json para {story_id!r} — correr /lab-assembly primero"}, ensure_ascii=False))
        return 1

    by_disposition = {}
    for s in plan["shots"]:
        by_disposition[s["disposition"]] = by_disposition.get(s["disposition"], 0) + 1

    print(json.dumps({
        "story_id": story_id,
        "assembly_plan_id": plan["assembly_plan_id"],
        "status": plan["status"],
        "total_shots": len(plan["shots"]),
        "by_disposition": by_disposition,
        "declared_total_duration_seconds": plan["declared_total_duration_seconds"],
        "included_duration_seconds": plan["included_duration_seconds"],
        "output": plan["output"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_assembly_execute(args: argparse.Namespace) -> int:
    """Ejecuta FFmpeg real: concatena los shots INCLUDED de assembly_plan.json
    en videos/final/final_reel.mp4, como un job real (create_and_run, mismo
    mecanismo que render_execute/media_generation), reescribe
    assembly_plan.json con el resultado real. No reimplementa nada -- toda
    la lógica vive en lab.assembly.assembler, esto solo la invoca una vez y
    reporta el job."""
    ensure_runtime_dirs()
    story_id = args.story_id

    job = create_and_run("assembly_execute", {"story_id": story_id})

    if job.result is None:
        print(json.dumps({"error": job.error}, ensure_ascii=False))
        return 1

    result = job.result
    print(json.dumps({
        "story_id": story_id,
        "job_id": job.id,
        "status": result["status"],
        "relative_path": result.get("relative_path"),
        "error": result.get("error"),
        "probe": result.get("probe"),
        "shots_included": result.get("shots_included"),
    }, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "DONE" else 1


def cmd_export_plan(args: argparse.Namespace) -> int:
    """Fase 5 -- wrapper fino sobre lab.export.planner: construye/actualiza
    export_manifest.json leyendo el estado REAL de todos los artifacts de
    la historia (editorial, media, narrative, audio, sequence, animation,
    render, assembly), valida, registra el job y muestra el resumen. No
    copia ningún archivo todavía (eso es export-execute) ni modifica
    ningún artifact upstream."""
    ensure_runtime_dirs()
    story_id = args.story_id

    try:
        manifest = export_planner.init_export_manifest(story_id)
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1

    errors = export_planner.validate_export_manifest(story_id)

    by_availability: dict[str, int] = {}
    for entry in list(manifest["artifacts"].values()) + manifest["assets"] + manifest["renders"] + [manifest["final_reel"]]:
        by_availability[entry["availability"]] = by_availability.get(entry["availability"], 0) + 1

    job = record_job(
        "export_plan",
        params={"story_id": story_id},
        result={
            "export_id": manifest["export_id"],
            "by_availability": by_availability,
            "security_scan": manifest["security_scan"]["status"],
            "valid": not errors,
        },
        error="; ".join(errors) if errors else None,
    )

    print(json.dumps({
        "story_id": story_id,
        "export_id": manifest["export_id"],
        "job_id": job.id,
        "status": manifest["status"],
        "workspace_item_state": manifest["workspace_item_state"],
        "by_availability": by_availability,
        "security_scan": manifest["security_scan"],
        "provenance": manifest["provenance"],
        "validation_errors": errors,
    }, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


def cmd_export_review(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    errors = export_planner.validate_export_manifest(story_id)
    if errors:
        print(json.dumps({"error": "export_manifest.json inválido, no puede pasar a READY_FOR_REVIEW", "details": errors}, ensure_ascii=False, indent=2))
        return 1
    manifest = export_planner.set_status(story_id, "READY_FOR_REVIEW")
    print(json.dumps({
        "story_id": story_id,
        "export_id": manifest["export_id"],
        "status": manifest["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_export_status(args: argparse.Namespace) -> int:
    ensure_runtime_dirs()
    story_id = args.story_id
    manifest = export_planner.load(story_id)
    if manifest is None:
        print(json.dumps({"error": f"No hay export_manifest.json para {story_id!r} — correr /lab-production-export primero"}, ensure_ascii=False))
        return 1

    by_availability: dict[str, int] = {}
    for entry in list(manifest["artifacts"].values()) + manifest["assets"] + manifest["renders"] + [manifest["final_reel"]]:
        by_availability[entry["availability"]] = by_availability.get(entry["availability"], 0) + 1

    print(json.dumps({
        "story_id": story_id,
        "export_id": manifest["export_id"],
        "status": manifest["status"],
        "exported_at": manifest["exported_at"],
        "workspace_item_state": manifest["workspace_item_state"],
        "by_availability": by_availability,
        "security_scan": manifest["security_scan"]["status"],
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_export_execute(args: argparse.Namespace) -> int:
    """Materializa el paquete de exportación de verdad: copia (nunca
    genera) cada archivo PRESENT de export_manifest.json a
    lab/workspace/exports/<story_id>/, como un job real (create_and_run,
    mismo mecanismo que render_execute/assembly_execute). Solo procede si
    el manifest está en READY_FOR_REVIEW -- nunca salta la revisión
    humana."""
    ensure_runtime_dirs()
    story_id = args.story_id

    job = create_and_run("export_execute", {"story_id": story_id})

    if job.result is None:
        print(json.dumps({"error": job.error}, ensure_ascii=False))
        return 1

    result = job.result
    print(json.dumps({
        "story_id": story_id,
        "job_id": job.id,
        "status": result["status"],
        "error": result.get("error"),
        "files_copied": result["files_copied"],
        "total_size_bytes": result["total_size_bytes"],
        "package_dir": result.get("package_dir"),
    }, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "EXPORTED" else 1


def main() -> int:
    parser = argparse.ArgumentParser(prog="lab", description="LAB — Local Editorial & Creative Lab")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run-scraper", help="Corre la ingestión local (job run_scraper)")
    p_run.add_argument("--max-sources", type=int, default=None, help="Limitar a las primeras N fuentes (pruebas)")
    p_run.add_argument("--max-items", type=int, default=None, help="Tope de items a guardar (default 30)")
    p_run.add_argument("--job-id", default=None, help="Id del DiscoveryJob de news/backend -- habilita el stop cooperativo")
    p_run.set_defaults(func=cmd_run_scraper)

    p_stop = sub.add_parser("discovery-request-stop", help="Pide una detención real y cooperativa de un run-scraper en curso (nunca mata el proceso)")
    p_stop.add_argument("job_id")
    p_stop.set_defaults(func=cmd_discovery_request_stop)

    p_ingest = sub.add_parser("ingest-item", help="Mete a INGESTED una noticia ya conocida (title/url/content de producción), sin scraping (job ingest_known_item)")
    p_ingest.add_argument("--title", required=True)
    p_ingest.add_argument("--source-url", required=True, dest="source_url")
    p_ingest.add_argument("--content", required=True)
    p_ingest.add_argument("--image-url", default=None, dest="image_url")
    p_ingest.add_argument("--source", default=None)
    p_ingest.set_defaults(func=cmd_ingest_item)

    p_status = sub.add_parser("status", help="Cuenta items por estado en el workspace")
    p_status.set_defaults(func=cmd_status)

    p_ed_start = sub.add_parser("editorial-start", help="INGESTED -> PROCESSING; imprime la carpeta del item")
    p_ed_start.add_argument("item_id")
    p_ed_start.add_argument("--note", default=None)
    p_ed_start.set_defaults(func=cmd_editorial_start)

    p_ed_stage = sub.add_parser("editorial-stage-done", help="Registra un cluster de skill (UNDERSTANDING/STORYCRAFT/NARRATIVE) como terminado")
    p_ed_stage.add_argument("item_id")
    p_ed_stage.add_argument("stage", choices=["UNDERSTANDING", "STORYCRAFT", "NARRATIVE"])
    p_ed_stage.add_argument("--note", default=None)
    p_ed_stage.set_defaults(func=cmd_editorial_stage_done)

    p_ed_review = sub.add_parser("editorial-review", help="PROCESSING -> READY_FOR_REVIEW (exige artifacts mínimos)")
    p_ed_review.add_argument("item_id")
    p_ed_review.add_argument("--note", default=None)
    p_ed_review.set_defaults(func=cmd_editorial_review)

    p_ed_show = sub.add_parser("editorial-show", help="Muestra el item y sus artifacts (PROCESSING o READY_FOR_REVIEW)")
    p_ed_show.add_argument("item_id")
    p_ed_show.set_defaults(func=cmd_editorial_show)

    p_media_init = sub.add_parser("media-init", help="Crea el espacio de media de una historia; imprime la carpeta")
    p_media_init.add_argument("story_id")
    p_media_init.set_defaults(func=cmd_media_init)

    p_media_plan = sub.add_parser("media-record-plan", help="Valida media_plan/generation_requests/visual_style, crea el media_blueprint, imprime el resumen de costo-control")
    p_media_plan.add_argument("story_id")
    p_media_plan.set_defaults(func=cmd_media_record_plan)

    p_media_gen = sub.add_parser("media-generate", help="Ejecuta los generation_requests PENDING (o uno solo, o un retry de uno FAILED)")
    p_media_gen.add_argument("story_id")
    p_media_gen.add_argument("--request-id", default=None, help="Procesar solo este request")
    p_media_gen.add_argument("--retry", default=None, metavar="REQUEST_ID", help="Reintentar un request FAILED")
    p_media_gen.add_argument("--provider", default=None, choices=sorted(MEDIA_PROVIDERS), help="Override puntual del provider (default: LAB_MEDIA_PROVIDER)")
    p_media_gen.set_defaults(func=cmd_media_generate)

    p_media_status = sub.add_parser("media-status", help="Muestra el estado de requests/assets de una historia")
    p_media_status.add_argument("story_id")
    p_media_status.set_defaults(func=cmd_media_status)

    p_media_standalone = sub.add_parser(
        "media-generate-standalone",
        help="Genera UNA imagen real desde un prompt de texto, fuera del pipeline de escenas -- para Artifact/Publish de NEXUS backend",
    )
    p_media_standalone.add_argument("story_id")
    p_media_standalone.add_argument("--placeholder-id", required=True)
    p_media_standalone.add_argument("--prompt", required=True)
    p_media_standalone.add_argument("--aspect-ratio", default="16:9")
    p_media_standalone.add_argument("--provider", default=None, choices=sorted(MEDIA_PROVIDERS))
    p_media_standalone.set_defaults(func=cmd_media_generate_standalone)

    p_narr_record = sub.add_parser("narrative-record", help="Valida narrative_direction.json (referencias, vocabulario, consistencia), registra el job narrative_direction, imprime el resumen")
    p_narr_record.add_argument("story_id")
    p_narr_record.set_defaults(func=cmd_narrative_record)

    p_narr_review = sub.add_parser("narrative-review", help="DRAFT -> READY_FOR_REVIEW (exige que narrative_direction.json sea válido)")
    p_narr_review.add_argument("story_id")
    p_narr_review.set_defaults(func=cmd_narrative_review)

    p_narr_status = sub.add_parser("narrative-status", help="Muestra el estado de la dirección narrativa de una historia")
    p_narr_status.add_argument("story_id")
    p_narr_status.set_defaults(func=cmd_narrative_status)

    p_audio_record = sub.add_parser("audio-record", help="Valida audio_plan.json (referencias, vocabulario, prioridades de mezcla), registra el job audio_direction, imprime el resumen")
    p_audio_record.add_argument("story_id")
    p_audio_record.set_defaults(func=cmd_audio_record)

    p_audio_review = sub.add_parser("audio-review", help="DRAFT -> READY_FOR_REVIEW (exige que audio_plan.json sea válido)")
    p_audio_review.add_argument("story_id")
    p_audio_review.set_defaults(func=cmd_audio_review)

    p_audio_status = sub.add_parser("audio-status", help="Muestra el estado de la dirección de audio de una historia")
    p_audio_status.add_argument("story_id")
    p_audio_status.set_defaults(func=cmd_audio_status)

    p_seq_record = sub.add_parser("sequence-record", help="Valida sequence.json (referencias, vocabulario, consistencia), registra el job sequence_plan, imprime el resumen")
    p_seq_record.add_argument("story_id")
    p_seq_record.set_defaults(func=cmd_sequence_record)

    p_seq_review = sub.add_parser("sequence-review", help="DRAFT -> READY_FOR_REVIEW (exige que sequence.json sea válido)")
    p_seq_review.add_argument("story_id")
    p_seq_review.set_defaults(func=cmd_sequence_review)

    p_seq_status = sub.add_parser("sequence-status", help="Muestra el estado de la secuencia de una historia")
    p_seq_status.add_argument("story_id")
    p_seq_status.set_defaults(func=cmd_sequence_status)

    p_anim_plan = sub.add_parser("animation-plan", help="Genera/actualiza animation_plan.json desde sequence.json, valida, registra el job animation_plan")
    p_anim_plan.add_argument("story_id")
    p_anim_plan.set_defaults(func=cmd_animation_plan)

    p_render_plan = sub.add_parser("render-plan", help="Genera/actualiza render_plan.json desde animation_plan.json, valida, registra el job render_plan")
    p_render_plan.add_argument("story_id")
    p_render_plan.set_defaults(func=cmd_render_plan)

    p_render_exec = sub.add_parser("render-execute", help="Ejecuta FFmpeg real sobre los shots elegibles de render_plan.json (imagen + geometría ya calculada), registra el job render_execute")
    p_render_exec.add_argument("story_id")
    p_render_exec.add_argument("--shot-id", default=None, metavar="RENDER_SHOT_ID", help="Procesar solo este render_shot_id")
    p_render_exec.set_defaults(func=cmd_render_execute)

    p_asm_plan = sub.add_parser("assembly-plan", help="Genera/actualiza assembly_plan.json desde render_plan.json/animation_plan.json (y narrative_direction.json/audio_plan.json si existen), valida, registra el job assembly_plan")
    p_asm_plan.add_argument("story_id")
    p_asm_plan.set_defaults(func=cmd_assembly_plan)

    p_asm_review = sub.add_parser("assembly-review", help="DRAFT -> READY_FOR_REVIEW (exige que assembly_plan.json sea válido)")
    p_asm_review.add_argument("story_id")
    p_asm_review.set_defaults(func=cmd_assembly_review)

    p_asm_status = sub.add_parser("assembly-status", help="Muestra el estado del ensamblaje (shots por disposición, output) de una historia")
    p_asm_status.add_argument("story_id")
    p_asm_status.set_defaults(func=cmd_assembly_status)

    p_asm_exec = sub.add_parser("assembly-execute", help="Ejecuta FFmpeg real: concatena los shots INCLUDED de assembly_plan.json en videos/final/final_reel.mp4, registra el job assembly_execute")
    p_asm_exec.add_argument("story_id")
    p_asm_exec.set_defaults(func=cmd_assembly_execute)

    p_exp_plan = sub.add_parser("export-plan", help="Genera/actualiza export_manifest.json leyendo el estado real de todos los artifacts, valida, registra el job export_plan")
    p_exp_plan.add_argument("story_id")
    p_exp_plan.set_defaults(func=cmd_export_plan)

    p_exp_review = sub.add_parser("export-review", help="DRAFT -> READY_FOR_REVIEW (exige que export_manifest.json sea válido)")
    p_exp_review.add_argument("story_id")
    p_exp_review.set_defaults(func=cmd_export_review)

    p_exp_status = sub.add_parser("export-status", help="Muestra el estado del paquete de exportación de una historia")
    p_exp_status.add_argument("story_id")
    p_exp_status.set_defaults(func=cmd_export_status)

    p_exp_exec = sub.add_parser("export-execute", help="Materializa el paquete de exportación (copia archivos reales a lab/workspace/exports/<story_id>/), registra el job export_execute")
    p_exp_exec.add_argument("story_id")
    p_exp_exec.set_defaults(func=cmd_export_execute)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
