import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
import pytest

import routes
from routes import _flight_overlay_layer_job, _require_gopro_overlay_offset


class _FakeQuery:
    def __init__(self, value: object) -> None:
        self.value = value

    def filter(self, *_args: object) -> "_FakeQuery":
        return self

    def first(self) -> object:
        return self.value


class _FakeDb:
    def __init__(self, flight: object) -> None:
        self.flight = flight

    def query(self, *_args: object) -> _FakeQuery:
        return _FakeQuery(self.flight)


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


def test_gopro_overlay_offset_requires_explicit_persistence() -> None:
    with pytest.raises(HTTPException) as error:
        _require_gopro_overlay_offset(SimpleNamespace(gopro_overlay_gpx_offset=None))

    assert error.value.status_code == 409


def test_gopro_overlay_offset_accepts_zero_as_a_valid_offset() -> None:
    assert _require_gopro_overlay_offset(SimpleNamespace(gopro_overlay_gpx_offset=0.0)) == 0.0


def test_flight_telemetry_returns_gpx_fallback_and_normalizes_missing_elevation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text(
        '<gpx><trk><trkseg><trkpt lat="47.2" lon="6.0">'
        "<time>2026-07-01T10:00:00Z</time></trkpt></trkseg></trk></gpx>",
        encoding="utf-8",
    )
    flight = SimpleNamespace(id="flight-1", gpx_file_path=str(gpx_path))
    monkeypatch.setattr(
        routes,
        "_flight_gopro_camera_path",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            HTTPException(status_code=404, detail="camera missing")
        ),
    )

    response = routes.get_flight_telemetry("flight-1", _FakeDb(flight))

    assert response.source == "gpx"
    assert response.has_osv is False
    assert response.enrichment_status == "ready"
    assert response.points[0].elevation == 0
    assert response.duration_seconds == 0


def test_flight_telemetry_does_not_wait_for_osv_merge_when_cache_is_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    gpx_path = tmp_path / "flight.gpx"
    gpx_path.write_text(
        '<gpx><trk><trkseg><trkpt lat="47.2" lon="6.0">'
        "<time>2026-07-01T10:00:00Z</time></trkpt></trkseg></trk></gpx>",
        encoding="utf-8",
    )
    camera_path = tmp_path / "camera.mp4"
    camera_path.touch()
    (tmp_path / "telemetry.OSV").touch()
    flight = SimpleNamespace(id="flight-1", gpx_file_path=str(gpx_path))
    monkeypatch.setattr(routes, "_flight_gopro_camera_path", lambda *_args: camera_path)
    monkeypatch.setattr(routes, "enriched_gpx_path", lambda *_args: tmp_path / "missing.gpx")
    monkeypatch.setattr(
        routes,
        "ensure_enriched_gpx",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("merge waited")),
    )

    response = routes.get_flight_telemetry("flight-1", _FakeDb(flight))

    assert response.source == "gpx+osv"
    assert response.has_osv is True
    assert response.enrichment_status == "missing"
    assert response.points == []


def test_flight_telemetry_keeps_enriched_gpx_on_absolute_timeline(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    gpx_path = tmp_path / "flight.gpx"
    cached_path = tmp_path / "merged-gopro-overlay.gpx"
    gpx_path.write_text(
        '<gpx><trk><trkseg><trkpt lat="47.2" lon="6.0">'
        "<time>2026-07-01T10:00:25Z</time></trkpt></trkseg></trk></gpx>",
        encoding="utf-8",
    )
    cached_path.write_text(
        '<gpx xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">'
        "<trk><trkseg>"
        '<trkpt lat="47.2" lon="6.0"><time>2026-07-01T10:00:00Z</time></trkpt>'
        '<trkpt lat="47.2001" lon="6.0001"><time>2026-07-01T10:00:25Z</time>'
        "<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr>"
        "</gpxtpx:TrackPointExtension></extensions></trkpt>"
        "</trkseg></trk></gpx>",
        encoding="utf-8",
    )
    camera_path = tmp_path / "camera.mp4"
    camera_path.touch()
    (tmp_path / "telemetry.OSV").touch()
    flight = SimpleNamespace(id="flight-1", gpx_file_path=str(gpx_path))
    monkeypatch.setattr(routes, "_flight_gopro_camera_path", lambda *_args: camera_path)
    monkeypatch.setattr(routes, "enriched_gpx_path", lambda *_args: cached_path)

    response = routes.get_flight_telemetry("flight-1", _FakeDb(flight))

    assert response.source == "gpx+osv"
    assert len(response.points) == 1
    assert response.points[0].heart_rate == 140
    assert response.points[0].timestamp == int(
        datetime(2026, 7, 1, 10, 0, 25, tzinfo=timezone.utc).timestamp() * 1000
    )


def test_flight_telemetry_returns_not_found_for_unknown_flight() -> None:
    with pytest.raises(HTTPException) as error:
        routes.get_flight_telemetry("missing", _FakeDb(None))

    assert error.value.status_code == 404
