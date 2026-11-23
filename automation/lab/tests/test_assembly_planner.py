"""
Tests de lab.assembly.planner -- funciones puras (classify_disposition,
resolve_transition_execution, build_assembly_shot) y el flujo completo
(init_assembly_plan/validate_assembly_plan) contra un render_plan.json real
(los shots INCLUDED necesitan que rendered_video_path() exista de verdad
en disco para validar limpio -- se arma con el mismo camino real que
test_renderer.py: blueprint -> sequence -> animation_plan -> render_plan ->
process_render_plan (FFmpeg real, imagen PNG minuscula generada con
Pillow)). No se mockea lo que se puede probar real, mismo criterio que el
resto de LAB.
"""

import shutil

import pytest

from lab.animation.planner import init_animation_plan
from lab.assembly.constants import TRANSITION_APPLIED_VALUES
from lab.assembly.paths import assembly_plan_path
from lab.assembly.planner import (
    build_assembly_shot, classify_disposition, init_assembly_plan, load,
    resolve_transition_execution, set_status, validate_assembly_plan,
)
from lab.audio.planner import init_audio_plan
from lab.media.blueprint import init_blueprint
from lab.media.paths import asset_registry_path, media_blueprint_path, sequence_path, story_media_dir
from lab.media.registry import register_asset
from lab.narrative.planner import init_narrative_direction
from lab.render.planner import init_render_plan
from lab.render.renderer import process_render_plan
from lab.sequence.planner import init_sequence

_TEST_STORY_ID = "_test_assembly_story"


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


def _setup_animation_plan(shots, target_aspect_ratio="9:16"):
    scene_ids = sorted({s["scene_id"] for s in shots})
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": sid, "media_requirement": {"scene_id": sid}} for sid in scene_ids],
    )
    init_sequence(
        _TEST_STORY_ID, sequence_id="seq_001", target_format="REEL", target_aspect_ratio=target_aspect_ratio,
        narrative_structure="HOOK -> CLOSING", shots=shots,
    )
    return init_animation_plan(_TEST_STORY_ID)


def _register_real_asset(asset_id, scene_id="scene_02", width=64, height=64):
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


# --- classify_disposition (funcion pura, sin I/O) ----------------------------

def test_classify_disposition_no_asset_excluded():
    disposition, reason = classify_disposition({"asset_id": None, "status": "PENDING"})
    assert disposition == "EXCLUDED_NO_ASSET"
    assert "texto-only" in reason


def test_classify_disposition_done_included():
    disposition, reason = classify_disposition({"asset_id": "img_001", "status": "DONE"})
    assert disposition == "INCLUDED"
    assert reason == ""


def test_classify_disposition_pending_blocked():
    disposition, reason = classify_disposition({"asset_id": "img_001", "status": "PENDING"})
    assert disposition == "BLOCKED_NOT_RENDERED"
    assert "PENDING" in reason


def test_classify_disposition_failed_blocked():
    disposition, reason = classify_disposition({"asset_id": "img_001", "status": "FAILED", "error": "boom"})
    assert disposition == "BLOCKED_NOT_RENDERED"
    assert "FAILED" in reason and "boom" in reason


# --- resolve_transition_execution (funcion pura, sin I/O) --------------------

def test_resolve_transition_none_no_downgrade():
    assert resolve_transition_execution("NONE") == {"declared": "NONE", "applied": "CUT", "downgraded": False}


def test_resolve_transition_cut_no_downgrade():
    assert resolve_transition_execution("CUT") == {"declared": "CUT", "applied": "CUT", "downgraded": False}


def test_resolve_transition_fade_downgraded():
    result = resolve_transition_execution("FADE")
    assert result["applied"] == "CUT"
    assert result["downgraded"] is True
    assert result["applied"] in TRANSITION_APPLIED_VALUES


def test_resolve_transition_dissolve_downgraded():
    result = resolve_transition_execution("DISSOLVE")
    assert result["applied"] == "CUT"
    assert result["downgraded"] is True


# --- build_assembly_shot (funcion pura, sin I/O) -----------------------------

def _render_shot(**overrides):
    shot = {
        "render_shot_id": "render_shot_01", "animation_shot_id": "anim_shot_01",
        "shot_id": "shot_01", "scene_id": "scene_01", "asset_id": None,
        "order": 1, "duration_seconds": 3.0, "status": "PENDING",
    }
    shot.update(overrides)
    return shot


def _animation_shot(**overrides):
    shot = {
        "animation_shot_id": "anim_shot_01", "motion": {"type": "SLOW_ZOOM_IN"},
        "transition_in": "FADE", "transition_out": "CUT",
    }
    shot.update(overrides)
    return shot


def test_build_assembly_shot_included_carries_motion_and_transition():
    render_shot = _render_shot(asset_id="img_001", status="DONE")
    result = build_assembly_shot(render_shot, _animation_shot())
    assert result["disposition"] == "INCLUDED"
    assert result["source_video_path"] == "videos/rendered/render_shot_01.mp4"
    assert result["motion"] == {"declared_type": "SLOW_ZOOM_IN", "applied": "STATIC", "reason": result["motion"]["reason"]}
    assert result["transition_in"]["downgraded"] is True
    assert result["transition_out"]["downgraded"] is False


def test_build_assembly_shot_excluded_no_asset_has_null_fields():
    result = build_assembly_shot(_render_shot(asset_id=None), _animation_shot())
    assert result["disposition"] == "EXCLUDED_NO_ASSET"
    assert result["source_video_path"] is None
    assert result["motion"] is None
    assert result["transition_in"] is None
    assert result["transition_out"] is None


def test_build_assembly_shot_missing_animation_shot_is_blocked():
    result = build_assembly_shot(_render_shot(asset_id="img_001", status="DONE"), None)
    assert result["disposition"] == "BLOCKED_NOT_RENDERED"
    assert "referencia rota" in result["disposition_reason"]
    assert result["source_video_path"] is None


# --- init_assembly_plan / set_status -----------------------------------------

def test_init_assembly_plan_no_render_plan_raises():
    with pytest.raises(ValueError, match="render_plan.json"):
        init_assembly_plan(_TEST_STORY_ID)


def test_init_assembly_plan_no_animation_plan_raises(monkeypatch):
    # render_plan.json sin animation_plan.json real es un estado
    # inalcanzable por el flujo normal (render_plan se deriva de
    # animation_plan) -- se fuerza escribiendo render_plan.json a mano.
    from lab.render.paths import render_plan_path
    render_plan_path(_TEST_STORY_ID).parent.mkdir(parents=True, exist_ok=True)
    render_plan_path(_TEST_STORY_ID).write_text(
        '{"render_plan_id": "render_001", "animation_plan_id": "anim_001", "story_id": "'
        + _TEST_STORY_ID + '", "target_aspect_ratio": "9:16", "target_width": 1080, '
        '"target_height": 1920, "status": "DRAFT", "shots": [], "created_at": "2026-01-01T00:00:00+00:00"}',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="animation_plan.json"):
        init_assembly_plan(_TEST_STORY_ID)


def test_init_assembly_plan_full_chain_persists_and_loads():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1),
        _sequence_shot(
            shot_id="shot_02", scene_id="scene_02", order=2, asset_id="img_001",
            duration_seconds=4.0, transition_in="FADE",
            transform_required=True, suggested_transform="EXTEND",
        ),
    ])
    _register_real_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    process_render_plan(_TEST_STORY_ID)  # FFmpeg real -- shot_02 queda DONE

    plan = init_assembly_plan(_TEST_STORY_ID)

    assert plan["status"] == "DRAFT"
    assert plan["story_id"] == _TEST_STORY_ID
    assert plan["narrative_direction_id"] is None
    assert plan["audio_plan_id"] is None
    assert plan["output"] == {"status": "PENDING", "relative_path": None, "error": None}
    assert plan["declared_total_duration_seconds"] == 5.0
    assert plan["included_duration_seconds"] == 4.0
    assert load(_TEST_STORY_ID)["assembly_plan_id"] == "assembly_001"

    shot_01 = next(s for s in plan["shots"] if s["shot_id"] == "shot_01")
    assert shot_01["disposition"] == "EXCLUDED_NO_ASSET"
    shot_02 = next(s for s in plan["shots"] if s["shot_id"] == "shot_02")
    assert shot_02["disposition"] == "INCLUDED"
    assert shot_02["transition_in"]["downgraded"] is True


def test_init_assembly_plan_references_narrative_and_audio_when_present():
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)

    init_narrative_direction(_TEST_STORY_ID, narrative_direction_id="narrative_001", beats=[{
        "beat_id": "beat_01", "order": 1, "scene_ids": ["scene_01"],
        "emotion": "SUSPENSE", "emotional_intensity": "MEDIUM", "narrative_function": "HOOK",
        "pacing_intention": "MEDIUM", "visual_rhythm_intention": "STEADY",
        "motion_intensity_intention": "SUBTLE", "transition_intention": "SOFT",
        "music_intention": "SUSPENSEFUL", "silence_or_emphasis": "NONE",
        "narration_priority": False, "notes": "",
    }])
    init_audio_plan(_TEST_STORY_ID, narrative_direction_id="narrative_001", tracks=[])

    plan = init_assembly_plan(_TEST_STORY_ID)
    assert plan["narrative_direction_id"] == "narrative_001"
    assert plan["audio_plan_id"] == "audio_001"


def test_set_status_no_assembly_plan_raises():
    with pytest.raises(ValueError, match="No hay assembly_plan.json"):
        set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")


def test_set_status_invalid_status_raises():
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)
    with pytest.raises(ValueError, match="status inválido"):
        set_status(_TEST_STORY_ID, "BOGUS")


def test_set_status_updates_and_persists():
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)
    plan = set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")
    assert plan["status"] == "READY_FOR_REVIEW"
    assert load(_TEST_STORY_ID)["status"] == "READY_FOR_REVIEW"


# --- validate_assembly_plan ---------------------------------------------------

def test_validate_no_file_returns_error():
    errors = validate_assembly_plan(_TEST_STORY_ID)
    assert len(errors) == 1
    assert "No hay assembly_plan.json" in errors[0]


def test_validate_happy_path_no_errors():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1),
        _sequence_shot(shot_id="shot_02", scene_id="scene_02", order=2, asset_id="img_001"),
    ])
    _register_real_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    process_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)
    assert validate_assembly_plan(_TEST_STORY_ID) == []


def test_validate_disposition_drift_after_render_plan_changes_errors():
    # Se planifica ANTES de renderizar (shot_02 queda BLOCKED_NOT_RENDERED
    # en el plan) -- despues se renderiza de verdad, pero no se replanifica.
    # validate_assembly_plan() debe detectar el desfase contra el
    # render_plan.json actual, no el de cuando se planifico.
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001"),
    ])
    _register_real_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)  # todavia PENDING -> BLOCKED_NOT_RENDERED

    process_render_plan(_TEST_STORY_ID)  # ahora DONE de verdad

    errors = validate_assembly_plan(_TEST_STORY_ID)
    assert any("disposition" in e and "replanificar" in e for e in errors)


def test_validate_missing_clip_on_disk_for_included_shot_errors():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001"),
    ])
    _register_real_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    process_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)

    from lab.render.paths import rendered_video_path
    rendered_video_path(_TEST_STORY_ID, "render_shot_01").unlink()

    errors = validate_assembly_plan(_TEST_STORY_ID)
    assert any("no existe" in e for e in errors)


def test_validate_render_plan_id_mismatch_errors():
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)

    plan = load(_TEST_STORY_ID)
    plan["render_plan_id"] = "render_999"
    assembly_plan_path(_TEST_STORY_ID).write_text(__import__("json").dumps(plan), encoding="utf-8")

    errors = validate_assembly_plan(_TEST_STORY_ID)
    assert any("render_plan_id" in e for e in errors)


def test_validate_order_mismatch_errors():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1),
        _sequence_shot(shot_id="shot_02", scene_id="scene_02", order=2),
    ])
    init_render_plan(_TEST_STORY_ID)
    init_assembly_plan(_TEST_STORY_ID)

    plan = load(_TEST_STORY_ID)
    plan["shots"][0], plan["shots"][1] = plan["shots"][1], plan["shots"][0]
    import json as _json
    assembly_plan_path(_TEST_STORY_ID).write_text(_json.dumps(plan), encoding="utf-8")

    errors = validate_assembly_plan(_TEST_STORY_ID)
    assert any("orden" in e for e in errors)


# --- no modifica artifacts upstream ------------------------------------------

def test_does_not_modify_upstream_artifacts():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001",
                       transform_required=True, suggested_transform="EXTEND"),
    ])
    _register_real_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    process_render_plan(_TEST_STORY_ID)

    import hashlib
    def h(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    seq_before = h(sequence_path(_TEST_STORY_ID))
    registry_before = h(asset_registry_path(_TEST_STORY_ID))
    blueprint_before = h(media_blueprint_path(_TEST_STORY_ID))
    from lab.animation.paths import animation_plan_path
    from lab.render.paths import render_plan_path
    anim_before = h(animation_plan_path(_TEST_STORY_ID))
    render_before = h(render_plan_path(_TEST_STORY_ID))

    init_assembly_plan(_TEST_STORY_ID)
    validate_assembly_plan(_TEST_STORY_ID)

    assert h(sequence_path(_TEST_STORY_ID)) == seq_before
    assert h(asset_registry_path(_TEST_STORY_ID)) == registry_before
    assert h(media_blueprint_path(_TEST_STORY_ID)) == blueprint_before
    assert h(animation_plan_path(_TEST_STORY_ID)) == anim_before
    assert h(render_plan_path(_TEST_STORY_ID)) == render_before
    # assembly_plan.json SI cambia -- es su propio artifact, por diseño.
    assert assembly_plan_path(_TEST_STORY_ID).exists()
