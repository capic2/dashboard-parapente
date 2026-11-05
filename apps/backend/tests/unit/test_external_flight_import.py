from datetime import datetime

import pytest

import config
from external_flight_import import (
    _legacy_track_matches,
    _update_existing_flight,
    import_external_activities,
    match_landing_site,
    update_inferred_landing_site,
)
from intervals_icu import ExternalActivity
from models import Flight, Site
from flight_tracks import calculate_track_stats, normalize_track

GPX = b"""<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
<trkpt lat="47.2000" lon="6.0000"><ele>400</ele><time>2026-07-01T10:00:00Z</time></trkpt>
<trkpt lat="47.2010" lon="6.0010"><ele>450</ele><time>2026-07-01T10:01:00Z</time></trkpt>
</trkseg></trk></gpx>"""


class Provider:
    async def download_original(self, activity_id: str) -> bytes:
        return GPX


@pytest.mark.asyncio
async def test_import_normalizes_intervals_name_and_repairs_it_on_resync(
    db_session, arguel_site, landing_site, tmp_path, monkeypatch
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
    assert flight.name == "Vol du 01/07/2026 à 12:00"
    assert flight.title == "Vol du 01/07/2026 à 12:00"
    flight.name = "First title"
    flight.title = "First title"
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
    assert second["updated"] == 1
    assert second["skipped"] == 0
    assert db_session.query(Flight).count() == 1
    assert flight.external_provider == "intervals_icu"
    assert flight.external_activity_id == "unsafe/id"
    assert flight.gpx_provider == "zepp"
    assert flight.name == "Vol du 01/07/2026 à 12:00"
    assert flight.title == "Vol du 01/07/2026 à 12:00"
    assert "intervals_unsafe_id_" in flight.gpx_file_path
    assert flight.site_id == arguel_site.id
    assert flight.landing_site_id == landing_site.id
    assert flight.landing_site_source == "auto"
    assert flight.max_climb_rate_ms == 0.83
    assert flight.max_sink_rate_ms == 0


def test_match_landing_site_accepts_landing_and_both_but_excludes_takeoff(
    db_session, arguel_site, landing_site
):
    both_site = Site(
        id="site-both",
        code="BOTH",
        name="Landing and takeoff",
        latitude=47.201,
        longitude=6.001,
        usage_type="both",
    )
    db_session.add(both_site)
    db_session.commit()

    point = {"lat": 47.201, "lon": 6.001}

    assert match_landing_site(db_session, point) == both_site.id
    assert match_landing_site(db_session, {"lat": 47.19, "lon": 5.99}) == landing_site.id
    assert arguel_site.id != match_landing_site(db_session, point)


def test_match_landing_site_ignores_missing_coordinates_and_sites_beyond_limit(db_session):
    db_session.add_all(
        [
            Site(
                id="site-missing-coordinates",
                code="MISS",
                name="No coordinates",
                usage_type="landing",
            ),
            Site(
                id="site-too-far",
                code="FAR",
                name="Too far",
                latitude=40.0,
                longitude=-3.0,
                usage_type="both",
            ),
        ]
    )
    db_session.commit()

    assert match_landing_site(db_session, {"lat": 47.2, "lon": 6.0}) is None


def test_update_inferred_landing_site_recomputes_only_automatic_assignments(
    db_session, landing_site
):
    automatic_flight = Flight(
        id="automatic-landing",
        flight_date=datetime(2026, 7, 1).date(),
        landing_site_id="old-automatic-site",
        landing_site_source="auto",
    )
    point = {"lat": landing_site.latitude, "lon": landing_site.longitude}

    assert update_inferred_landing_site(db_session, automatic_flight, point)
    assert automatic_flight.landing_site_id == landing_site.id
    assert automatic_flight.landing_site_source == "auto"

    for source in ("manual", "cleared"):
        protected_flight = Flight(
            id=f"protected-{source}",
            flight_date=datetime(2026, 7, 1).date(),
            landing_site_id="user-value",
            landing_site_source=source,
        )

        assert not update_inferred_landing_site(db_session, protected_flight, point)
        assert protected_flight.landing_site_id == "user-value"
        assert protected_flight.landing_site_source == source


@pytest.mark.asyncio
async def test_import_skips_existing_intervals_flight_with_normalized_name(db_session):
    flight = Flight(
        id="existing",
        external_provider="intervals_icu",
        external_activity_id="i-existing",
        external_url="https://intervals.icu/activities/i-existing",
        name="Vol du 28/07/2026 à 19:05",
        title="Vol du 28/07/2026 à 19:05",
        flight_date=datetime(2026, 7, 28).date(),
        departure_time=datetime(2026, 7, 28, 19, 5),
        gpx_file_path="/flights/intervals_i-existing.gpx",
    )
    db_session.add(flight)
    db_session.commit()
    activity = ExternalActivity(
        id="i-existing",
        name="Raw Intervals title",
        start_date=datetime(2026, 7, 28, 19, 5),
        activity_type="Other",
        source="ZEPP",
        file_type="GPX",
        external_url="https://intervals.icu/activities/i-existing",
    )

    result = await import_external_activities(db_session, "intervals_icu", Provider(), [activity])

    assert result["updated"] == 1
    assert result["skipped"] == 0
    assert flight.gpx_provider == "zepp"
    assert flight.name == "Vol du 28/07/2026 à 19:05"


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
    assert legacy.gpx_provider == "strava"
    assert legacy.name == "Existing flight"


def test_external_import_uses_original_track_after_enrichment(tmp_path):
    source_path = tmp_path / "intervals_source.gpx"
    source_path.write_bytes(GPX)
    enriched_path = tmp_path / "merged-gopro-overlay.gpx"
    enriched_path.write_text(
        '<gpx><trk><trkseg><trkpt lat="45" lon="5">'
        "<time>2026-07-01T09:59:00Z</time></trkpt></trkseg></trk></gpx>",
        encoding="utf-8",
    )
    flight = Flight(
        id="enriched",
        flight_date=datetime(2026, 7, 1).date(),
        departure_time=datetime(2026, 7, 1, 10),
        gpx_file_path=str(enriched_path),
        gpx_source_file_path=str(source_path),
    )
    _, points = normalize_track(GPX, "gpx")
    stats = calculate_track_stats(points)

    assert _legacy_track_matches(flight, points, stats)

    activity = ExternalActivity(
        id="source-check",
        name="Source check",
        start_date=datetime(2026, 7, 1, 10),
        activity_type="Other",
        source="ZEPP",
        file_type="GPX",
        external_url=None,
    )
    flight.gpx_provider = None
    _update_existing_flight(flight, activity)
    assert flight.gpx_provider == "zepp"


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
    assert flight.name == "Vol du 02/07/2026 à 00:30"
    assert flight.title == "Vol du 02/07/2026 à 00:30"


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
