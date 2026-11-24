"""
Tests de integracion de los comandos CLI `lab.cli assembly-plan`,
`assembly-review`, `assembly-status` y `assembly-execute` -- los wrappers
finos que la skill lab-assembly invoca. No vuelve a probar las reglas de
clasificacion/validacion (eso ya lo cubre test_assembly_planner.py contra
lab.assembly.planner directamente) ni la ejecucion FFmpeg (eso ya lo cubre
test_assembler.py, con FFmpeg real) -- solo que los comandos CLI conectan
esa capa correctamente: llaman al planner/assembler real, assembly-plan y
assembly-execute registran el job, assembly-review mueve el status,
assembly-status lee y resume, y ninguno modifica sequence.json/
animation_plan.json/render_plan.json/narrative_direction.json/
audio_plan.json/asset_registry.json/media_blueprint.json.
"""

import argparse
import json
import shutil

import pytest

import lab.cli as cli
from lab.animation.paths import animation_plan_path
from lab.animation.planner import init_animation_plan
from lab.core.paths import JOBS_DONE_DIR, JOBS_FAILED_DIR
from lab.media.blueprint import init_blueprint
from lab.media.paths import asset_registry_path, media_blueprint_path, sequence_path, story_media_dir
from lab.media.registry import register_asset
from lab.render.paths import render_plan_path
from lab.render.planner import init_render_plan
from lab.render.renderer import process_render_plan
from lab.sequence.planner import init_sequence

_TEST_STORY_ID = "_test_cli_assembly_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    jobs_before = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}
    yield
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    for jobs_dir in (JOBS_DONE_DIR, JOBS_FAILED_DIR):
        for path in jobs_dir.glob("*.json"):
            if path.name not in jobs_before:
                path.unlink()


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


def _setup_render_plan(shots, target_aspect_ratio="9:16"):
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
    return init_render_plan(_TEST_STORY_ID)


def _run(cmd, story_id=_TEST_STORY_ID):
    return cmd(argparse.Namespace(story_id=story_id))


def _capture_stdout(fn):
    import io
    from contextlib import redirect_stdout
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn()
    return buf.getvalue()


# --- assembly-plan ----------------------------------------------------

def test_cmd_assembly_plan_missing_render_plan_returns_1(capsys):
    exit_code = _run(cli.cmd_assembly_plan)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_assembly_plan_success_returns_0_and_prints_summary(capsys):
    _register_real_asset("img_001")
    _setup_render_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1),
        _sequence_shot(shot_id="shot_02", scene_id="scene_02", order=2, asset_id="img_002"),
    ])
    # shot_01: texto-only -> EXCLUDED_NO_ASSET. shot_02: asset sin renderizar -> BLOCKED_NOT_RENDERED.

    exit_code = _run(cli.cmd_assembly_plan)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["assembly_plan_id"] == "assembly_001"
    assert out["total_shots"] == 2
    assert out["by_disposition"] == {"EXCLUDED_NO_ASSET": 1, "BLOCKED_NOT_RENDERED": 1}
    assert out["validation_errors"] == []
    assert out["status"] == "DRAFT"


def test_cmd_assembly_plan_records_job():
    _setup_render_plan([_sequence_shot()])
    out_job_id = json.loads(_capture_stdout(lambda: _run(cli.cmd_assembly_plan)))["job_id"]

    job_path = JOBS_DONE_DIR / f"{out_job_id}.json"
    assert job_path.exists()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    assert job["type"] == "assembly_plan"
    assert job["status"] == "done"
    assert job["params"]["story_id"] == _TEST_STORY_ID


def test_cmd_assembly_plan_does_not_modify_upstream_artifacts():
    _register_real_asset("img_001")
    _setup_render_plan([_sequence_shot(asset_id="img_001", transform_required=True, suggested_transform="EXTEND")])

    render_before = render_plan_path(_TEST_STORY_ID).read_bytes()
    anim_before = animation_plan_path(_TEST_STORY_ID).read_bytes()
    seq_before = sequence_path(_TEST_STORY_ID).read_bytes()
    registry_before = asset_registry_path(_TEST_STORY_ID).read_bytes()
    blueprint_before = media_blueprint_path(_TEST_STORY_ID).read_bytes()

    _run(cli.cmd_assembly_plan)

    assert render_plan_path(_TEST_STORY_ID).read_bytes() == render_before
    assert animation_plan_path(_TEST_STORY_ID).read_bytes() == anim_before
    assert sequence_path(_TEST_STORY_ID).read_bytes() == seq_before
    assert asset_registry_path(_TEST_STORY_ID).read_bytes() == registry_before
    assert media_blueprint_path(_TEST_STORY_ID).read_bytes() == blueprint_before


# --- assembly-review ------------------------------------------------------

def test_cmd_assembly_review_success_returns_0_and_updates_status(capsys):
    from lab.assembly.planner import load
    _setup_render_plan([_sequence_shot()])
    _run(cli.cmd_assembly_plan)
    capsys.readouterr()

    exit_code = _run(cli.cmd_assembly_review)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["status"] == "READY_FOR_REVIEW"
    assert load(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


def test_cmd_assembly_review_missing_assembly_plan_returns_1(capsys):
    exit_code = _run(cli.cmd_assembly_review)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


# --- assembly-status --------------------------------------------------------

def test_cmd_assembly_status_missing_assembly_plan_returns_1(capsys):
    exit_code = _run(cli.cmd_assembly_status)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_assembly_status_success_returns_0_and_prints_summary(capsys):
    _register_real_asset("img_001")
    _setup_render_plan([_sequence_shot(asset_id="img_001")])
    _run(cli.cmd_assembly_plan)
    capsys.readouterr()

    exit_code = _run(cli.cmd_assembly_status)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["status"] == "DRAFT"
    assert out["total_shots"] == 1
    assert out["output"]["status"] == "PENDING"


# --- assembly-execute --------------------------------------------------------

def test_cmd_assembly_execute_missing_assembly_plan_returns_1(capsys):
    exit_code = _run(cli.cmd_assembly_execute)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_assembly_execute_success_returns_0_and_prints_summary(capsys):
    _register_real_asset("img_001")
    _setup_render_plan([_sequence_shot(asset_id="img_001", duration_seconds=1.0)])
    process_render_plan(_TEST_STORY_ID)
    _run(cli.cmd_assembly_plan)
    capsys.readouterr()

    exit_code = _run(cli.cmd_assembly_execute)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["status"] == "DONE"
    assert out["relative_path"] == "videos/final/final_reel.mp4"
    assert out["shots_included"] == 1
    assert out["probe"]["width"] == 1080

    from lab.assembly.paths import final_reel_path
    assert final_reel_path(_TEST_STORY_ID).exists()


def test_cmd_assembly_execute_no_included_shots_returns_1(capsys):
    _setup_render_plan([_sequence_shot()])  # texto-only, nada que ensamblar
    _run(cli.cmd_assembly_plan)
    capsys.readouterr()

    exit_code = _run(cli.cmd_assembly_execute)
    assert exit_code == 1

    out = json.loads(capsys.readouterr().out)
    assert out["status"] == "FAILED"
    assert out["error"]


def test_cmd_assembly_execute_records_job():
    _register_real_asset("img_001")
    _setup_render_plan([_sequence_shot(asset_id="img_001")])
    process_render_plan(_TEST_STORY_ID)
    _run(cli.cmd_assembly_plan)

    out_job_id = json.loads(_capture_stdout(lambda: _run(cli.cmd_assembly_execute)))["job_id"]

    job_path = JOBS_DONE_DIR / f"{out_job_id}.json"
    assert job_path.exists()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    assert job["type"] == "assembly_execute"
    assert job["status"] == "done"


def test_cmd_assembly_execute_does_not_modify_upstream_artifacts():
    _register_real_asset("img_001")
    _setup_render_plan([_sequence_shot(asset_id="img_001")])
    process_render_plan(_TEST_STORY_ID)
    _run(cli.cmd_assembly_plan)

    render_before = render_plan_path(_TEST_STORY_ID).read_bytes()
    anim_before = animation_plan_path(_TEST_STORY_ID).read_bytes()
    seq_before = sequence_path(_TEST_STORY_ID).read_bytes()
    registry_before = asset_registry_path(_TEST_STORY_ID).read_bytes()

    _run(cli.cmd_assembly_execute)

    assert render_plan_path(_TEST_STORY_ID).read_bytes() == render_before
    assert animation_plan_path(_TEST_STORY_ID).read_bytes() == anim_before
    assert sequence_path(_TEST_STORY_ID).read_bytes() == seq_before
    assert asset_registry_path(_TEST_STORY_ID).read_bytes() == registry_before
