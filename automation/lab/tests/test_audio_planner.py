"""
Tests de lab.audio.planner -- init_audio_plan()/set_status() (persistencia)
y validate_audio_plan() (referencias reales a beat_id de
narrative_direction.json, vocabulario cerrado, sin tracks NARRATION/MUSIC/
SFX/AMBIENCE duplicados por beat, silence_windows consistentes con
silence_or_emphasis, cobertura obligatoria de narración/silencio, y la
regla fija de ducking_rules). Usa una historia descartable, no toca datos
reales.
"""

import shutil

import pytest

from lab.audio.constants import DUCKING_PRIORITY_ORDER
from lab.audio.planner import (
    default_ducking_rules, init_audio_plan, load, set_status, validate_audio_plan,
)
from lab.media.paths import story_media_dir
from lab.narrative.planner import init_narrative_direction

_TEST_STORY_ID = "_test_audio_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    yield
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)


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


# --- init_audio_plan / set_status --------------------------------------------

def test_init_audio_plan_persists_and_loads():
    _setup_narrative_direction([_valid_narrative_beat()])
    audio_plan = init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()],
    )
    assert audio_plan["status"] == "DRAFT"
    assert audio_plan["story_id"] == _TEST_STORY_ID
    assert audio_plan["audio_plan_id"] == "audio_001"
    assert load(_TEST_STORY_ID)["narrative_direction_id"] == "narrative_001"


def test_init_audio_plan_defaults_ducking_rules():
    _setup_narrative_direction([_valid_narrative_beat()])
    audio_plan = init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])
    assert audio_plan["ducking_rules"] == {"priority_order": list(DUCKING_PRIORITY_ORDER)}
    assert audio_plan["ducking_rules"] == default_ducking_rules()


def test_init_audio_plan_invalid_status_raises():
    _setup_narrative_direction([_valid_narrative_beat()])
    with pytest.raises(ValueError, match="status inválido"):
        init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[], status="BOGUS")


def test_set_status_no_audio_plan_raises():
    with pytest.raises(ValueError, match="No hay audio_plan.json"):
        set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")


def test_set_status_invalid_status_raises():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])
    with pytest.raises(ValueError, match="status inválido"):
        set_status(_TEST_STORY_ID, "BOGUS")


def test_set_status_updates_and_persists():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])
    audio_plan = set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")
    assert audio_plan["status"] == "READY_FOR_REVIEW"
    assert load(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


# --- validate_audio_plan: estructura valida ----------------------------------

def test_validate_no_file_returns_error():
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert len(errors) == 1
    assert "No hay audio_plan.json" in errors[0]


def test_validate_no_narrative_direction_returns_error():
    # audio_plan.json existe pero narrative_direction.json no -- referencia rota.
    from lab.audio.planner import _save
    _save(_TEST_STORY_ID, {
        "audio_plan_id": "audio_001", "narrative_direction_id": "narrative_001",
        "story_id": _TEST_STORY_ID, "status": "DRAFT", "tracks": [], "silence_windows": [],
        "ducking_rules": default_ducking_rules(), "created_at": "2026-01-01T00:00:00+00:00",
    })
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("no hay narrative_direction.json" in e for e in errors)


def test_validate_empty_tracks_and_silence_valid_when_narrative_needs_neither():
    # Historia sin narracion prioritaria ni silencio declarado -- un
    # audio_plan sin tracks ni silence_windows es una salida valida.
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[])
    assert validate_audio_plan(_TEST_STORY_ID) == []


def test_validate_full_valid_plan_no_errors():
    _setup_narrative_direction([
        _valid_narrative_beat(beat_id="beat_01", order=1, narration_priority=True),
        _valid_narrative_beat(beat_id="beat_02", order=2, silence_or_emphasis="SILENCE", emotion="LOW_POINT"),
    ])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001",
        tracks=[
            _valid_track(track_id="track_01", role="NARRATION", beat_id="beat_01"),
            _valid_track(track_id="track_02", role="MUSIC", beat_id="beat_01"),
        ],
        silence_windows=[{"silence_id": "silence_01", "beat_id": "beat_02", "treatment": "MUSIC_DUCK", "notes": ""}],
    )
    assert validate_audio_plan(_TEST_STORY_ID) == []


def test_validate_narrative_direction_id_mismatch_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_999", tracks=[])
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("narrative_direction_id" in e for e in errors)


# --- referencias invalidas ----------------------------------------------------

def test_validate_track_unknown_beat_id_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001",
        tracks=[_valid_track(beat_id="beat_99")],
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("beat_id" in e and "beat_99" in e for e in errors)


def test_validate_silence_window_unknown_beat_id_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[],
        silence_windows=[{"silence_id": "silence_01", "beat_id": "beat_99", "treatment": "FULL_SILENCE", "notes": ""}],
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("beat_id" in e and "beat_99" in e for e in errors)


# --- duplicados ---------------------------------------------------------------

def test_validate_duplicate_track_id_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001",
        tracks=[
            _valid_track(track_id="track_01", role="MUSIC"),
            _valid_track(track_id="track_01", role="AMBIENCE"),
        ],
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("track_id" in e and "repetido" in e for e in errors)


def test_validate_duplicate_role_for_same_beat_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001",
        tracks=[
            _valid_track(track_id="track_01", role="MUSIC", beat_id="beat_01"),
            _valid_track(track_id="track_02", role="MUSIC", beat_id="beat_01"),
        ],
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("ya existe un track" in e for e in errors)


def test_validate_duplicate_silence_id_errors():
    _setup_narrative_direction([_valid_narrative_beat(silence_or_emphasis="SILENCE")])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[],
        silence_windows=[
            {"silence_id": "silence_01", "beat_id": "beat_01", "treatment": "FULL_SILENCE", "notes": ""},
            {"silence_id": "silence_01", "beat_id": "beat_01", "treatment": "MUSIC_DUCK", "notes": ""},
        ],
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("silence_id" in e and "repetido" in e for e in errors)


# --- valores invalidos ---------------------------------------------------------

def test_validate_invalid_role_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track(role="VOICEOVER")])
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("role" in e for e in errors)


def test_validate_invalid_fade_in_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track(fade_in="INSTANT")])
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("fade_in" in e for e in errors)


def test_validate_invalid_fade_out_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track(fade_out="INSTANT")])
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("fade_out" in e for e in errors)


def test_validate_invalid_treatment_errors():
    _setup_narrative_direction([_valid_narrative_beat(silence_or_emphasis="SILENCE")])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[],
        silence_windows=[{"silence_id": "silence_01", "beat_id": "beat_01", "treatment": "MUTE", "notes": ""}],
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("treatment" in e for e in errors)


# --- relaciones inconsistentes -------------------------------------------------

def test_validate_silence_window_on_beat_without_silence_intention_errors():
    _setup_narrative_direction([_valid_narrative_beat(silence_or_emphasis="NONE")])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[],
        silence_windows=[{"silence_id": "silence_01", "beat_id": "beat_01", "treatment": "FULL_SILENCE", "notes": ""}],
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("silence_or_emphasis" in e for e in errors)


# --- silencio como decision valida (cobertura obligatoria) ---------------------

def test_validate_silence_window_on_emphasis_beat_is_valid():
    _setup_narrative_direction([_valid_narrative_beat(silence_or_emphasis="EMPHASIS")])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[],
        silence_windows=[{"silence_id": "silence_01", "beat_id": "beat_01", "treatment": "MUSIC_DUCK", "notes": ""}],
    )
    assert validate_audio_plan(_TEST_STORY_ID) == []


def test_validate_emphasis_beat_without_silence_window_is_still_valid():
    # EMPHASIS no es obligatorio (a diferencia de SILENCE) -- puede sostener
    # musica/ambiente sin necesitar su propia ventana.
    _setup_narrative_direction([_valid_narrative_beat(silence_or_emphasis="EMPHASIS")])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[])
    assert validate_audio_plan(_TEST_STORY_ID) == []


def test_validate_silence_beat_without_silence_window_errors():
    _setup_narrative_direction([_valid_narrative_beat(silence_or_emphasis="SILENCE")])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[])
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("SILENCE" in e and "no hay ninguna silence_window" in e for e in errors)


def test_validate_narration_priority_beat_without_narration_track_errors():
    _setup_narrative_direction([_valid_narrative_beat(narration_priority=True)])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[])
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("narration_priority=true" in e and "no hay ningún track NARRATION" in e for e in errors)


def test_validate_narration_priority_beat_with_narration_track_is_valid():
    _setup_narrative_direction([_valid_narrative_beat(narration_priority=True)])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001",
        tracks=[_valid_track(role="NARRATION", beat_id="beat_01")],
    )
    assert validate_audio_plan(_TEST_STORY_ID) == []


# --- prioridades de mezcla ------------------------------------------------------

def test_validate_ducking_rules_wrong_order_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(
        _TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[],
        ducking_rules={"priority_order": ["MUSIC", "NARRATION", "SFX", "AMBIENCE"]},
    )
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("priority_order" in e for e in errors)


def test_validate_ducking_rules_missing_key_errors():
    _setup_narrative_direction([_valid_narrative_beat()])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[], ducking_rules={})
    errors = validate_audio_plan(_TEST_STORY_ID)
    assert any("priority_order" in e for e in errors)


# --- no modifica narrative_direction.json --------------------------------------

def test_validate_does_not_modify_narrative_direction():
    from lab.narrative.paths import narrative_direction_path
    _setup_narrative_direction([_valid_narrative_beat()])
    before = narrative_direction_path(_TEST_STORY_ID).read_bytes()
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[_valid_track()])
    validate_audio_plan(_TEST_STORY_ID)
    after = narrative_direction_path(_TEST_STORY_ID).read_bytes()
    assert before == after
