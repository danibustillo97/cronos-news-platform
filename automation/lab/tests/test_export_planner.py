"""
Tests de lab.export.planner -- init_export_manifest()/validate_export_manifest()
contra una historia real construida punta a punta (editorial -> media ->
narrative -> audio -> sequence -> animation -> render (FFmpeg real) ->
assembly (FFmpeg real)). No se mockea lo que se puede probar real, mismo
criterio que el resto de LAB.

Cubre: manifest (schema_version/story_id/export_id/status/metadata),
package (paths relativos, sin paths absolutos), validation (historia
inexistente, artifact inexistente, asset faltante, referencia inválida,
BLOCKED, export válido), y security (ausencia de secrets).
"""

import shutil

import pytest

from lab.animation.planner import init_animation_plan
from lab.assembly.assembler import process_assembly_plan
from lab.assembly.planner import init_assembly_plan
from lab.audio.planner import init_audio_plan
from lab.core.paths import LAB_ROOT
from lab.core.workspace import (
    WorkflowState, WorkspaceItem, item_dir, load_item, save_item,
)
from lab.editorial.artifacts import write_artifact
from lab.editorial.pipeline import mark_stage_done, move_to_review, start_processing
from lab.export.constants import AVAILABILITY, EXPORT_STATUS, SCHEMA_VERSION
from lab.export.paths import export_manifest_path
from lab.export.planner import init_export_manifest, load, set_status, validate_export_manifest
from lab.media.blueprint import init_blueprint
from lab.media.paths import story_media_dir
from lab.media.registry import register_asset
from lab.narrative.planner import init_narrative_direction
from lab.render.planner import init_render_plan
from lab.render.renderer import process_render_plan
from lab.sequence.planner import init_sequence

_TEST_STORY_ID = "_test_export_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    from lab.core.paths import APPROVED_DIR, INCOMING_DIR, REJECTED_DIR
    from lab.export.paths import export_dir

    def _clean():
        shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
        shutil.rmtree(item_dir(WorkflowState.PROCESSING, _TEST_STORY_ID), ignore_errors=True)
        shutil.rmtree(item_dir(WorkflowState.READY_FOR_REVIEW, _TEST_STORY_ID), ignore_errors=True)
        for flat_dir in (INCOMING_DIR, APPROVED_DIR, REJECTED_DIR):
            (flat_dir / f"{_TEST_STORY_ID}.json").unlink(missing_ok=True)
        shutil.rmtree(export_dir(_TEST_STORY_ID), ignore_errors=True)

    _clean()
    yield
    _clean()


def _setup_editorial_item(with_narrative_stage=False):
    item = WorkspaceItem(id=_TEST_STORY_ID, state=WorkflowState.INGESTED, title="Test story", source_url="https://example.com/test")
    save_item(item)
    item = start_processing(_TEST_STORY_ID)
    for name in ("understanding.json", "research.json", "fact_check.json"):
        write_artifact(_TEST_STORY_ID, WorkflowState.PROCESSING, name, {"stub": True})
    mark_stage_done(item, "UNDERSTANDING")
    item = load_item(WorkflowState.PROCESSING, _TEST_STORY_ID)
    for name in ("editorial_analysis.json", "story_concepts.json", "content_plan.json"):
        write_artifact(_TEST_STORY_ID, WorkflowState.PROCESSING, name, {"stub": True})
    mark_stage_done(item, "STORYCRAFT")
    item = load_item(WorkflowState.PROCESSING, _TEST_STORY_ID)
    if with_narrative_stage:
        for name in ("hooks.json", "script.json", "scene_plan.json"):
            write_artifact(_TEST_STORY_ID, WorkflowState.PROCESSING, name, {"stub": True})
        mark_stage_done(item, "NARRATIVE")
        item = load_item(WorkflowState.PROCESSING, _TEST_STORY_ID)
    return move_to_review(item)


def _sequence_shot(**overrides):
    shot = {
        "shot_id": "shot_01", "scene_id": "scene_01", "asset_id": None,
        "order": 1, "duration_seconds": 1.0, "framing": "test",
        "motion": "STATIC", "transition_in": "NONE", "transition_out": "CUT",
        "purpose": "hook", "notes": "",
        "transform_required": None, "suggested_transform": None,
    }
    shot.update(overrides)
    return shot


def _register_real_asset(asset_id, scene_id="scene_01", width=64, height=64):
    from PIL import Image
    relative_path = f"images/generated/{asset_id}.png"
    absolute_path = story_media_dir(_TEST_STORY_ID) / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (width, height), color=(90, 130, 200)).save(absolute_path, format="PNG")
    return register_asset(
        _TEST_STORY_ID, asset_id=asset_id, scene_id=scene_id, type_="image", subtype="generated",
        filename=f"{asset_id}.png", relative_path=relative_path,
        mime_type="image/png", width=width, height=height, requested_aspect_ratio="9:16",
        source=None, provider="cloudflare", model="@cf/black-forest-labs/flux-1-schnell",
        prompt_version=1, parent_asset_id=None, references=[], provenance="AI_GENERATED", status="READY",
    )


def _setup_minimal_exportable_story():
    """Editorial + media_blueprint únicamente -- el mínimo exportable."""
    _setup_editorial_item()
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": "scene_01", "media_requirement": {"scene_id": "scene_01"}}],
    )


def _setup_full_pipeline_story():
    """Editorial + media + narrative + audio + sequence + animation +
    render (FFmpeg real) + assembly (FFmpeg real) -- historia completa."""
    _setup_editorial_item(with_narrative_stage=True)
    _register_real_asset("img_001")
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": "scene_01", "media_requirement": {"scene_id": "scene_01"}}],
    )
    init_sequence(
        _TEST_STORY_ID, sequence_id="seq_001", target_format="REEL", target_aspect_ratio="9:16",
        narrative_structure="HOOK -> CLOSING", shots=[_sequence_shot(asset_id="img_001", duration_seconds=1.0)],
    )
    init_narrative_direction(_TEST_STORY_ID, narrative_direction_id="narrative_001", beats=[{
        "beat_id": "beat_01", "order": 1, "scene_ids": ["scene_01"],
        "emotion": "SUSPENSE", "emotional_intensity": "MEDIUM", "narrative_function": "HOOK",
        "pacing_intention": "MEDIUM", "visual_rhythm_intention": "STEADY",
        "motion_intensity_intention": "SUBTLE", "transition_intention": "SOFT",
        "music_intention": "SUSPENSEFUL", "silence_or_emphasis": "NONE",
        "narration_priority": False, "notes": "",
    }])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[])
    init_animation_plan(_TEST_STORY_ID)
    init_render_plan(_TEST_STORY_ID)
    process_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)
    process_assembly_plan(_TEST_STORY_ID)


# --- manifest ------------------------------------------------------------

def test_init_export_manifest_no_workspace_item_raises():
    with pytest.raises(ValueError, match="no es identificable"):
        init_export_manifest(_TEST_STORY_ID)


def test_init_export_manifest_basic_metadata():
    _setup_minimal_exportable_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    assert manifest["schema_version"] == SCHEMA_VERSION
    assert manifest["story_id"] == _TEST_STORY_ID
    assert manifest["export_id"].startswith("export_")
    assert manifest["status"] == "DRAFT"
    assert manifest["workspace_item_state"] == "READY_FOR_REVIEW"
    assert manifest["exported_at"] is None
    assert load(_TEST_STORY_ID)["export_id"] == manifest["export_id"]


def test_init_export_manifest_unique_export_id_per_call():
    _setup_minimal_exportable_story()
    m1 = init_export_manifest(_TEST_STORY_ID)
    m2 = init_export_manifest(_TEST_STORY_ID)
    assert m1["export_id"] != m2["export_id"]


def test_init_export_manifest_availability_values_are_closed_vocab():
    _setup_full_pipeline_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    for entry in list(manifest["artifacts"].values()) + manifest["assets"] + manifest["renders"] + [manifest["final_reel"]]:
        assert entry["availability"] in AVAILABILITY


def test_init_export_manifest_missing_artifacts_reported_as_missing():
    _setup_minimal_exportable_story()  # sin narrative/audio/sequence/animation/render/assembly
    manifest = init_export_manifest(_TEST_STORY_ID)
    assert manifest["artifacts"]["narrative_direction"]["availability"] == "MISSING"
    assert manifest["artifacts"]["audio_plan"]["availability"] == "MISSING"
    assert manifest["artifacts"]["sequence"]["availability"] == "MISSING"
    assert manifest["artifacts"]["assembly_plan"]["availability"] == "MISSING"
    assert manifest["final_reel"]["availability"] == "MISSING"
    assert manifest["renders"] == []


# --- package (paths relativos, sin paths absolutos) --------------------------

def test_package_paths_are_relative_never_absolute():
    _setup_full_pipeline_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    all_paths = []
    for entry in list(manifest["artifacts"].values()) + manifest["assets"] + manifest["renders"] + [manifest["final_reel"]]:
        if entry.get("source_relative_path"):
            all_paths.append(entry["source_relative_path"])
        if entry.get("package_relative_path"):
            all_paths.append(entry["package_relative_path"])
    assert all_paths  # hay al menos algunas rutas para chequear
    for p in all_paths:
        assert not p.startswith("/"), p
        assert ":" not in p, p  # nunca "C:\..."
        assert str(LAB_ROOT) not in p, p


def test_package_asset_included_with_full_traceability():
    _setup_full_pipeline_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    assert len(manifest["assets"]) == 1
    asset = manifest["assets"][0]
    assert asset["asset_id"] == "img_001"
    assert asset["availability"] == "PRESENT"
    assert asset["provenance"] == "AI_GENERATED"
    assert asset["scene_id"] == "scene_01"
    assert asset["shot_id"] == "shot_01"
    assert asset["package_relative_path"] == "assets/images/generated/img_001.png"
    assert asset["checksum_sha256"]


def test_package_final_reel_included_when_exists():
    _setup_full_pipeline_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    assert manifest["final_reel"]["availability"] == "PRESENT"
    assert manifest["final_reel"]["package_relative_path"] == "videos/final/final_reel.mp4"
    assert manifest["final_reel"]["checksum_sha256"]


def test_package_final_reel_absent_correctly_when_no_assembly():
    _setup_minimal_exportable_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    assert manifest["final_reel"]["availability"] == "MISSING"
    assert manifest["final_reel"]["package_relative_path"] is None


# --- validation ----------------------------------------------------------

def test_validate_no_manifest_returns_error():
    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("No hay export_manifest.json" in e for e in errors)


def test_validate_full_pipeline_story_is_valid():
    _setup_full_pipeline_story()
    init_export_manifest(_TEST_STORY_ID)
    assert validate_export_manifest(_TEST_STORY_ID) == []


def test_validate_missing_required_editorial_artifact_blocks():
    # Item sin pasar por move_to_review -- sin content_plan.json.
    item = WorkspaceItem(id=_TEST_STORY_ID, state=WorkflowState.INGESTED, title="t", source_url="https://example.com")
    save_item(item)
    start_processing(_TEST_STORY_ID)
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": "scene_01", "media_requirement": {"scene_id": "scene_01"}}],
    )
    init_export_manifest(_TEST_STORY_ID)
    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("editorial obligatorio" in e for e in errors)


def test_validate_missing_asset_file_blocks():
    _setup_full_pipeline_story()
    init_export_manifest(_TEST_STORY_ID)
    (story_media_dir(_TEST_STORY_ID) / "images" / "generated" / "img_001.png").unlink()
    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("img_001" in e and "ya no existe" in e for e in errors)


def test_validate_invalid_reference_source_removed_after_planning():
    _setup_full_pipeline_story()
    init_export_manifest(_TEST_STORY_ID)
    from lab.narrative.paths import narrative_direction_path
    narrative_direction_path(_TEST_STORY_ID).unlink()
    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("narrative_direction" in e and "replanificar" in e for e in errors)


def test_validate_blocked_render_reported():
    _setup_full_pipeline_story()
    init_export_manifest(_TEST_STORY_ID)
    from lab.render.paths import rendered_video_path
    rendered_video_path(_TEST_STORY_ID, "render_shot_01").unlink()
    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("render" in e.lower() and "ya no existe" in e for e in errors)


def test_validate_failed_render_reported_as_blocked_from_the_start():
    _setup_full_pipeline_story()
    from lab.render.paths import render_plan_path
    import json as _json
    plan = _json.loads(render_plan_path(_TEST_STORY_ID).read_text(encoding="utf-8"))
    plan["shots"][0]["status"] = "FAILED"
    plan["shots"][0]["output_path"] = None
    plan["shots"][0]["error"] = "FFmpeg simulated failure"
    render_plan_path(_TEST_STORY_ID).write_text(_json.dumps(plan), encoding="utf-8")

    init_export_manifest(_TEST_STORY_ID)
    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("render" in e.lower() and "BLOCKED" in e for e in errors)


def test_validate_rejected_story_blocks():
    _setup_minimal_exportable_story()
    from lab.core.workspace import transition
    item = load_item(WorkflowState.READY_FOR_REVIEW, _TEST_STORY_ID)
    transition(item, WorkflowState.REJECTED)
    init_export_manifest(_TEST_STORY_ID)
    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("REJECTED" in e for e in errors)


# --- security --------------------------------------------------------------

def test_security_scan_clean_for_normal_export():
    _setup_full_pipeline_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    assert manifest["security_scan"]["status"] == "CLEAN"
    assert manifest["security_scan"]["violations"] == []


def test_security_scan_blocks_forbidden_filename():
    _setup_full_pipeline_story()
    manifest = init_export_manifest(_TEST_STORY_ID)
    # Simula que un elemento del manifest apuntara a un nombre prohibido.
    manifest["assets"][0]["package_relative_path"] = "assets/.env"
    from lab.export.planner import _security_scan
    scan = _security_scan(manifest)
    assert scan["status"] == "BLOCKED"
    assert scan["violations"]


# --- set_status --------------------------------------------------------------

def test_set_status_invalid_raises():
    _setup_minimal_exportable_story()
    init_export_manifest(_TEST_STORY_ID)
    with pytest.raises(ValueError, match="status inválido"):
        set_status(_TEST_STORY_ID, "APPROVED")  # deliberadamente fuera del vocabulario de Export


def test_set_status_updates_and_persists():
    _setup_full_pipeline_story()
    init_export_manifest(_TEST_STORY_ID)
    manifest = set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")
    assert manifest["status"] == "READY_FOR_REVIEW"
    assert load(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


# --- no modifica artifacts upstream ------------------------------------------

def test_does_not_modify_upstream_artifacts():
    _setup_full_pipeline_story()
    import hashlib
    from lab.animation.paths import animation_plan_path
    from lab.assembly.paths import assembly_plan_path
    from lab.audio.paths import audio_plan_path
    from lab.media.paths import asset_registry_path, media_blueprint_path, sequence_path
    from lab.narrative.paths import narrative_direction_path
    from lab.render.paths import render_plan_path

    def h(p):
        return hashlib.sha256(p.read_bytes()).hexdigest()

    before = {
        name: h(fn(_TEST_STORY_ID)) for name, fn in [
            ("narrative", narrative_direction_path), ("audio", audio_plan_path),
            ("sequence", sequence_path), ("animation", animation_plan_path),
            ("render", render_plan_path), ("assembly", assembly_plan_path),
            ("blueprint", media_blueprint_path), ("registry", asset_registry_path),
        ]
    }

    init_export_manifest(_TEST_STORY_ID)
    validate_export_manifest(_TEST_STORY_ID)

    after = {
        name: h(fn(_TEST_STORY_ID)) for name, fn in [
            ("narrative", narrative_direction_path), ("audio", audio_plan_path),
            ("sequence", sequence_path), ("animation", animation_plan_path),
            ("render", render_plan_path), ("assembly", assembly_plan_path),
            ("blueprint", media_blueprint_path), ("registry", asset_registry_path),
        ]
    }
    assert before == after
    assert export_manifest_path(_TEST_STORY_ID).exists()
