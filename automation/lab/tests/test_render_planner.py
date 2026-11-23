"""
Tests de lab.render.planner -- geometria de escalado (compute_transform_geometry,
solo para CROP/FIT/EXTEND; COMPOSE/UNKNOWN quedan computable=false),
coherencia de referencias contra animation_plan.json real, orden identico,
status siempre PENDING, y que la capa nunca crea assets ni escribe
sequence.json/asset_registry.json/animation_plan.json.

Usa una historia descartable -- no toca datos reales de ninguna historia
existente en el workspace.
"""

import json
import shutil

import pytest

from lab.animation.planner import init_animation_plan
from lab.media.blueprint import init_blueprint
from lab.media.paths import asset_registry_path, media_blueprint_path, sequence_path, story_media_dir
from lab.media.registry import register_asset
from lab.render.constants import GEOMETRY_COMPUTABLE_TRANSFORMS, TARGET_DIMENSIONS
from lab.render.paths import render_plan_path
from lab.render.planner import (
    compute_target_dimensions, compute_transform_geometry, init_render_plan, load, set_status, validate_render_plan,
)
from lab.sequence.planner import init_sequence

_TEST_STORY_ID = "_test_render_story"


@pytest.fixture(autouse=True)
def _clean_test_story():
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)
    yield
    shutil.rmtree(story_media_dir(_TEST_STORY_ID), ignore_errors=True)


def _sequence_shot(**overrides):
    shot = {
        "shot_id": "shot_01", "scene_id": "scene_01", "asset_id": None,
        "order": 1, "duration_seconds": 3.0, "framing": "test",
        "motion": "STATIC", "transition_in": "NONE", "transition_out": "CUT",
        "purpose": "hook", "notes": "",
        "transform_required": None, "suggested_transform": None,
    }
    shot.update(overrides)
    return shot


def _register_asset(asset_id, width=1024, height=1024):
    return register_asset(
        _TEST_STORY_ID, asset_id=asset_id, scene_id="scene_02", type_="image", subtype="generated",
        filename=f"{asset_id}.jpeg", relative_path=f"images/generated/{asset_id}.jpeg",
        mime_type="image/jpeg", width=width, height=height, requested_aspect_ratio="9:16",
        source=None, provider="cloudflare", model="@cf/black-forest-labs/flux-1-schnell",
        prompt_version=1, parent_asset_id=None, references=[], provenance="AI_GENERATED", status="READY",
    )


def _setup_animation_plan(shots):
    scene_ids = sorted({s["scene_id"] for s in shots})
    init_blueprint(
        _TEST_STORY_ID, visual_identity={"style_id": "test"}, characters=[], references=[],
        scenes=[{"scene_id": sid, "media_requirement": {"scene_id": sid}} for sid in scene_ids],
    )
    init_sequence(
        _TEST_STORY_ID, sequence_id="seq_001", target_format="REEL", target_aspect_ratio="9:16",
        narrative_structure="HOOK -> CLOSING", shots=shots,
    )
    return init_animation_plan(_TEST_STORY_ID)


# --- compute_target_dimensions / compute_transform_geometry -----------------

def test_compute_target_dimensions_known_ratio():
    assert compute_target_dimensions("9:16") == (1080, 1920)
    assert compute_target_dimensions("1:1") == (1080, 1080)


def test_compute_target_dimensions_unknown_falls_back_to_default():
    assert compute_target_dimensions("21:9") == (1080, 1080)


def test_compute_transform_geometry_extend_matches_real_case():
    # Caso real: img_001 (793ff158b714) es 1024x1024, target 9:16 -> 1080x1920.
    geometry = compute_transform_geometry(1024, 1024, 1080, 1920, "EXTEND")
    assert geometry["computable"] is True
    assert geometry["operation"] == "PAD"
    assert geometry["scaled_width"] == 1080
    assert geometry["scaled_height"] == 1080
    assert geometry["pad_top"] == 420
    assert geometry["pad_bottom"] == 420
    assert geometry["pad_left"] == 0
    assert geometry["pad_right"] == 0


def test_compute_transform_geometry_fit_same_as_extend_geometry():
    extend = compute_transform_geometry(1024, 1024, 1080, 1920, "EXTEND")
    fit = compute_transform_geometry(1024, 1024, 1080, 1920, "FIT")
    assert extend["operation"] == fit["operation"] == "PAD"
    assert extend["scaled_width"] == fit["scaled_width"]


def test_compute_transform_geometry_crop_fills_target_and_crops_excess():
    geometry = compute_transform_geometry(1024, 1024, 1080, 1920, "CROP")
    assert geometry["computable"] is True
    assert geometry["operation"] == "CROP"
    assert geometry["scaled_width"] == 1920
    assert geometry["scaled_height"] == 1920
    assert geometry["crop_left"] == 420
    assert geometry["crop_right"] == 420
    assert geometry["crop_top"] == 0
    assert geometry["crop_bottom"] == 0


@pytest.mark.parametrize("transform_type", ["COMPOSE", "UNKNOWN"])
def test_compute_transform_geometry_not_computable_for_editorial_transforms(transform_type):
    geometry = compute_transform_geometry(1024, 1024, 1080, 1920, transform_type)
    assert geometry == {"type": transform_type, "computable": False}


def test_geometry_computable_transforms_matches_expected_set():
    assert GEOMETRY_COMPUTABLE_TRANSFORMS == {"CROP", "FIT", "EXTEND"}


# --- init_render_plan / set_status -------------------------------------------

def test_init_render_plan_no_animation_plan_raises():
    with pytest.raises(ValueError, match="No hay animation_plan.json"):
        init_render_plan(_TEST_STORY_ID)


def test_init_render_plan_computes_target_dimensions_and_persists():
    _setup_animation_plan([_sequence_shot()])
    plan = init_render_plan(_TEST_STORY_ID)
    assert plan["target_width"] == 1080
    assert plan["target_height"] == 1920
    assert plan["animation_plan_id"] == "anim_001"
    assert plan["status"] == "DRAFT"
    assert load(_TEST_STORY_ID)["render_plan_id"] == "render_001"


def test_init_render_plan_real_case_shot_with_extend_transform():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1),
        _sequence_shot(
            shot_id="shot_02", scene_id="scene_02", order=2, asset_id="img_001",
            motion="SLOW_ZOOM_IN", transform_required=True, suggested_transform="EXTEND",
        ),
    ])
    _register_asset("img_001", width=1024, height=1024)

    plan = init_render_plan(_TEST_STORY_ID)
    shot_02 = next(s for s in plan["shots"] if s["shot_id"] == "shot_02")
    assert shot_02["backend"] == "FFMPEG_LOCAL"
    assert shot_02["transform_geometry"]["computable"] is True
    assert shot_02["transform_geometry"]["pad_top"] == 420
    assert shot_02["status"] == "PENDING"

    shot_01 = next(s for s in plan["shots"] if s["shot_id"] == "shot_01")
    assert shot_01["transform_geometry"] is None


def test_set_status_no_plan_raises():
    with pytest.raises(ValueError, match="No hay render_plan.json"):
        set_status(_TEST_STORY_ID, "READY_FOR_REVIEW")


def test_set_status_invalid_status_raises():
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    with pytest.raises(ValueError, match="status inválido"):
        set_status(_TEST_STORY_ID, "BOGUS")


# --- validate_render_plan ------------------------------------------------------

def test_validate_no_file_returns_error():
    errors = validate_render_plan(_TEST_STORY_ID)
    assert len(errors) == 1
    assert "No hay render_plan.json" in errors[0]


def test_validate_happy_path_no_errors():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1),
        _sequence_shot(
            shot_id="shot_02", scene_id="scene_02", order=2, asset_id="img_001",
            motion="SLOW_ZOOM_IN", transform_required=True, suggested_transform="EXTEND",
        ),
    ])
    _register_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    assert validate_render_plan(_TEST_STORY_ID) == []


def test_validate_unknown_animation_shot_id_errors():
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["animation_shot_id"] = "anim_shot_99"
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("anim_shot_99" in e for e in errors)


def test_validate_divergent_backend_errors():
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["backend"] = "AI_VIDEO"
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("backend" in e for e in errors)


def test_validate_transform_geometry_present_when_not_needed_errors():
    _setup_animation_plan([_sequence_shot()])  # sin transform, sin asset
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["transform_geometry"] = {"type": "EXTEND", "computable": True}
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("no se requiere transform_geometry" in e for e in errors)


def test_validate_transform_geometry_missing_when_needed_errors():
    _setup_animation_plan([
        _sequence_shot(asset_id="img_001", transform_required=True, suggested_transform="EXTEND"),
    ])
    _register_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["transform_geometry"] = None
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("se requiere transform_geometry" in e for e in errors)


def test_validate_computable_mismatch_errors():
    _setup_animation_plan([
        _sequence_shot(asset_id="img_001", transform_required=True, suggested_transform="EXTEND"),
    ])
    _register_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["transform_geometry"]["computable"] = False
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("computable=False" in e for e in errors)


def test_validate_negative_pad_errors():
    _setup_animation_plan([
        _sequence_shot(asset_id="img_001", transform_required=True, suggested_transform="EXTEND"),
    ])
    _register_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["transform_geometry"]["pad_top"] = -5
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("pad_top" in e for e in errors)


# --- Regla 6 (status PENDING/DONE/FAILED) -- corregida en Fase 5/Export:
# esta regla exigia status=='PENDING' siempre, escrita antes de que
# existiera Etapa 5 (Renderer real). No se actualizo al agregar ejecucion
# real, asi que cualquier llamada a validate_render_plan() DESPUES de
# render-execute (como hace lab.export.planner) rechazaba un
# render_plan.json perfectamente valido -- ver docs/LAB_RENDER_ENGINE.md
# y el hallazgo documentado en el reporte de Fase 5.

def test_validate_freshly_planned_pending_is_still_valid():
    """1. Un render_plan.json recien planificado (todos los shots PENDING,
    sin output_path/error todavia) sigue siendo valido -- comportamiento
    original sin cambios."""
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    assert validate_render_plan(_TEST_STORY_ID) == []
    assert load(_TEST_STORY_ID)["shots"][0]["status"] == "PENDING"


def test_validate_post_execution_done_and_failed_are_valid():
    """2. Un render_plan.json post-ejecucion, con shots DONE/FAILED reales
    (misma forma exacta que produce lab.render.renderer.process_render_plan)
    sigue siendo valido -- ya no se rechaza."""
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001"),
        _sequence_shot(shot_id="shot_02", scene_id="scene_02", order=2, asset_id="img_002"),
    ])
    _register_asset("img_001")
    _register_asset("img_002")
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["status"] = "DONE"
    plan["shots"][0]["output_path"] = "videos/rendered/render_shot_01.mp4"
    plan["shots"][0]["error"] = None
    plan["shots"][1]["status"] = "FAILED"
    plan["shots"][1]["output_path"] = None
    plan["shots"][1]["error"] = "FFmpeg terminó con error: ..."
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")

    assert validate_render_plan(_TEST_STORY_ID) == []


def test_validate_real_renderer_output_is_valid():
    """2b. Mismo caso, pero con FFmpeg real (lab.render.renderer), no un
    dict armado a mano -- confirma que el fix acepta exactamente lo que el
    Renderer de verdad produce."""
    from lab.render.renderer import process_render_plan
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1, asset_id="img_001"),
    ])
    from PIL import Image
    relative_path = "images/generated/img_001.png"
    absolute_path = story_media_dir(_TEST_STORY_ID) / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (64, 64), color=(90, 130, 200)).save(absolute_path, format="PNG")
    register_asset(
        _TEST_STORY_ID, asset_id="img_001", scene_id="scene_01", type_="image", subtype="generated",
        filename="img_001.png", relative_path=relative_path,
        mime_type="image/png", width=64, height=64, requested_aspect_ratio="9:16",
        source=None, provider="cloudflare", model="@cf/black-forest-labs/flux-1-schnell",
        prompt_version=1, parent_asset_id=None, references=[], provenance="AI_GENERATED", status="READY",
    )
    init_render_plan(_TEST_STORY_ID)
    process_render_plan(_TEST_STORY_ID)  # FFmpeg real

    assert load(_TEST_STORY_ID)["shots"][0]["status"] == "DONE"
    assert validate_render_plan(_TEST_STORY_ID) == []


def test_validate_invalid_status_value_errors():
    """3a. Un status fuera del vocabulario cerrado sigue fallando."""
    _setup_animation_plan([_sequence_shot()])
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["status"] = "RENDERING"
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("inválido" in e for e in errors)


def test_validate_done_without_output_path_errors():
    """3b. DONE mal formado (sin output_path real) sigue fallando -- el fix
    no relaja la forma exigida, solo agrega DONE/FAILED como valores
    aceptables cuando vienen bien formados."""
    _setup_animation_plan([_sequence_shot(asset_id="img_001")])
    _register_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["status"] = "DONE"
    plan["shots"][0]["output_path"] = None
    plan["shots"][0]["error"] = None
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("output_path" in e for e in errors)


def test_validate_failed_without_error_message_errors():
    """3c. FAILED mal formado (sin error real) sigue fallando."""
    _setup_animation_plan([_sequence_shot(asset_id="img_001")])
    _register_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["status"] = "FAILED"
    plan["shots"][0]["output_path"] = None
    plan["shots"][0]["error"] = None
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("error" in e for e in errors)


def test_validate_pending_with_populated_output_path_errors():
    """3d. PENDING con output_path poblado (inconsistente) sigue fallando."""
    _setup_animation_plan([_sequence_shot(asset_id="img_001")])
    _register_asset("img_001")
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["output_path"] = "videos/rendered/render_shot_01.mp4"
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("PENDING" in e and "output_path" in e for e in errors)


def test_validate_order_mismatch_errors():
    _setup_animation_plan([
        _sequence_shot(shot_id="shot_01", scene_id="scene_01", order=1),
        _sequence_shot(shot_id="shot_02", scene_id="scene_02", order=2),
    ])
    init_render_plan(_TEST_STORY_ID)
    plan = load(_TEST_STORY_ID)
    plan["shots"][0]["order"], plan["shots"][1]["order"] = 2, 1
    render_plan_path(_TEST_STORY_ID).write_text(json.dumps(plan), encoding="utf-8")
    errors = validate_render_plan(_TEST_STORY_ID)
    assert any("orden" in e for e in errors)


# --- aislamiento: no crea assets, no toca sequence/animation_plan/blueprint/registry --

def test_does_not_touch_sequence_animation_plan_blueprint_or_registry():
    _setup_animation_plan([
        _sequence_shot(asset_id="img_001", transform_required=True, suggested_transform="CROP"),
    ])
    _register_asset("img_001")

    paths = [
        sequence_path(_TEST_STORY_ID),
        media_blueprint_path(_TEST_STORY_ID),
        asset_registry_path(_TEST_STORY_ID),
    ]
    from lab.animation.paths import animation_plan_path
    paths.append(animation_plan_path(_TEST_STORY_ID))

    before = [p.read_bytes() for p in paths]
    init_render_plan(_TEST_STORY_ID)
    after = [p.read_bytes() for p in paths]

    assert before == after
