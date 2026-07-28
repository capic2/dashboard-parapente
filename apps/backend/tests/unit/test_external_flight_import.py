from datetime import datetime

import pytest

import config
from external_flight_import import import_external_activities
from intervals_icu import ExternalActivity
from models import Flight

GPX = b"""<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
<trkpt lat="47.2000" lon="6.0000"><ele>400</ele><time>2026-07-01T10:00:00Z</time></trkpt>
<trkpt lat="47.2010" lon="6.0010"><ele>450</ele><time>2026-07-01T10:01:00Z</time></trkpt>
</trkseg></trk></gpx>"""


class Provider:
    async def download_original(self, activity_id: str) -> bytes:
        return GPX


@pytest.mark.asyncio
async def test_import_is_idempotent_and_preserves_user_edits(
    db_session, arguel_site, tmp_path, monkeypatch
):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    activity = ExternalActivity(
        id="unsafe/id",
        name="First title",
        start_date=datetime(2026, 7, 1, 10),
        activity_type="HangGliding",
        source="ZEPP",
        file_type="GPX",
        external_url="https://intervals.icu/activities/unsafe-id",
    )

    first = await import_external_activities(db_session, "intervals_icu", Provider(), [activity])
    flight = db_session.query(Flight).one()
    flight.name = "Pilot title"
    db_session.commit()
    repeated_activity = ExternalActivity(
        id=activity.id,
        name="Updated title",
        start_date=activity.start_date,
        activity_type=activity.activity_type,
        source=activity.source,
        file_type=activity.file_type,
        external_url=activity.external_url,
    )
    second = await import_external_activities(
        db_session, "intervals_icu", Provider(), [repeated_activity]
    )

    flight = db_session.query(Flight).one()
    assert first["imported"] == 1
    assert second["skipped"] == 1
    assert db_session.query(Flight).count() == 1
    assert flight.external_provider == "intervals_icu"
    assert flight.external_activity_id == "unsafe/id"
    assert flight.name == "Pilot title"
    assert "intervals_unsafe_id_" in flight.gpx_file_path
    assert flight.site_id == arguel_site.id


@pytest.mark.asyncio
async def test_import_reconciles_one_legacy_strava_flight(db_session, tmp_path):
    legacy_gpx = tmp_path / "legacy.gpx"
    legacy_gpx.write_bytes(GPX)
    legacy = Flight(
        id="legacy",
        strava_id="123",
        external_provider="strava",
        external_activity_id="123",
        name="Existing flight",
        title="Existing flight",
        flight_date=datetime(2026, 7, 1).date(),
        departure_time=datetime(2026, 7, 1, 10, 1),
        duration_minutes=1,
        gpx_file_path=str(legacy_gpx),
    )
    db_session.add(legacy)
    db_session.commit()
    activity = ExternalActivity(
        id="i123",
        name="Zepp flight",
        start_date=datetime(2026, 7, 1, 10),
        activity_type="Other",
        source="ZEPP",
        file_type="GPX",
        external_url="https://intervals.icu/activities/i123",
    )

    result = await import_external_activities(db_session, "intervals_icu", Provider(), [activity])

    assert result["skipped"] == 1
    assert db_session.query(Flight).count() == 1
    assert legacy.external_provider == "intervals_icu"
    assert legacy.external_activity_id == "i123"
    assert legacy.name == "Existing flight"


@pytest.mark.asyncio
async def test_import_stores_track_departure_in_paris_local_time(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    late_gpx = GPX.replace(b"2026-07-01T10:00:00Z", b"2026-07-01T22:30:00Z").replace(
        b"2026-07-01T10:01:00Z", b"2026-07-01T22:31:00Z"
    )

    class LateProvider:
        async def download_original(self, activity_id: str) -> bytes:
            return late_gpx

    activity = ExternalActivity(
        id="i-late",
        name="Late flight",
        start_date=datetime(2026, 7, 1, 22, 30),
        activity_type="Other",
        source="ZEPP",
        file_type="GPX",
        external_url=None,
    )

    await import_external_activities(db_session, "intervals_icu", LateProvider(), [activity])

    flight = db_session.query(Flight).one()
    assert flight.departure_time == datetime(2026, 7, 2, 0, 30)
    assert flight.flight_date.isoformat() == "2026-07-02"


@pytest.mark.asyncio
async def test_flush_failure_removes_new_track_file(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    activity = ExternalActivity(
        id="i-failure",
        name="Flight",
        start_date=datetime(2026, 7, 1, 10),
        activity_type="Other",
        source="ZEPP",
        file_type="GPX",
        external_url=None,
    )

    original_flush = db_session.flush
    flush_count = 0

    def fail_second_flush(*args, **kwargs):
        nonlocal flush_count
        flush_count += 1
        if flush_count == 2:
            raise RuntimeError("flush failed")
        return original_flush(*args, **kwargs)

    monkeypatch.setattr(db_session, "flush", fail_second_flush)

    result = await import_external_activities(db_session, "intervals_icu", Provider(), [activity])

    assert result["failed"] == 1
    assert result["imported"] == 0
    assert result["flights"] == []
    assert list(tmp_path.rglob("*.gpx")) == []
