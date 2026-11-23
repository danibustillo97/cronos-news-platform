"""
Tests de integracion de los comandos CLI `lab.cli audio-record`,
`audio-review` y `audio-status` -- los wrappers finos que la skill
lab-audio-direction invoca. No vuelve a probar las reglas de validacion
(eso ya lo cubre test_audio_planner.py contra lab.audio.planner
directamente) -- solo que los comandos CLI conectan esa capa
correctamente: llaman al planner real, audio-record registra el job,
audio-review mueve el status, audio-status lee y resume, y ninguno de los
tres toca narrative_direction.json/sequence.json/animation_plan.json/
render_plan.json/media_blueprint.json/asset_registry.json.
"""

import argparse
import json
import shutil

import pytest

import lab.cli as cli
from lab.audio.planner import init_audio_plan
from lab.core.paths import JOBS_DONE_DIR, JOBS_FAILED_DIR
from lab.media.paths import story_media_dir
from lab.narrative.paths import narrative_direction_path
from lab.narrative.planner import init_narrative_direction

_TEST_STORY_ID = "_test_cli_audio_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    # audio-record es el unico de los tres que llama record_job() de verdad
    # -- sin este cleanup, cada corrida de tests dejaria archivos de job
    # reales acumulandose en lab/jobs/done|failed/.
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    jobs_before = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}
    yield
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    for jobs_dir in (JOBS_DONE_DIR, JOBS_FAILED_DIR):
        for path in jobs_dir.glob("*.json"):
            if path.name not in jobs_before:
                path.unlink()


def _valid_narrative_beat(**overrides):
    beat = {
        "beat_id": "beat_01", "order": 1, "scene_ids": ["scene_01"],
        "emotion": "SUSPENSE", "emotional_intensity": "MEDIUM", "narrative_function": "HOOK",
        "pacing_intention": "MEDIUM", "visual_rhythm_intention": "STEADY",
        "motion_intensity_intention": "SUBTLE", "transition_intention": "SOFT",
        "music_intention": "SUSPENSEFUL", "silence_or_emphasis": "NONE",
        "narration_priority": False, "notes": "",
    }
    beat.update(overrides)
    return beat


def _setup_narrative_direction(beats):
    return init_narrative_direction(_TEST_STORY_ID, narrative_direction_id="narrative_001", beats=beats)


def _valid_track(**overrides):
    track = {
        "track_id": "track_01", "role": "MUSIC", "beat_id": "beat_01",
        "fade_in": "SOFT", "fade_out": "NONE", "notes": "",
    }
    track.update(overrides)
    return track


def _run(cmd, story_id=_TEST_STORY_ID):
    return cmd(argparse.Namespace(story_id=story_id))


def _capture_stdout(fn):
    import io
    from contextlib import redirect_stdout
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn()
    return buf.getvalue()


# --- audio-record ----------------------------------------------------

def test_cmd_audio_record_missing_audio_plan_returns_1(capsys):
    exit_code = _run(cli.cmd_audio_record)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_audio_record_success_returns_0_and_prints_summary(capsys):
    _setup_narrative_direction([_valid_narrative_beat(narration_priority=True)])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001",
        tracks=[
            _valid_track(track_id="track_01", role="NARRATION"),
            _valid_track(track_id="track_02", role="MUSIC"),
        ],
    )

    exit_code = _run(cli.cmd_audio_record)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["audio_plan_id"] == "audio_001"
    assert out["narrative_direction_id"] == "narrative_001"
    assert out["total_tracks"] == 2
    assert out["tracks_by_role"] == {"NARRATION": 1, "MUSIC": 1}
    assert out["silence_windows"] == 0
    assert out["status"] == "DRAFT"


def test_cmd_audio_record_records_job():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])
    out_job_id = json.loads(_capture_stdout(lambda: _run(cli.cmd_audio_record)))["job_id"]

    job_path = JOBS_DONE_DIR / f"{out_job_id}.json"
    assert job_path.exists()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    assert job["type"] == "audio_direction"
    assert job["status"] == "done"
    assert job["params"]["story_id"] == _TEST_STORY_ID


def test_cmd_audio_record_validation_errors_return_1(capsys):
    # beat_99 no existe en narrative_direction.json -- invalido a proposito.
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track(beat_id="beat_99")])

    exit_code = _run(cli.cmd_audio_record)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert out["error"] == "audio_plan.json inválido"
    assert out["details"]


def test_cmd_audio_record_does_not_modify_narrative_direction():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])

    before = narrative_direction_path(_TEST_STORY_ID).read_bytes()
    _run(cli.cmd_audio_record)
    assert narrative_direction_path(_TEST_STORY_ID).read_bytes() == before


# --- audio-review ------------------------------------------------------

def test_cmd_audio_review_success_returns_0_and_updates_status(capsys):
    from lab.audio.planner import load
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])

    exit_code = _run(cli.cmd_audio_review)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["audio_plan_id"] == "audio_001"
    assert out["status"] == "READY_FOR_REVIEW"
    assert load(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


def test_cmd_audio_review_validation_errors_return_1_and_status_unchanged(capsys):
    from lab.audio.planner import load
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track(beat_id="beat_99")])

    exit_code = _run(cli.cmd_audio_review)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "no puede pasar a READY_FOR_REVIEW" in out["error"]
    assert load(_TEST_STORY_ID)["status"] == "DRAFT"


def test_cmd_audio_review_missing_audio_plan_returns_1(capsys):
    exit_code = _run(cli.cmd_audio_review)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


# --- audio-status --------------------------------------------------------

def test_cmd_audio_status_missing_audio_plan_returns_1(capsys):
    exit_code = _run(cli.cmd_audio_status)
    assert exit_code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out


def test_cmd_audio_status_success_returns_0_and_prints_summary(capsys):
    _setup_narrative_direction([_valid_narrative_beat(silence_or_emphasis="SILENCE")])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()],
        silence_windows=[{"silence_id": "silence_01", "beat_id": "beat_01", "treatment": "MUSIC_DUCK", "notes": ""}],
    )

    exit_code = _run(cli.cmd_audio_status)
    assert exit_code == 0

    out = json.loads(capsys.readouterr().out)
    assert out["story_id"] == _TEST_STORY_ID
    assert out["status"] == "DRAFT"
    assert out["total_tracks"] == 1
    assert out["tracks_by_role"] == {"MUSIC": 1}
    assert out["silence_windows"] == 1


def test_cmd_audio_status_does_not_record_job():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])
    jobs_before = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}

    _run(cli.cmd_audio_status)

    jobs_after = {p.name for p in JOBS_DONE_DIR.glob("*.json")} | {p.name for p in JOBS_FAILED_DIR.glob("*.json")}
    assert jobs_after == jobs_before
