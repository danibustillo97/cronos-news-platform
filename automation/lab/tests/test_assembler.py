"""
Tests de lab.assembly.assembler -- primer modulo de Assembly que ejecuta
FFmpeg real: estos tests corren el binario de verdad (mismo criterio "no
mockear lo que se puede probar real" del resto de LAB) contra clips
renderizados de verdad (PNG minuscula generada con Pillow -> Renderer real
-> videos/rendered/*.mp4 -> Assembler real -> videos/final/final_reel.mp4).

Ejercita process_assembly_plan() de punta a punta: construye un
assembly_plan.json real (via init_assembly_plan, sin cambios) y corre el
Assembler sobre el.
"""

import shutil

import pytest

from lab.animation.planner import init_animation_plan
from lab.assembly.assembler import process_assembly_plan
from lab.assembly.paths import assembly_plan_path, final_reel_path
from lab.assembly.planner import init_assembly_plan, load as load_assembly_plan
from lab.media.blueprint import init_blueprint
from lab.media.paths import story_media_dir
from lab.media.registry import register_asset
from lab.render.planner import init_render_plan
from lab.render.renderer import process_render_plan
from lab.sequence.planner import init_sequence

_TEST_STORY_ID = "_test_assembler_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    yield
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)


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


def _register_real_asset(asset_id, scene_id, width=64, height=64):
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


def _build_and_render(shots, target_aspect_ratio="9:16"):
    """Cadena completa real: blueprint -> sequence -> animation_plan ->
    render_plan -> Renderer real (FFmpeg) -> assembly_plan. Devuelve el
    assembly_plan ya inicializado."""
    scene_ids = sorted({s["scene_id"] for s in shots})
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": sid, "media_requirement": {"scene_id": sid}} for sid in scene_ids],
    )
    init_sequence(
        _TEST_STORY_ID, sequence_id="seq_001", target_format="REEL", target_aspect_ratio=target_aspect_ratio,
        narrative_structure="HOOK -> CLOSING", shots=shots,
    )
    init_animation_plan(_TEST_STORY_ID)
    init_render_plan(_TEST_STORY_ID)
    process_render_plan(_TEST_STORY_ID)
    return init_assembly_plan(_TEST_STORY_ID)


# --- process_assembly_plan (FFmpeg real) -------------------------------------

def test_process_assembly_plan_no_assembly_plan_raises():
    with pytest.raises(ValueError, match="assembly_plan.json"):
        process_assembly_plan(_TEST_STORY_ID)


def test_process_assembly_plan_no_included_shots_fails_without_calling_ffmpeg():
    _build_and_render([_sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1)])  # texto-only

    outcome = process_assembly_plan(_TEST_STORY_ID)

    assert outcome["status"] == "FAILED"
    assert "INCLUDED" in outcome["error"]
    assert not final_reel_path(_TEST_STORY_ID).exists()

    plan = load_assembly_plan(_TEST_STORY_ID)
    assert plan["output"]["status"] == "FAILED"


def test_process_assembly_plan_single_included_shot_real_ffmpeg():
    _register_real_asset("img_001", scene_id="scene_01")
    _build_and_render([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001", duration_seconds=1.0),
    ])

    outcome = process_assembly_plan(_TEST_STORY_ID)

    assert outcome["status"] == "DONE", outcome.get("error")
    assert outcome["relative_path"] == "videos/final/final_reel.mp4"
    assert outcome["shots_included"] == 1

    output_file = final_reel_path(_TEST_STORY_ID)
    assert output_file.exists()
    assert output_file.stat().st_size > 0

    probe = outcome["probe"]
    assert probe["codec_name"] in ("h264", "hevc")
    assert probe["width"] == 1080
    assert probe["height"] == 1920
    assert probe["duration_seconds"] == pytest.approx(1.0, abs=0.3)

    plan = load_assembly_plan(_TEST_STORY_ID)
    assert plan["output"]["status"] == "DONE"
    assert plan["output"]["relative_path"] == "videos/final/final_reel.mp4"
    assert plan["output"]["error"] is None


def test_process_assembly_plan_multiple_included_shots_concatenates_duration():
    _register_real_asset("img_001", scene_id="scene_01")
    _register_real_asset("img_002", scene_id="scene_02")
    _build_and_render([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001", duration_seconds=1.0),
        _sequence_shot(shot_id="shot_02", scene_id="scene_02", order=2, asset_id="img_002", duration_seconds=1.5),
    ])

    outcome = process_assembly_plan(_TEST_STORY_ID)

    assert outcome["status"] == "DONE", outcome.get("error")
    assert outcome["shots_included"] == 2
    assert outcome["probe"]["duration_seconds"] == pytest.approx(2.5, abs=0.4)


def test_process_assembly_plan_missing_clip_on_disk_fails_cleanly():
    _register_real_asset("img_001", scene_id="scene_01")
    _build_and_render([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001"),
    ])
    from lab.render.paths import rendered_video_path
    rendered_video_path(_TEST_STORY_ID, "render_shot_01").unlink()

    outcome = process_assembly_plan(_TEST_STORY_ID)

    assert outcome["status"] == "FAILED"
    assert "faltan" in outcome["error"]
    assert not final_reel_path(_TEST_STORY_ID).exists()


def test_process_assembly_plan_corrupt_clip_real_ffmpeg_error():
    # No se mockea subprocess -- se corrompe el clip de verdad (bytes
    # basura en vez de un .mp4 real) para forzar un error real de FFmpeg.
    _register_real_asset("img_001", scene_id="scene_01")
    _build_and_render([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001"),
    ])
    from lab.render.paths import rendered_video_path
    rendered_video_path(_TEST_STORY_ID, "render_shot_01").write_bytes(b"this is not a real video file")

    outcome = process_assembly_plan(_TEST_STORY_ID)

    assert outcome["status"] == "FAILED"
    assert outcome["error"]

    plan = load_assembly_plan(_TEST_STORY_ID)
    assert plan["output"]["status"] == "FAILED"
    assert plan["output"]["error"]


def test_process_assembly_plan_does_not_modify_upstream_artifacts():
    _register_real_asset("img_001", scene_id="scene_01")
    _build_and_render([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001"),
    ])

    import hashlib
    from lab.animation.paths import animation_plan_path
    from lab.media.paths import asset_registry_path, sequence_path
    from lab.render.paths import render_plan_path

    def h(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    seq_before = h(sequence_path(_TEST_STORY_ID))
    anim_before = h(animation_plan_path(_TEST_STORY_ID))
    render_before = h(render_plan_path(_TEST_STORY_ID))
    registry_before = h(asset_registry_path(_TEST_STORY_ID))

    process_assembly_plan(_TEST_STORY_ID)

    assert h(sequence_path(_TEST_STORY_ID)) == seq_before
    assert h(animation_plan_path(_TEST_STORY_ID)) == anim_before
    assert h(render_plan_path(_TEST_STORY_ID)) == render_before
    assert h(asset_registry_path(_TEST_STORY_ID)) == registry_before
    # assembly_plan.json SI cambia (output) -- es su propio artifact, por diseño.
    assert assembly_plan_path(_TEST_STORY_ID).exists()
