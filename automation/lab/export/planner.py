"""
export_manifest.json -- load/save/init/validate. Un solo paquete vigente
por historia (mismo patrón que el resto de LAB -- re-exportar sobreescribe).

init_export_manifest() es puro respecto a artifacts upstream (solo lee,
nunca escribe ninguno) pero SÍ hace I/O real de lectura: calcula SHA-256 de
cada archivo real que va a formar parte del paquete (artifacts editoriales,
media_blueprint.json, asset_registry.json, narrative_direction.json,
audio_plan.json, sequence.json, animation_plan.json, render_plan.json,
assembly_plan.json, cada asset real, cada render individual, final_reel.mp4
si existe). No copia ningún archivo todavía -- eso es lab.export.packager
(`export-execute`). Reutiliza el validate_*() de cada etapa cuando esa
etapa está presente -- no reimplementa esas reglas (ver sección 3 del
diseño: "no convertir todos los artifacts internos en una segunda
arquitectura").

Para cada elemento del paquete decide `availability` (PRESENT/MISSING/
PENDING/BLOCKED) -- nunca fabrica un archivo que no existe, nunca oculta
uno que falló.
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import lab.animation.planner as animation_planner
import lab.audio.planner as audio_planner
import lab.narrative.planner as narrative_planner
import lab.render.planner as render_planner
import lab.sequence.planner as sequence_planner
from lab.animation.paths import animation_plan_path as _animation_plan_path_fn
from lab.assembly.paths import assembly_plan_path as _assembly_plan_path_fn, final_reel_path
from lab.assembly.planner import load as load_assembly_plan, validate_assembly_plan
from lab.audio.paths import audio_plan_path as _audio_plan_path_fn
from lab.core.paths import LAB_ROOT
from lab.core.workspace import WorkflowState, item_dir, load_item
from lab.editorial.artifacts import ARTIFACT_NAMES, REQUIRED_FOR_REVIEW
from lab.export.constants import EXPORT_STATUS, FORBIDDEN_FILENAME_SUBSTRINGS, FORBIDDEN_FILENAMES, SCHEMA_VERSION
from lab.export.paths import export_manifest_path
from lab.media.blueprint import load as load_blueprint
from lab.media.paths import (
    asset_registry_path as _asset_registry_path, media_blueprint_path, sequence_path as _sequence_path_fn,
    story_media_dir, visual_style_path,
)
from lab.media.registry import list_assets
from lab.narrative.paths import narrative_direction_path as _narrative_direction_path_fn
from lab.render.paths import render_plan_path as _render_plan_path_fn, rendered_video_path

# Orden de búsqueda deliberado: los estados "flat" (sin subcarpeta propia
# -- APPROVED/REJECTED/INGESTED) son siempre autoritativos cuando existen,
# porque lab.core.workspace.transition() borra el archivo flat viejo al
# salir de un estado flat. Los estados con subcarpeta (PROCESSING/
# READY_FOR_REVIEW) en cambio NO se borran al salir -- quedan como
# "archivo histórico" (ver transition(), docstring) -- así que se
# consultan último, solo si ningún estado flat reclamó el item.
_ALL_WORKFLOW_STATES = (
    WorkflowState.APPROVED, WorkflowState.REJECTED, WorkflowState.INGESTED,
    WorkflowState.READY_FOR_REVIEW, WorkflowState.PROCESSING,
)


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _relpath(path: Path) -> str:
    return str(path.relative_to(LAB_ROOT)).replace("\\", "/")


def locate_workspace_item(story_id: str):
    """Busca el WorkspaceItem en cualquier estado (INGESTED..REJECTED).
    Devuelve (item, state) o (None, None) si no existe en ningún lado."""
    for state in _ALL_WORKFLOW_STATES:
        try:
            return load_item(state, story_id), state
        except FileNotFoundError:
            continue
    return None, None


def _editorial_artifacts_dir(story_id: str) -> Optional[Path]:
    """La subcarpeta con los artifacts editoriales -- solo PROCESSING/
    READY_FOR_REVIEW tienen subcarpeta propia; si el item ya avanzó a
    APPROVED, la subcarpeta histórica sigue viva en READY_FOR_REVIEW (ver
    lab.core.workspace.transition, "se conserva como archivo histórico")."""
    for state in (WorkflowState.READY_FOR_REVIEW, WorkflowState.PROCESSING):
        d = item_dir(state, story_id)
        if d.exists():
            return d
    return None


def _file_entry(path: Optional[Path], package_relative_path: str) -> dict[str, Any]:
    if path is None or not path.exists():
        return {
            "availability": "MISSING", "source_relative_path": None,
            "package_relative_path": None, "checksum_sha256": None, "size_bytes": None,
        }
    return {
        "availability": "PRESENT", "source_relative_path": _relpath(path),
        "package_relative_path": package_relative_path,
        "checksum_sha256": _sha256_file(path), "size_bytes": path.stat().st_size,
    }


def _build_editorial_artifacts(story_id: str) -> dict[str, Any]:
    editorial_dir = _editorial_artifacts_dir(story_id)
    entries: dict[str, Any] = {}
    for filename in sorted(ARTIFACT_NAMES):
        key = filename.removesuffix(".json")
        path = (editorial_dir / filename) if editorial_dir else None
        entries[key] = _file_entry(path, f"artifacts/editorial/{filename}")
    return entries


def _build_stage_artifact(
    story_id: str, key: str, load_fn, id_field: str, validate_fn=None,
) -> dict[str, Any]:
    """Un artifact de una sola-fuente (media_blueprint/asset_registry/
    narrative_direction/audio_plan/sequence/animation_plan/render_plan/
    assembly_plan) -- misma forma que _build_editorial_artifacts pero
    resuelve su path via la función de paths de su propio módulo, y agrega
    `artifact_id` + `upstream_valid` (delegando al validate_*() de esa
    etapa, sin reimplementar sus reglas)."""
    data = load_fn(story_id)
    if data is None:
        entry = {
            "availability": "MISSING", "source_relative_path": None,
            "package_relative_path": None, "checksum_sha256": None, "size_bytes": None,
        }
        entry["artifact_id"] = None
        entry["upstream_valid"] = None
        return entry

    path = _artifact_source_path(story_id, key)
    entry = _file_entry(path, f"artifacts/{key}.json")
    entry["artifact_id"] = data.get(id_field) if id_field else None
    entry["upstream_valid"] = (not validate_fn(story_id)) if validate_fn else None
    return entry


def _artifact_source_path(story_id: str, key: str) -> Path:
    return {
        "media_blueprint": media_blueprint_path(story_id),
        "asset_registry": _asset_registry_path(story_id),
        "visual_style": visual_style_path(story_id),
        "narrative_direction": _narrative_direction_path_fn(story_id),
        "audio_plan": _audio_plan_path_fn(story_id),
        "sequence": _sequence_path_fn(story_id),
        "animation_plan": _animation_plan_path_fn(story_id),
        "render_plan": _render_plan_path_fn(story_id),
        "assembly_plan": _assembly_plan_path_fn(story_id),
    }[key]


def _asset_shot_map(story_id: str) -> dict[str, str]:
    """asset_id -> shot_id, resuelto desde sequence.json (fuente canónica
    de qué shot usa qué asset) -- vacío si no hay sequence.json todavía."""
    sequence = sequence_planner.load(story_id)
    if sequence is None:
        return {}
    return {s["asset_id"]: s["shot_id"] for s in sequence["shots"] if s.get("asset_id")}


def _build_assets(story_id: str) -> list[dict[str, Any]]:
    asset_shot_map = _asset_shot_map(story_id)
    entries = []
    for asset in list_assets(story_id):
        real_path = story_media_dir(story_id) / asset["relative_path"]
        base = _file_entry(real_path, f"assets/{asset['relative_path']}")
        # Un asset declarado en el registry pero sin archivo real es una
        # inconsistencia real (no "no existe todavía") -- BLOCKED, no MISSING.
        if base["availability"] == "MISSING":
            base["availability"] = "BLOCKED"
        entries.append({
            **base,
            "asset_id": asset["asset_id"],
            "parent_asset_id": asset.get("parent_asset_id"),
            "type": asset["type"], "subtype": asset["subtype"], "mime_type": asset["mime_type"],
            "width": asset["width"], "height": asset["height"],
            "provenance": asset["provenance"], "provider": asset.get("provider"), "model": asset.get("model"),
            "source": asset.get("source"), "references": asset.get("references", []),
            "status": asset["status"], "scene_id": asset["scene_id"],
            "shot_id": asset_shot_map.get(asset["asset_id"]),
        })
    return entries


def _build_renders(story_id: str) -> list[dict[str, Any]]:
    render_plan = render_planner.load(story_id)
    if render_plan is None:
        return []
    entries = []
    for shot in render_plan["shots"]:
        if shot.get("asset_id") is None:
            entries.append({
                "render_shot_id": shot["render_shot_id"], "shot_id": shot["shot_id"],
                "availability": "MISSING", "render_status": shot["status"],
                "source_relative_path": None, "package_relative_path": None,
                "checksum_sha256": None, "size_bytes": None,
            })
            continue
        if shot["status"] == "DONE":
            real_path = rendered_video_path(story_id, shot["render_shot_id"])
            base = _file_entry(real_path, f"videos/rendered/{shot['render_shot_id']}.mp4")
            if base["availability"] == "MISSING":
                base["availability"] = "BLOCKED"  # declarado DONE, archivo ausente -- inconsistencia real
        elif shot["status"] == "FAILED":
            base = {"availability": "BLOCKED", "source_relative_path": None, "package_relative_path": None, "checksum_sha256": None, "size_bytes": None}
        else:
            base = {"availability": "PENDING", "source_relative_path": None, "package_relative_path": None, "checksum_sha256": None, "size_bytes": None}
        entries.append({"render_shot_id": shot["render_shot_id"], "shot_id": shot["shot_id"], "render_status": shot["status"], **base})
    return entries


def _build_final_reel(story_id: str) -> dict[str, Any]:
    assembly_plan = load_assembly_plan(story_id)
    if assembly_plan is None:
        return {
            "availability": "MISSING", "assembly_status": None,
            "source_relative_path": None, "package_relative_path": None, "checksum_sha256": None, "size_bytes": None,
        }
    output = assembly_plan["output"]
    if output["status"] == "DONE":
        real_path = final_reel_path(story_id)
        base = _file_entry(real_path, "videos/final/final_reel.mp4")
        if base["availability"] == "MISSING":
            base["availability"] = "BLOCKED"  # declarado DONE, archivo ausente -- inconsistencia real
    elif output["status"] == "FAILED":
        base = {"availability": "BLOCKED", "source_relative_path": None, "package_relative_path": None, "checksum_sha256": None, "size_bytes": None}
    else:
        base = {"availability": "PENDING", "source_relative_path": None, "package_relative_path": None, "checksum_sha256": None, "size_bytes": None}
    return {"assembly_status": output["status"], **base}


def _security_scan(manifest: dict[str, Any]) -> dict[str, Any]:
    """Chequeo defensivo sobre TODOS los package_relative_path que el
    manifest va a incluir -- Export solo incluye archivos de una lista fija
    y nombrada (nunca un glob de directorio), así que esto nunca debería
    encontrar nada, pero se verifica explícitamente igual."""
    violations = []
    for package_path in _all_package_paths(manifest):
        filename = package_path.rsplit("/", 1)[-1].lower()
        if filename in FORBIDDEN_FILENAMES:
            violations.append(f"{package_path}: nombre de archivo prohibido")
            continue
        if any(sub in filename for sub in FORBIDDEN_FILENAME_SUBSTRINGS):
            violations.append(f"{package_path}: nombre de archivo sugiere un secreto")
    return {"status": "BLOCKED" if violations else "CLEAN", "violations": violations}


def _all_package_paths(manifest: dict[str, Any]) -> list[str]:
    paths = [e["package_relative_path"] for e in manifest["artifacts"].values() if e.get("package_relative_path")]
    paths += [e["package_relative_path"] for e in manifest["assets"] if e.get("package_relative_path")]
    paths += [e["package_relative_path"] for e in manifest["renders"] if e.get("package_relative_path")]
    if manifest["final_reel"].get("package_relative_path"):
        paths.append(manifest["final_reel"]["package_relative_path"])
    return paths


def load(story_id: str) -> Optional[dict[str, Any]]:
    path = export_manifest_path(story_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save(story_id: str, manifest: dict[str, Any]) -> None:
    path = export_manifest_path(story_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def init_export_manifest(story_id: str, *, export_id: Optional[str] = None, status: str = "DRAFT") -> dict[str, Any]:
    """Construye (o reemplaza) export_manifest.json leyendo el estado REAL
    actual de todos los artifacts de la historia -- nunca escribe ninguno
    de ellos, nunca copia ningún archivo (eso es export-execute)."""
    if status not in EXPORT_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(EXPORT_STATUS)})")

    item, item_state = locate_workspace_item(story_id)
    if item is None:
        raise ValueError(f"No hay ningún WorkspaceItem para {story_id!r} en ningún estado — la historia no es identificable")

    artifacts = _build_editorial_artifacts(story_id)
    artifacts["media_blueprint"] = _build_stage_artifact(story_id, "media_blueprint", load_blueprint, id_field=None)
    artifacts["asset_registry"] = {
        **_file_entry(_asset_registry_path(story_id) if _asset_registry_path(story_id).exists() else None, "artifacts/asset_registry.json"),
        "artifact_id": None, "upstream_valid": None,
    }
    artifacts["visual_style"] = {
        **_file_entry(visual_style_path(story_id) if visual_style_path(story_id).exists() else None, "artifacts/visual_style.json"),
        "artifact_id": None, "upstream_valid": None,
    }
    artifacts["narrative_direction"] = _build_stage_artifact(
        story_id, "narrative_direction", narrative_planner.load, "narrative_direction_id", narrative_planner.validate_narrative_direction,
    )
    artifacts["audio_plan"] = _build_stage_artifact(
        story_id, "audio_plan", audio_planner.load, "audio_plan_id", audio_planner.validate_audio_plan,
    )
    artifacts["sequence"] = _build_stage_artifact(
        story_id, "sequence", sequence_planner.load, "sequence_id", sequence_planner.validate_sequence,
    )
    artifacts["animation_plan"] = _build_stage_artifact(
        story_id, "animation_plan", animation_planner.load, "animation_plan_id", animation_planner.validate_animation_plan,
    )
    artifacts["render_plan"] = _build_stage_artifact(
        story_id, "render_plan", render_planner.load, "render_plan_id", render_planner.validate_render_plan,
    )
    artifacts["assembly_plan"] = _build_stage_artifact(
        story_id, "assembly_plan", load_assembly_plan, "assembly_plan_id", validate_assembly_plan,
    )

    assets = _build_assets(story_id)
    renders = _build_renders(story_id)
    final_reel = _build_final_reel(story_id)

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "export_id": export_id or f"export_{uuid4().hex[:12]}",
        "story_id": story_id,
        "status": status,
        "source": {"system": "CRONOS Architecture / LAB", "repo": "RPA_NEWS_SCRIPT"},
        "workspace_item_state": item_state.value,
        "planned_at": datetime.now(timezone.utc).isoformat(),
        "exported_at": None,
        "artifacts": artifacts,
        "assets": assets,
        "renders": renders,
        "final_reel": final_reel,
    }
    manifest["provenance"] = {
        "story_id": story_id,
        "artifacts_participated": sorted(k for k, e in artifacts.items() if e["availability"] == "PRESENT"),
        "assets_ai_generated": [a["asset_id"] for a in assets if a["provenance"] == "AI_GENERATED"],
        "assets_real": [a["asset_id"] for a in assets if a["provenance"] == "REAL_IMAGE"],
        "final_output_package_path": final_reel["package_relative_path"] if final_reel["availability"] == "PRESENT" else None,
        "export_contract_version": SCHEMA_VERSION,
    }
    manifest["security_scan"] = _security_scan(manifest)

    _save(story_id, manifest)
    return manifest


def set_status(story_id: str, status: str) -> dict[str, Any]:
    if status not in EXPORT_STATUS:
        raise ValueError(f"status inválido: {status!r} (válidos: {sorted(EXPORT_STATUS)})")
    manifest = load(story_id)
    if manifest is None:
        raise ValueError(f"No hay export_manifest.json para la historia {story_id!r}")
    manifest["status"] = status
    _save(story_id, manifest)
    return manifest


def validate_export_manifest(story_id: str) -> list[str]:
    """Devuelve una lista de errores (vacía si es válida). No lanza. Vuelve
    a chequear contra el estado REAL actual (no el de cuando se planificó,
    mismo criterio que validate_assembly_plan) -- y, si ya se ejecutó el
    export, también re-verifica el checksum de cada copia física del
    paquete contra el declarado en el manifest."""
    manifest = load(story_id)
    if manifest is None:
        return [f"No hay export_manifest.json para la historia {story_id!r}"]

    errors: list[str] = []

    if manifest.get("story_id") != story_id:
        errors.append(f"story_id del manifest ({manifest.get('story_id')!r}) no coincide con {story_id!r}")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version ({manifest.get('schema_version')!r}) no coincide con la versión actual del contrato ({SCHEMA_VERSION!r})")
    if manifest.get("status") not in EXPORT_STATUS:
        errors.append(f"status {manifest.get('status')!r} inválido (válidos: {sorted(EXPORT_STATUS)})")

    item, item_state = locate_workspace_item(story_id)
    if item is None:
        errors.append(f"la historia {story_id!r} ya no es identificable (sin WorkspaceItem en ningún estado)")
    elif item_state == WorkflowState.REJECTED:
        errors.append(f"la historia {story_id!r} está REJECTED — no es exportable")
    elif item_state == WorkflowState.INGESTED:
        errors.append(f"la historia {story_id!r} sigue en INGESTED (sin resultado editorial) — no es exportable")

    for name in REQUIRED_FOR_REVIEW:
        key = name.removesuffix(".json")
        if manifest["artifacts"].get(key, {}).get("availability") != "PRESENT":
            errors.append(f"artifact editorial obligatorio {name!r} no está PRESENT — historia sin resultado editorial mínimo")

    if manifest["artifacts"].get("media_blueprint", {}).get("availability") != "PRESENT":
        errors.append("media_blueprint.json no está PRESENT — sin Media Intelligence no hay nada más que exportar")

    for key, entry in manifest["artifacts"].items():
        if entry.get("upstream_valid") is False:
            errors.append(f"{key}: existe pero su propia validación (validate_{key}) devuelve errores — replanificar esa etapa antes de exportar")
        if entry["availability"] == "BLOCKED":
            errors.append(f"{key}: BLOCKED — archivo declarado pero ausente en disco, referencia rota")
        if entry["availability"] == "PRESENT" and entry.get("source_relative_path"):
            real_path = LAB_ROOT / entry["source_relative_path"]
            if not real_path.exists():
                errors.append(f"{key}: el manifest lo declara PRESENT pero el archivo ya no existe — replanificar con export-plan")
            elif entry.get("checksum_sha256") and _sha256_file(real_path) != entry["checksum_sha256"]:
                errors.append(f"{key}: el archivo cambió desde que se planificó el export (checksum no coincide) — replanificar con export-plan")

    def _check_present_drift(entry: dict[str, Any], label: str) -> None:
        """Mismo chequeo que arriba para artifacts (existe todavía +
        checksum coincide) pero reutilizable para assets/renders/final_reel
        -- un elemento PRESENT al planificar puede dejar de estarlo si algo
        lo borró/modificó después, y eso hay que detectarlo igual."""
        if entry["availability"] != "PRESENT" or not entry.get("source_relative_path"):
            return
        real_path = LAB_ROOT / entry["source_relative_path"]
        if not real_path.exists():
            errors.append(f"{label}: el manifest lo declara PRESENT pero el archivo ya no existe — replanificar con export-plan")
        elif entry.get("checksum_sha256") and _sha256_file(real_path) != entry["checksum_sha256"]:
            errors.append(f"{label}: el archivo cambió desde que se planificó el export (checksum no coincide) — replanificar con export-plan")

    for asset in manifest["assets"]:
        if asset["availability"] == "BLOCKED":
            errors.append(f"asset {asset['asset_id']!r}: BLOCKED — declarado en asset_registry.json pero el archivo no existe en disco")
        _check_present_drift(asset, f"asset {asset['asset_id']!r}")

    for render in manifest["renders"]:
        if render["availability"] == "BLOCKED":
            errors.append(f"render {render['render_shot_id']!r}: BLOCKED — {render['render_status']}")
        _check_present_drift(render, f"render {render['render_shot_id']!r}")

    if manifest["final_reel"]["availability"] == "BLOCKED":
        errors.append(f"final_reel: BLOCKED — assembly_status={manifest['final_reel'].get('assembly_status')!r}")
    _check_present_drift(manifest["final_reel"], "final_reel")

    security_scan = _security_scan(manifest)
    if security_scan["status"] == "BLOCKED":
        errors.append(f"security_scan: {security_scan['violations']}")

    # Si el export ya se ejecutó, re-verificar las copias físicas del
    # paquete contra los checksums declarados -- detecta corrupción o
    # alteración posterior a la exportación.
    if manifest["status"] == "EXPORTED":
        from lab.export.paths import export_dir
        pkg_root = export_dir(story_id)
        for package_path, expected_checksum in _package_checksums(manifest):
            copy_path = pkg_root / package_path
            if not copy_path.exists():
                errors.append(f"{package_path}: el manifest dice EXPORTED pero la copia ya no existe en el paquete")
            elif _sha256_file(copy_path) != expected_checksum:
                errors.append(f"{package_path}: la copia del paquete fue modificada después de exportar (checksum no coincide)")

    return errors


def _package_checksums(manifest: dict[str, Any]) -> list[tuple[str, str]]:
    pairs = []
    for entry in manifest["artifacts"].values():
        if entry.get("package_relative_path") and entry.get("checksum_sha256"):
            pairs.append((entry["package_relative_path"], entry["checksum_sha256"]))
    for entry in manifest["assets"] + manifest["renders"]:
        if entry.get("package_relative_path") and entry.get("checksum_sha256"):
            pairs.append((entry["package_relative_path"], entry["checksum_sha256"]))
    if manifest["final_reel"].get("package_relative_path") and manifest["final_reel"].get("checksum_sha256"):
        pairs.append((manifest["final_reel"]["package_relative_path"], manifest["final_reel"]["checksum_sha256"]))
    return pairs
