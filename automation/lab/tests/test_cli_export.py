"""
Tests de integracion de los comandos CLI `lab.cli export-plan`,
`export-review`, `export-status` y `export-execute` -- los wrappers finos
que la skill lab-production-export invoca. No vuelve a probar las reglas
de disponibilidad/validacion (eso ya lo cubre test_export_planner.py) ni la
copia real de archivos (eso ya lo cubre test_export_packager.py) -- solo
que los comandos CLI conectan esa capa correctamente: llaman al planner/
packager real, export-plan y export-execute registran el job,
export-review mueve el status, export-status lee y resume, y ninguno
modifica ningun artifact upstream.
"""

import argparse
import json
import shutil

import pytest

import lab.cli as cli
from lab.animation.planner import init_animation_plan
from lab.core.paths import APPROVED_DIR, INCOMING_DIR, JOBS_DONE_DIR, JOBS_FAILED_DIR, REJECTED_DIR
from lab.core.workspace import WorkflowState, WorkspaceItem, item_dir, load_item, save_item
from lab.editorial.artifacts import write_artifact
from lab.editorial.pipeline import mark_stage_done, move_to_review, start_processing
from lab.export.paths import export_dir
from lab.export.planner import load as load_manifest, set_status
from lab.media.blueprint import init_blueprint
from lab.media.paths import story_media_dir
from lab.media.registry import register_asset
from lab.render.planner import init_render_plan
from lab.render.renderer import process_render_plan
from lab.sequence.planner import init_sequence

_TEST_STORY_ID = "_test_cli_export_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    def _clean():
        shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
        shutil.rmtree(item_dir(WorkflowState.PROCESSING, _TEST_STORY_ID), ignore_errors=True)
        shutil.rmtree(item_dir(WorkflowState.READY_FOR_REVIEW, _TEST_STORY_ID), ignore_errors=True)
        for flat_dir in (INCOMING_DIR, APPROVED_DIR, REJECTED_DIR):
            (flat_dir / f"{_TEST_STORY_ID}.json").unlink(missing_ok=True)
        shutil.rmtree(export_dir(_TEST_STORY_ID), ignore_errors=True)

    jobs_before = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}
    _clean()
    yield
    _clean()
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


def _setup_exportable_story(with_render=False):
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

    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": "scene_01", "media_requirement": {"scene_id": "scene_01"}}],
    )
    if with_render:
        _register_real_asset("img_001")
        init_sequence(
            _TEST_STORY_ID, sequence_id="seq_001", target_format="REEL", target_aspect_ratio="9:16",
            narrative_structure="HOOK -> CLOSING", shots=[_sequence_shot(asset_id="img_001", duration_seconds=1.0)],
        )
        init_animation_plan(_TEST_STORY_ID)
        init_render_plan(_TEST_STORY_ID)
        process_render_plan(_TEST_STORY_ID)


def _run(cmd, story_id=_TEST_STORY_ID):
    return cmd(argparse.Namespace(story_id=story_id))


def _capture_stdout(fn):
    import io
    from contextlib import redirect_stdout
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn()
    return buf.getvalue()


# --- export-plan --------------------------------------------------------

def test_cmd_export_plan_no_workspace_item_returns_1(capsys):
    exit_code = _run(cli.cmd_export_plan)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_export_plan_success_returns_0_and_prints_summary(capsys):
    _setup_exportable_story()

    exit_code = _run(cli.cmd_export_plan)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["export_id"].startswith("export_")
    assert out["status"] == "DRAFT"
    assert out["security_scan"]["status"] == "CLEAN"
    assert out["validation_errors"] == []


def test_cmd_export_plan_records_job():
    _setup_exportable_story()
    out_job_id = json.loads(_capture_stdout(lambda: _run(cli.cmd_export_plan)))["job_id"]

    job_path = JOBS_DONE_DIR / f"{out_job_id}.json"
    assert job_path.exists()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    assert job["type"] == "export_plan"
    assert job["status"] == "done"


def test_cmd_export_plan_does_not_modify_upstream_artifacts():
    _setup_exportable_story(with_render=True)
    from lab.media.paths import media_blueprint_path
    from lab.render.paths import render_plan_path

    blueprint_before = media_blueprint_path(_TEST_STORY_ID).read_bytes()
    render_before = render_plan_path(_TEST_STORY_ID).read_bytes()

    _run(cli.cmd_export_plan)

    assert media_blueprint_path(_TEST_STORY_ID).read_bytes() == blueprint_before
    assert render_plan_path(_TEST_STORY_ID).read_bytes() == render_before


# --- export-review ------------------------------------------------------

def test_cmd_export_review_success_returns_0_and_updates_status(capsys):
    _setup_exportable_story()
    _run(cli.cmd_export_plan)
    capsys.readouterr()

    exit_code = _run(cli.cmd_export_review)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["status"] == "READY_FOR_REVIEW"
    assert load_manifest(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


def test_cmd_export_review_missing_manifest_returns_1(capsys):
    exit_code = _run(cli.cmd_export_review)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


# --- export-status --------------------------------------------------------

def test_cmd_export_status_missing_manifest_returns_1(capsys):
    exit_code = _run(cli.cmd_export_status)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_export_status_success_returns_0_and_prints_summary(capsys):
    _setup_exportable_story()
    _run(cli.cmd_export_plan)
    capsys.readouterr()

    exit_code = _run(cli.cmd_export_status)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["status"] == "DRAFT"
    assert out["exported_at"] is None


# --- export-execute --------------------------------------------------------

def test_cmd_export_execute_missing_manifest_returns_1(capsys):
    exit_code = _run(cli.cmd_export_execute)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_export_execute_refuses_without_review_returns_1(capsys):
    _setup_exportable_story()
    _run(cli.cmd_export_plan)  # queda en DRAFT, sin review
    capsys.readouterr()

    exit_code = _run(cli.cmd_export_execute)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert out["status"] == "FAILED"


def test_cmd_export_execute_success_returns_0_and_prints_summary(capsys):
    _setup_exportable_story(with_render=True)
    _run(cli.cmd_export_plan)
    set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")
    capsys.readouterr()

    exit_code = _run(cli.cmd_export_execute)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["status"] == "EXPORTED"
    assert out["files_copied"] > 0
    assert out["package_dir"] == f"workspace/exports/{_TEST_STORY_ID}"

    from lab.export.paths import export_manifest_path
    assert export_manifest_path(_TEST_STORY_ID).exists()


def test_cmd_export_execute_records_job():
    _setup_exportable_story(with_render=True)
    _run(cli.cmd_export_plan)
    set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")

    out_job_id = json.loads(_capture_stdout(lambda: _run(cli.cmd_export_execute)))["job_id"]

    job_path = JOBS_DONE_DIR / f"{out_job_id}.json"
    assert job_path.exists()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    assert job["type"] == "export_execute"
    assert job["status"] == "done"


def test_cmd_export_execute_does_not_modify_upstream_artifacts():
    _setup_exportable_story(with_render=True)
    _run(cli.cmd_export_plan)
    set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")

    from lab.render.paths import render_plan_path
    render_before = render_plan_path(_TEST_STORY_ID).read_bytes()

    _run(cli.cmd_export_execute)

    assert render_plan_path(_TEST_STORY_ID).read_bytes() == render_before
