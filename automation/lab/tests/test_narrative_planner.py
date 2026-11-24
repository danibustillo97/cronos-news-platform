"""
Tests de lab.narrative.planner -- init_narrative_direction()/set_status()
(persistencia) y validate_narrative_direction() (referencias reales a
scene_id, vocabulario cerrado, sin escenas repetidas entre beats, orden
consecutivo). Usa una historia descartable, no toca datos reales.
"""

import shutil

import pytest

from lab.media.blueprint import load as load_blueprint
from lab.media.paths import media_blueprint_path, story_media_dir
from lab.narrative.planner import (
    init_narrative_direction, load, set_status, validate_narrative_direction,
)

_TEST_STORY_ID = "_test_narrative_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    yield
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)


def _setup_blueprint(scene_ids):
    from lab.media.blueprint import init_blueprint
    init_blueprint(
        _TEST_STORY_ID,
        visual_identity={"style_id": "test_style"},
        characters=[],
        references=[],
        scenes=[{"scene_id": sid, "media_requirement": {"scene_id": sid}} for sid in scene_ids],
    )


def _valid_beat(**overrides):
    beat = {
        "beat_id": "beat_01",
        "order": 1,
        "scene_ids": ["scene_01"],
        "emotion": "SUSPENSE",
        "emotional_intensity": "MEDIUM",
        "narrative_function": "HOOK",
        "pacing_intention": "MEDIUM",
        "visual_rhythm_intention": "STEADY",
        "motion_intensity_intention": "SUBTLE",
        "transition_intention": "SOFT",
        "music_intention": "SUSPENSEFUL",
        "silence_or_emphasis": "NONE",
        "narration_priority": True,
        "notes": "",
    }
    beat.update(overrides)
    return beat


# --- init_narrative_direction / set_status -----------------------------------

def test_init_narrative_direction_persists_and_loads():
    _setup_blueprint(["scene_01"])
    narrative_direction = init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])
    assert narrative_direction["status"] == "DRAFT"
    assert narrative_direction["story_id"] == _TEST_STORY_ID
    assert load(_TEST_STORY_ID)["narrative_direction_id"] == "narrative_001"


def test_init_narrative_direction_invalid_status_raises():
    _setup_blueprint(["scene_01"])
    with pytest.raises(ValueError, match="status inválido"):
        init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()], status="BOGUS")


def test_set_status_no_narrative_direction_raises():
    with pytest.raises(ValueError, match="No hay narrative_direction.json"):
        set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")


def test_set_status_invalid_status_raises():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])
    with pytest.raises(ValueError, match="status inválido"):
        set_status(_TEST_STORY_ID, "BOGUS")


def test_set_status_updates_and_persists():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])
    narrative_direction = set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")
    assert narrative_direction["status"] == "READY_FOR_REVIEW"
    assert load(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


# --- validate_narrative_direction --------------------------------------------

def test_validate_no_file_returns_error():
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert len(errors) == 1
    assert "No hay narrative_direction.json" in errors[0]


def test_validate_single_valid_beat_no_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])
    assert validate_narrative_direction(_TEST_STORY_ID) == []


def test_validate_valid_emotional_evolution_no_errors():
    # Evolucion emocional de varios beats, cada uno con su propia escena --
    # el caso de ejemplo del diseno aprobado (no una plantilla obligatoria).
    _setup_blueprint(["scene_01", "scene_02", "scene_03", "scene_04"])
    beats = [
        _valid_beat(beat_id="beat_01", order=1, scene_ids=["scene_01"], emotion="SUSPENSE", narrative_function="HOOK"),
        _valid_beat(beat_id="beat_02", order=2, scene_ids=["scene_02"], emotion="TRAGEDY", narrative_function="LOW_POINT", emotional_intensity="HIGH"),
        _valid_beat(beat_id="beat_03", order=3, scene_ids=["scene_03"], emotion="TURNING_POINT", narrative_function="TURNING_POINT"),
        _valid_beat(beat_id="beat_04", order=4, scene_ids=["scene_04"], emotion="VICTORY", narrative_function="RESOLUTION", pacing_intention="FAST"),
    ]
    init_narrative_direction(_TEST_STORY_ID, beats=beats)
    assert validate_narrative_direction(_TEST_STORY_ID) == []


def test_validate_beat_can_cover_multiple_scenes():
    _setup_blueprint(["scene_01", "scene_02"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(scene_ids=["scene_01", "scene_02"])])
    assert validate_narrative_direction(_TEST_STORY_ID) == []


def test_validate_unknown_scene_id_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(scene_ids=["scene_99"])])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("scene_id" in e and "scene_99" in e for e in errors)


def test_validate_scene_id_repeated_across_beats_errors():
    _setup_blueprint(["scene_01"])
    beats = [
        _valid_beat(beat_id="beat_01", order=1, scene_ids=["scene_01"]),
        _valid_beat(beat_id="beat_02", order=2, scene_ids=["scene_01"]),
    ]
    init_narrative_direction(_TEST_STORY_ID, beats=beats)
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("scene_01" in e and "ya pertenece" in e for e in errors)


def test_validate_empty_scene_ids_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(scene_ids=[])])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("scene_ids no puede estar vacío" in e for e in errors)


def test_validate_invalid_emotion_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(emotion="JOY")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("emotion" in e for e in errors)


def test_validate_invalid_emotional_intensity_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(emotional_intensity="EXTREME")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("emotional_intensity" in e for e in errors)


def test_validate_invalid_narrative_function_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(narrative_function="TWIST")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("narrative_function" in e for e in errors)


def test_validate_invalid_pacing_intention_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(pacing_intention="RUSHED")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("pacing_intention" in e for e in errors)


def test_validate_invalid_visual_rhythm_intention_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(visual_rhythm_intention="CHAOTIC")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("visual_rhythm_intention" in e for e in errors)


def test_validate_invalid_motion_intensity_intention_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(motion_intensity_intention="EXTREME")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("motion_intensity_intention" in e for e in errors)


def test_validate_invalid_transition_intention_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(transition_intention="WHOOSH")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("transition_intention" in e for e in errors)


def test_validate_invalid_music_intention_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(music_intention="HAPPY_POP")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("music_intention" in e for e in errors)


def test_validate_invalid_silence_or_emphasis_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(silence_or_emphasis="MAYBE")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("silence_or_emphasis" in e for e in errors)


def test_validate_narration_priority_not_bool_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat(narration_priority="yes")])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("narration_priority" in e for e in errors)


def test_validate_duplicate_order_errors():
    _setup_blueprint(["scene_01", "scene_02"])
    beats = [
        _valid_beat(beat_id="beat_01", order=1, scene_ids=["scene_01"]),
        _valid_beat(beat_id="beat_02", order=1, scene_ids=["scene_02"]),
    ]
    init_narrative_direction(_TEST_STORY_ID, beats=beats)
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("order" in e for e in errors)


def test_validate_empty_beats_errors():
    _setup_blueprint(["scene_01"])
    init_narrative_direction(_TEST_STORY_ID, beats=[])
    errors = validate_narrative_direction(_TEST_STORY_ID)
    assert any("ningún beat" in e for e in errors)


def test_validate_does_not_modify_media_blueprint():
    _setup_blueprint(["scene_01"])
    before = media_blueprint_path(_TEST_STORY_ID).read_bytes()
    init_narrative_direction(_TEST_STORY_ID, beats=[_valid_beat()])
    validate_narrative_direction(_TEST_STORY_ID)
    after = media_blueprint_path(_TEST_STORY_ID).read_bytes()
    assert before == after
    assert load_blueprint(_TEST_STORY_ID) is not None
