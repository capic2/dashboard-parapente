import json
from types import SimpleNamespace

from routes import _flight_overlay_layer_job


def test_flight_overlay_layer_job_returns_newest_transparent_overlay() -> None:
    regular_export = SimpleNamespace(command_json=json.dumps({"overlay_only": False}))
    first_layer = SimpleNamespace(command_json=json.dumps({"overlay_only": True}))
    newest_layer = SimpleNamespace(command_json=json.dumps({"overlay_only": True}))
    flight = SimpleNamespace(gopro_overlay_jobs=[regular_export, first_layer, newest_layer])

    assert _flight_overlay_layer_job(flight) is newest_layer


def test_flight_overlay_layer_job_ignores_invalid_or_regular_jobs() -> None:
    invalid = SimpleNamespace(command_json="not-json")
    regular_export = SimpleNamespace(command_json=json.dumps({"overlay_only": False}))
    flight = SimpleNamespace(gopro_overlay_jobs=[invalid, regular_export])

    assert _flight_overlay_layer_job(flight) is None
