"""
Tests de integracion de los comandos CLI `lab.cli narrative-record`,
`narrative-review` y `narrative-status` -- los wrappers finos que la skill
lab-narrative-direction invoca. No vuelve a probar las reglas de
validacion (eso ya lo cubre test_narrative_planner.py contra
lab.narrative.planner directamente) -- solo que los comandos CLI conectan
esa capa correctamente: llaman al planner real, narrative-record registra
el job, narrative-review mueve el status, narrative-status lee y resume, y
ninguno de los tres toca media_blueprint.json/asset_registry.json/
sequence.json/animation_plan.json/render_plan.json.
"""

import argparse
import json
import shutil

import pytest

import lab.cli as cli
from lab.core.paths import JOBS_DONE_DIR, JOBS_FAILED_DIR
from lab.media.blueprint import init_blueprint
from lab.media.paths import media_blueprint_path, story_media_dir

_TEST_STORY_ID = "_test_cli_narrative_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    # narrative-record es el unico de los tres que llama record_job() de
    # verdad -- sin este cleanup, cada corrida de tests dejaria archivos de
    # job reales acumulandose en lab/jobs/done|failed/.
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    jobs_before = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}
    yield
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    for jobs_dir in (JOBS_DONE_DIR, JOBS_FAILED_DIR):
        for path in jobs_dir.glob("*.json"):
            if path.name not in jobs_before:
                path.unlink()


def _valid_beat(**overrides):
    beat = {
        "beat_id": "beat_01", "order": 1, "scene_ids": ["scene_01"],
        "emotion": "SUSPENSE", "emotional_intensity": "MEDIUM", "narrative_function": "HOOK",
        "pacing_intention": "MEDIUM", "visual_rhythm_intention": "STEADY",
        "motion_intensity_intention": "SUBTLE", "transition_intention": "SOFT",
        "music_intention": "SUSPENSEFUL", "silence_or_emphasis": "NONE",
        "narration_priority": True, "notes": "",
    }
    beat.update(overrides)
    return beat


def _setup_blueprint(scene_ids):
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": sid, "media_requirement": {"scene_id": sid}} for sid in scene_ids],
    )


def _run(cmd, story_id=_TEST_STORY_ID):
    return cmd(argparse.Namespace(story_id=story_id))


def _capture_stdout(fn):
    import io
    from contextlib import redirect_stdout
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn()
    return buf.getvalue()


# --- narrative-record ----------------------------------------------------

def test_cmd_narrative_record_missing_narrative_direction_returns_1(capsys):
    exit_code = _run(cli.cmd_narrative_record)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_narrative_record_success_returns_0_and_prints_summary(capsys):
    from lab.narrative.planner import init_narrative_direction
    _setup_blueprint(["scene_01", "scene_02"])
    init_narrative_direction(_TEST_STORY_ID, beats=[
        _valid_beat(beat_id="beat_01", order=1, scene_ids=["scene_01"], emotion="SUSPENSE"),
        _valid_beat(beat_id="beat_02", order=2, scene_ids=["scene_02"], emotion="VICTORY", narrative_function="RESOLUTION"),
    ])

    exit_code = _run(cli.cmd_narrative_record)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["narrative_direction_id"] == "narrative_001"
    assert out["total_beats"] == 2
    assert out["scenes_covered"] == 2
    assert out["emotions_used"] == ["SUSPENSE", "VICTORY"]
    assert out["status"] == "DRAFT"


def test_cmd_narrative_record_records_job():
    from lab.narrative.planner import init_narrative_direction
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])
    out_job_id = json.loads(_capture_stdout(lambda: _run(cli.cmd_narrative_record)))["job_id"]

    job_path = JOBS_DONE_DIR / f"{out_job_id}.json"
    assert job_path.exists()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    assert job["type"] == "narrative_direction"
    assert job["status"] == "done"
    assert job["params"]["story_id"] == _TEST_STORY_ID


def test_cmd_narrative_record_validation_errors_return_1(capsys):
    from lab.narrative.planner import init_narrative_direction
    # scene_01 no existe en media_blueprint.json -- invalido a proposito.
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": "scene_other", "media_requirement": {"scene_id": "scene_other"}}],
    )
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(scene_ids=["scene_01"])])

    exit_code = _run(cli.cmd_narrative_record)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert out["error"] == "narrative_direction.json inválido"
    assert out["details"]


def test_cmd_narrative_record_does_not_modify_media_blueprint():
    from lab.narrative.planner import init_narrative_direction
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])

    blueprint_before = media_blueprint_path(_TEST_STORY_ID).read_bytes()
    _run(cli.cmd_narrative_record)
    assert media_blueprint_path(_TEST_STORY_ID).read_bytes() == blueprint_before


# --- narrative-review ------------------------------------------------------

def test_cmd_narrative_review_success_returns_0_and_updates_status(capsys):
    from lab.narrative.planner import init_narrative_direction, load
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])

    exit_code = _run(cli.cmd_narrative_review)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["narrative_direction_id"] == "narrative_001"
    assert out["status"] == "READY_FOR_REVIEW"
    assert load(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


def test_cmd_narrative_review_validation_errors_return_1_and_status_unchanged(capsys):
    from lab.narrative.planner import init_narrative_direction, load
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": "scene_other", "media_requirement": {"scene_id": "scene_other"}}],
    )
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(scene_ids=["scene_01"])])

    exit_code = _run(cli.cmd_narrative_review)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "no puede pasar a READY_FOR_REVIEW" in out["error"]
    assert load(_TEST_STORY_ID)["status"] == "DRAFT"


def test_cmd_narrative_review_missing_narrative_direction_returns_1(capsys):
    exit_code = _run(cli.cmd_narrative_review)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


# --- narrative-status --------------------------------------------------------

def test_cmd_narrative_status_missing_narrative_direction_returns_1(capsys):
    exit_code = _run(cli.cmd_narrative_status)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_narrative_status_success_returns_0_and_prints_summary(capsys):
    from lab.narrative.planner import init_narrative_direction
    _setup_blueprint(["scene_01", "scene_02"])
    init_narrative_direction(_TEST_STORY_ID, beats=[
        _valid_beat(beat_id="beat_01", order=1, scene_ids=["scene_01"], emotion="TRAGEDY", narrative_function="LOW_POINT"),
        _valid_beat(beat_id="beat_02", order=2, scene_ids=["scene_02"], emotion="HOPE", narrative_function="RESOLUTION"),
    ])

    exit_code = _run(cli.cmd_narrative_status)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["narrative_direction_id"] == "narrative_001"
    assert out["status"] == "DRAFT"
    assert out["total_beats"] == 2
    assert out["scenes_covered"] == 2
    assert out["emotions_used"] == ["HOPE", "TRAGEDY"]


def test_cmd_narrative_status_does_not_record_job():
    from lab.narrative.planner import init_narrative_direction
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])
    jobs_before = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}

    _run(cli.cmd_narrative_status)

    jobs_after = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}
    assert jobs_after == jobs_before
