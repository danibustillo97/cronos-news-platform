"""
Tests de lab.assembly.motion -- funcion pura, sin FFmpeg, sin I/O.
Confirma que resolve_motion_execution() nunca aplica nada mas que STATIC
(ver docstring del modulo para el porque), es determinista, y nunca toca
ningun archivo.
"""

from lab.assembly.motion import resolve_motion_execution
from lab.sequence.constants import MOTION_TYPES


def test_resolve_motion_execution_always_applies_static():
    for motion_type in sorted(MOTION_TYPES):
        result = resolve_motion_execution(motion_type)
        assert result["applied"] == "STATIC"


def test_resolve_motion_execution_preserves_declared_type():
    result = resolve_motion_execution("SLOW_ZOOM_IN")
    assert result["declared_type"] == "SLOW_ZOOM_IN"


def test_resolve_motion_execution_includes_reason():
    result = resolve_motion_execution("PAN_LEFT")
    assert isinstance(result["reason"], str) and result["reason"]


def test_resolve_motion_execution_is_deterministic():
    a = resolve_motion_execution("PUSH_IN")
    b = resolve_motion_execution("PUSH_IN")
    assert a == b


def test_resolve_motion_execution_static_input_stays_static():
    result = resolve_motion_execution("STATIC")
    assert result == {"declared_type": "STATIC", "applied": "STATIC", "reason": result["reason"]}
