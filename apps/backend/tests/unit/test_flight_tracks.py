import gzip
import sys
from collections.abc import Iterator
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest

from flight_tracks import calculate_track_stats, normalize_track

GPX = b"""<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
<trkpt lat="47.2000" lon="6.0000"><ele>400</ele><time>2026-07-01T10:00:00Z</time></trkpt>
<trkpt lat="47.2010" lon="6.0010"><ele>450</ele><time>2026-07-01T10:01:00Z</time></trkpt>
</trkseg></trk></gpx>"""


class FakeFitDataMessage:
    name = "record"

    def __init__(self, values: dict[str, Any]) -> None:
        self.values = values

    def get_value(self, name: str, fallback: Any = None) -> Any:
        return self.values.get(name, fallback)


def install_fitdecode_mock(
    monkeypatch: pytest.MonkeyPatch, frames: list[FakeFitDataMessage]
) -> None:
    class FitReader:
        def __init__(self, _stream: object) -> None:
            pass

        def __enter__(self) -> Iterator[FakeFitDataMessage]:
            return iter(frames)

        def __exit__(self, *_args: object) -> bool:
            return False

    monkeypatch.setitem(
        sys.modules,
        "fitdecode",
        SimpleNamespace(FitDataMessage=FakeFitDataMessage, FitReader=FitReader),
    )


def test_normalizes_gzipped_gpx_and_calculates_stats():
    normalized, points = normalize_track(gzip.compress(GPX), "gpx.gz")
    stats = calculate_track_stats(points)

    assert b"<gpx" in normalized
    assert len(points) == 2
    assert stats["max_altitude_m"] == 450
    assert stats["elevation_gain_m"] == 50
    assert stats["duration_minutes"] == 1


def test_normalizes_tcx():
    tcx = b"""<TrainingCenterDatabase><Activities><Activity><Lap><Track><Trackpoint>
    <Time>2026-07-01T10:00:00Z</Time><Position><LatitudeDegrees>47.2</LatitudeDegrees>
    <LongitudeDegrees>6.0</LongitudeDegrees></Position><AltitudeMeters>410</AltitudeMeters>
    </Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>"""

    _, points = normalize_track(tcx, "TCX")
    assert points[0]["lat"] == 47.2
    assert points[0]["elevation"] == 410


def test_normalizes_fit_records(monkeypatch):
    frames = [
        FakeFitDataMessage(
            {
                "position_lat": 47.2,
                "position_long": 6.0,
                "enhanced_altitude": 410.0,
                "timestamp": datetime(2026, 7, 1, 10, tzinfo=timezone.utc),
                "heart_rate": 120,
                "power": 42,
            }
        )
    ]

    install_fitdecode_mock(monkeypatch, frames)

    normalized, points = normalize_track(b"fit-data", "fit")

    assert points[0]["lat"] == 47.2
    assert points[0]["elevation"] == 410.0
    assert points[0]["heart_rate"] == 120
    assert b"TrackPointExtension" in normalized


def test_fills_missing_initial_fit_altitude_without_false_elevation_gain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    frames = [
        FakeFitDataMessage(
            {
                "position_lat": 47.2,
                "position_long": 6.0,
                "timestamp": datetime(2026, 7, 1, 10, tzinfo=timezone.utc),
            }
        ),
        FakeFitDataMessage(
            {
                "position_lat": 47.2001,
                "position_long": 6.0001,
                "enhanced_altitude": 470.2,
                "timestamp": datetime(2026, 7, 1, 10, 0, 1, tzinfo=timezone.utc),
            }
        ),
    ]
    install_fitdecode_mock(monkeypatch, frames)

    normalized, points = normalize_track(b"fit-data", "fit")
    stats = calculate_track_stats(points)

    assert [point["elevation"] for point in points] == [470.2, 470.2]
    assert normalized.count(b">470.2</") == 2
    assert stats["elevation_gain_m"] == 0


def test_preserves_explicit_zero_fit_altitude(monkeypatch: pytest.MonkeyPatch) -> None:
    frames = [
        FakeFitDataMessage(
            {
                "position_lat": 47.2,
                "position_long": 6.0,
                "enhanced_altitude": 0.0,
            }
        ),
        FakeFitDataMessage(
            {
                "position_lat": 47.2001,
                "position_long": 6.0001,
                "enhanced_altitude": 0.0,
            }
        ),
    ]
    install_fitdecode_mock(monkeypatch, frames)

    _, points = normalize_track(b"fit-data", "fit")

    assert [point["elevation"] for point in points] == [0.0, 0.0]


def test_interpolates_missing_altitudes_and_fills_track_ends() -> None:
    gpx = b"""<gpx><trk><trkseg>
    <trkpt lat="47.2" lon="6.0"><time>2026-07-01T10:00:00Z</time></trkpt>
    <trkpt lat="47.201" lon="6.001"><ele>400</ele><time>2026-07-01T10:00:10Z</time></trkpt>
    <trkpt lat="47.202" lon="6.002"><time>2026-07-01T10:00:20Z</time></trkpt>
    <trkpt lat="47.203" lon="6.003"><ele>460</ele><time>2026-07-01T10:01:10Z</time></trkpt>
    <trkpt lat="47.204" lon="6.004"><time>2026-07-01T10:01:20Z</time></trkpt>
    </trkseg></trk></gpx>"""

    _, points = normalize_track(gpx, "gpx")

    assert [point["elevation"] for point in points] == [400, 400, 410, 460, 460]


def test_uses_zero_when_track_has_no_altitude_data() -> None:
    gpx = b"""<gpx><trk><trkseg>
    <trkpt lat="47.2" lon="6.0"/><trkpt lat="47.201" lon="6.001"/>
    </trkseg></trk></gpx>"""

    normalized, points = normalize_track(gpx, "gpx")

    assert [point["elevation"] for point in points] == [0.0, 0.0]
    assert normalized.count(b">0.0</") == 2


def test_uses_index_interpolation_when_a_gap_has_missing_timestamps() -> None:
    gpx = b"""<gpx><trk><trkseg>
    <trkpt lat="47.2" lon="6.0"><ele>400</ele></trkpt>
    <trkpt lat="47.201" lon="6.001"><time>2026-07-01T10:00:10Z</time></trkpt>
    <trkpt lat="47.202" lon="6.002"><time>2026-07-01T10:00:20Z</time></trkpt>
    <trkpt lat="47.203" lon="6.003"><ele>500</ele><time>2026-07-01T10:00:30Z</time></trkpt>
    </trkseg></trk></gpx>"""

    _, points = normalize_track(gpx, "gpx")

    assert [point["elevation"] for point in points] == pytest.approx(
        [400, 433.333, 466.667, 500], abs=0.001
    )


def test_statistics_do_not_bridge_separate_track_segments():
    segmented_gpx = b"""<gpx><trk>
    <trkseg><trkpt lat="47.2" lon="6.0"><ele>400</ele><time>2026-07-01T10:00:00Z</time></trkpt>
    <trkpt lat="47.201" lon="6.001"><ele>410</ele><time>2026-07-01T10:01:00Z</time></trkpt></trkseg>
    <trkseg><trkpt lat="48.2" lon="7.0"><ele>1000</ele><time>2026-07-01T11:00:00Z</time></trkpt>
    <trkpt lat="48.201" lon="7.001"><ele>1010</ele><time>2026-07-01T11:01:00Z</time></trkpt></trkseg>
    </trk></gpx>"""

    normalized, points = normalize_track(segmented_gpx, "gpx")
    stats = calculate_track_stats(points)

    assert normalized.count(b"trkseg") == 4
    assert stats["distance_km"] < 1
    assert stats["elevation_gain_m"] == 20


@pytest.mark.parametrize(
    "latitude,longitude",
    [("nan", "6.0"), ("91", "6.0"), ("47.2", "181")],
)
def test_rejects_invalid_track_coordinates(latitude, longitude):
    invalid_gpx = (
        f'<gpx><trk><trkseg><trkpt lat="{latitude}" lon="{longitude}"><ele>400</ele>'
        "<time>2026-07-01T10:00:00Z</time></trkpt></trkseg></trk></gpx>"
    ).encode()

    with pytest.raises(ValueError, match="invalid track coordinates"):
        normalize_track(invalid_gpx, "gpx")
