"""
Tests de lab.export.packager -- primer módulo de Export que copia archivos
de verdad. Construye una historia real completa (mismo camino que
test_export_planner.py: editorial -> media -> narrative -> audio ->
sequence -> animation -> render (FFmpeg real) -> assembly (FFmpeg real)),
la exporta de verdad, y confirma que el paquete físico en disco coincide
con lo declarado.

Cubre integridad: checksum correcto tras copiar, y archivo modificado
DESPUÉS de exportar detectado por validate_export_manifest().
"""

import shutil

import pytest

from lab.animation.planner import init_animation_plan
from lab.assembly.assembler import process_assembly_plan
from lab.assembly.planner import init_assembly_plan
from lab.audio.planner import init_audio_plan
from lab.core.paths import APPROVED_DIR, INCOMING_DIR, REJECTED_DIR, LAB_ROOT
from lab.core.workspace import WorkflowState, WorkspaceItem, item_dir, load_item, save_item
from lab.editorial.artifacts import write_artifact
from lab.editorial.pipeline import mark_stage_done, move_to_review, start_processing
from lab.export.packager import process_export
from lab.export.paths import export_dir, export_manifest_path
from lab.export.planner import init_export_manifest, load, set_status, validate_export_manifest
from lab.media.blueprint import init_blueprint
from lab.media.paths import story_media_dir
from lab.media.registry import register_asset
from lab.narrative.planner import init_narrative_direction
from lab.render.planner import init_render_plan
from lab.render.renderer import process_render_plan
from lab.sequence.planner import init_sequence

_TEST_STORY_ID = "_test_export_packager_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
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


def _setup_full_pipeline_story():
    item = WorkspaceItem(id=_TEST_STORY_ID, state=WorkflowState.INGESTED, title="Test", source_url="https://example.com/test")
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
    move_to_review(item)

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


def _plan_and_review():
    init_export_manifest(_TEST_STORY_ID)
    return set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")


# --- process_export -----------------------------------------------------

def test_process_export_no_manifest_raises():
    with pytest.raises(ValueError, match="export_manifest.json"):
        process_export(_TEST_STORY_ID)


def test_process_export_refuses_when_not_ready_for_review():
    _setup_full_pipeline_story()
    init_export_manifest(_TEST_STORY_ID)  # queda en DRAFT
    outcome = process_export(_TEST_STORY_ID)
    assert outcome["status"] == "FAILED"
    assert "export-review" in outcome["error"]
    assert outcome["files_copied"] == 0


def test_process_export_copies_files_and_marks_exported():
    _setup_full_pipeline_story()
    _plan_and_review()

    outcome = process_export(_TEST_STORY_ID)

    assert outcome["status"] == "EXPORTED", outcome.get("error")
    assert outcome["files_copied"] > 0
    assert outcome["total_size_bytes"] > 0
    assert outcome["package_dir"] == f"workspace/exports/{_TEST_STORY_ID}"

    manifest = load(_TEST_STORY_ID)
    assert manifest["status"] == "EXPORTED"
    assert manifest["exported_at"] is not None


def test_process_export_package_structure_on_disk():
    _setup_full_pipeline_story()
    _plan_and_review()
    process_export(_TEST_STORY_ID)

    pkg = export_dir(_TEST_STORY_ID)
    assert (pkg / "export_manifest.json").exists()
    assert (pkg / "artifacts" / "editorial" / "understanding.json").exists()
    assert (pkg / "artifacts" / "media_blueprint.json").exists()
    assert (pkg / "artifacts" / "narrative_direction.json").exists()
    assert (pkg / "artifacts" / "audio_plan.json").exists()
    assert (pkg / "artifacts" / "sequence.json").exists()
    assert (pkg / "artifacts" / "animation_plan.json").exists()
    assert (pkg / "artifacts" / "render_plan.json").exists()
    assert (pkg / "artifacts" / "assembly_plan.json").exists()
    assert (pkg / "assets" / "images" / "generated" / "img_001.png").exists()
    assert (pkg / "videos" / "rendered" / "render_shot_01.mp4").exists()
    assert (pkg / "videos" / "final" / "final_reel.mp4").exists()


def test_process_export_copies_are_byte_identical_to_source():
    _setup_full_pipeline_story()
    _plan_and_review()
    process_export(_TEST_STORY_ID)

    manifest = load(_TEST_STORY_ID)
    for entry in manifest["assets"]:
        source = LAB_ROOT / entry["source_relative_path"]
        copy = export_dir(_TEST_STORY_ID) / entry["package_relative_path"]
        assert source.read_bytes() == copy.read_bytes()


def test_process_export_reexport_overwrites_previous_package():
    _setup_full_pipeline_story()
    _plan_and_review()
    process_export(_TEST_STORY_ID)

    _plan_and_review()  # re-planifica (nuevo export_id) y vuelve a aprobar
    outcome = process_export(_TEST_STORY_ID)
    assert outcome["status"] == "EXPORTED"


# --- integridad: archivo modificado despues de exportar -----------------------

def test_validate_detects_tampered_package_copy_after_export():
    _setup_full_pipeline_story()
    _plan_and_review()
    process_export(_TEST_STORY_ID)
    assert validate_export_manifest(_TEST_STORY_ID) == []

    tampered = export_dir(_TEST_STORY_ID) / "artifacts" / "media_blueprint.json"
    original = tampered.read_bytes()
    tampered.write_bytes(original + b"\ntampered")

    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("modificada después de exportar" in e for e in errors)


def test_validate_detects_missing_package_copy_after_export():
    _setup_full_pipeline_story()
    _plan_and_review()
    process_export(_TEST_STORY_ID)

    (export_dir(_TEST_STORY_ID) / "videos" / "final" / "final_reel.mp4").unlink()

    errors = validate_export_manifest(_TEST_STORY_ID)
    assert any("ya no existe en el paquete" in e for e in errors)


# --- no modifica artifacts upstream ni el paquete de origen ------------------

def test_process_export_does_not_modify_upstream_artifacts():
    _setup_full_pipeline_story()
    _plan_and_review()

    import hashlib
    from lab.animation.paths import animation_plan_path
    from lab.assembly.paths import assembly_plan_path
    from lab.audio.paths import audio_plan_path
    from lab.media.paths import asset_registry_path, media_blueprint_path, sequence_path
    from lab.narrative.paths import narrative_direction_path
    from lab.render.paths import render_plan_path

    def h(p):
        return hashlib.sha256(p.read_bytes()).hexdigest()

    paths = [
        narrative_direction_path(_TEST_STORY_ID), audio_plan_path(_TEST_STORY_ID),
        sequence_path(_TEST_STORY_ID), animation_plan_path(_TEST_STORY_ID),
        render_plan_path(_TEST_STORY_ID), assembly_plan_path(_TEST_STORY_ID),
        media_blueprint_path(_TEST_STORY_ID), asset_registry_path(_TEST_STORY_ID),
    ]
    before = {p: h(p) for p in paths}

    process_export(_TEST_STORY_ID)

    after = {p: h(p) for p in paths}
    assert before == after
