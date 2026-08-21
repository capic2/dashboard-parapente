from datetime import date, datetime, timedelta
from unittest.mock import patch

from sqlalchemy import event

import config
from models import Flight, GoproOverlayJob, YoutubeUploadJob

API_URL = "/api/flights/summaries"


def _add_flights(db_session, *, count: int, site_id: str = "site-arguel") -> None:
    db_session.add_all(
        [
            Flight(
                id=f"summary-{index:03d}",
                title=f"Flight {index}",
                name=f"Name {index}",
                site_id=site_id,
                flight_date=date(2026, 1, 1) + timedelta(days=index),
                departure_time=datetime(2026, 1, 1, 10) + timedelta(days=index),
                duration_minutes=index,
                max_altitude_m=1000 + index,
                distance_km=float(index),
                gpx_file_path="private/track.gpx" if index % 2 else None,
                video_file_path="private/video.mp4" if index == 1 else None,
                video_export_job_id="video-job" if index == 1 else None,
                video_export_status="completed" if index == 1 else None,
                youtube_urls_json=(
                    '["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]' if index == 1 else "[]"
                ),
                gopro_overlay_file_path="private/overlay.mp4" if index == 1 else None,
                gopro_overlay_job_id="overlay-job" if index == 1 else None,
                gopro_overlay_status="completed" if index == 1 else None,
            )
            for index in range(count)
        ]
    )
    db_session.commit()


def test_summaries_are_protected(client):
    from auth import get_current_user
    from main import app

    override = app.dependency_overrides.pop(get_current_user)
    try:
        response = client.get(API_URL)
    finally:
        app.dependency_overrides[get_current_user] = override

    assert response.status_code == 401


def test_summaries_paginate_with_exact_total_and_opaque_cursor(client, db_session, arguel_site):
    _add_flights(db_session, count=5)

    first = client.get(API_URL, params={"page_size": 2}).json()
    second = client.get(API_URL, params={"page_size": 2, "cursor": first["next_cursor"]}).json()
    third = client.get(API_URL, params={"page_size": 2, "cursor": second["next_cursor"]}).json()

    assert first["total"] == second["total"] == third["total"] == 5
    assert [item["id"] for item in first["flights"]] == ["summary-004", "summary-003"]
    assert [item["id"] for item in second["flights"]] == ["summary-002", "summary-001"]
    assert [item["id"] for item in third["flights"]] == ["summary-000"]
    assert third["next_cursor"] is None
    assert "summary-003" not in first["next_cursor"]


def test_summaries_filter_search_sort_and_hide_paths(client, db_session, arguel_site):
    _add_flights(db_session, count=4)

    response = client.get(
        API_URL,
        params={
            "q": "arguel",
            "site_id": arguel_site.id,
            "gpx_status": "with",
            "sort_by": "distance_km",
            "sort_order": "asc",
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["total"] == 2
    assert [item["id"] for item in body["flights"]] == ["summary-001", "summary-003"]
    item = body["flights"][0]
    assert item["site_name"] == "Arguel"
    assert item["site_region"] == "Doubs"
    assert item["has_gpx"] is False
    assert item["has_video"] is False
    assert item["has_camera"] is False
    assert item["has_youtube_video"] is False
    assert item["has_gopro_overlay"] is False
    assert item["video_export_job_id"] == "video-job"
    assert item["gopro_overlay_job_id"] == "overlay-job"
    assert not any("path" in key for key in item)
    assert body["flights"][1]["has_youtube_video"] is False


def test_summaries_report_panorama_file(client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(tmp_path))
    flight = Flight(
        id="summary-pano",
        title="Panorama",
        flight_date=date(2026, 1, 1),
        departure_time=datetime(2026, 1, 1, 10),
    )
    db_session.add(flight)
    db_session.commit()
    directory = tmp_path / "20260101" / "01"
    directory.mkdir(parents=True)
    (directory / "pano.mp4").write_bytes(b"pano")

    response = client.get(API_URL)

    assert response.status_code == 200
    assert response.json()["flights"][0]["has_pano_video"] is True
    db_session.refresh(flight)
    assert flight.pano_video_file_path == str((directory / "pano.mp4").resolve())


def test_summaries_search_is_case_and_accent_insensitive(client, db_session) -> None:
    db_session.add(
        Flight(
            id="accented-flight",
            title="École du ciel",
            flight_date=date(2026, 1, 1),
        )
    )
    db_session.commit()

    response = client.get(API_URL, params={"q": "ecole"})

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["flights"]] == ["accented-flight"]


def test_summaries_only_report_completed_uploads_that_still_exist(client, db_session) -> None:
    uploaded = Flight(
        id="youtube-uploaded",
        title="Uploaded",
        flight_date=date(2026, 1, 1),
        youtube_urls_json='["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]',
    )
    deleted = Flight(id="youtube-deleted", title="Deleted", flight_date=date(2026, 1, 2))
    manual = Flight(
        id="youtube-manual",
        title="Manual",
        flight_date=date(2026, 1, 3),
        youtube_urls_json='["https://www.youtube.com/watch?v=9bZkp7q19f0"]',
    )
    db_session.add_all([uploaded, deleted, manual])
    db_session.add_all(
        [
            YoutubeUploadJob(
                id="youtube-uploaded-job",
                flight_id=uploaded.id,
                user_id=1,
                status="completed",
                progress=100,
                title="Uploaded",
                description="",
                youtube_video_id="dQw4w9WgXcQ",
            ),
            YoutubeUploadJob(
                id="youtube-deleted-job",
                flight_id=deleted.id,
                user_id=1,
                status="completed",
                progress=100,
                title="Deleted",
                description="",
                youtube_video_id="aaaaaaaaaaa",
            ),
            YoutubeUploadJob(
                id="youtube-uploaded-dissociated-job",
                flight_id=uploaded.id,
                user_id=1,
                status="completed",
                progress=100,
                title="Uploaded then dissociated",
                description="",
                youtube_video_id="bbbbbbbbbbb",
            ),
        ]
    )
    db_session.commit()

    with patch(
        "flight_summaries.existing_youtube_video_ids",
        return_value={"aaaaaaaaaaa", "dQw4w9WgXcQ"},
    ) as verify_videos:
        response = client.get(API_URL)
    flags_by_id = {item["id"]: item["has_youtube_video"] for item in response.json()["flights"]}

    assert response.status_code == 200
    assert flags_by_id == {
        "youtube-deleted": False,
        "youtube-manual": False,
        "youtube-uploaded": True,
    }
    verify_videos.assert_called_once_with({1: {"dQw4w9WgXcQ"}})


def test_summaries_require_completed_generations_and_existing_files(
    client, db_session, tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr("flight_summaries.config.PARAGLIDING_DATA_ROOT", str(tmp_path))
    available_dir = tmp_path / "20260101" / "01"
    available_dir.mkdir(parents=True)
    gpx_path = available_dir / "track.gpx"
    video_path = available_dir / "video.mp4"
    overlay_path = available_dir / "final.mp4"
    for path in (gpx_path, video_path, overlay_path, available_dir / "camera.mp4"):
        path.write_bytes(b"media")

    available = Flight(
        id="media-available",
        title="Available",
        flight_date=date(2026, 1, 1),
        departure_time=datetime(2026, 1, 1, 10),
        gpx_file_path=str(gpx_path),
        video_file_path=str(video_path),
        video_export_status="completed",
        gopro_overlay_file_path=str(overlay_path),
        gopro_overlay_status="completed",
    )
    incomplete = Flight(
        id="media-incomplete",
        title="Incomplete",
        flight_date=date(2026, 1, 1),
        departure_time=datetime(2026, 1, 1, 11),
        gpx_file_path=str(tmp_path / "missing.gpx"),
        video_file_path=str(video_path),
        video_export_status="failed",
        gopro_overlay_file_path=str(overlay_path),
        gopro_overlay_status="failed",
    )
    db_session.add_all([available, incomplete])
    db_session.add(
        GoproOverlayJob(
            id="completed-overlay",
            flight_id=available.id,
            status="completed",
            progress=100,
            video_path="camera.mp4",
            gpx_path=str(gpx_path),
            layout_id="layout",
            layout_label="Layout",
            layout_path="layout.xml",
            output_path=str(overlay_path),
            temp_output_path=f"{overlay_path}.tmp",
            output_filename="final.mp4",
        )
    )
    db_session.commit()

    response = client.get(API_URL)
    summaries = {item["id"]: item for item in response.json()["flights"]}

    assert response.status_code == 200
    assert {
        key: summaries["media-available"][key]
        for key in ("has_gpx", "has_video", "has_camera", "has_gopro_overlay")
    } == {
        "has_gpx": True,
        "has_video": True,
        "has_camera": True,
        "has_gopro_overlay": True,
    }
    assert summaries["media-incomplete"]["has_gpx"] is False
    assert summaries["media-incomplete"]["has_video"] is False
    assert summaries["media-incomplete"]["has_camera"] is False
    assert summaries["media-incomplete"]["has_gopro_overlay"] is False


def test_summaries_put_nulls_last_and_keyset_ties_by_id(client, db_session, arguel_site):
    db_session.add_all(
        [
            Flight(
                id="duration-b",
                title="B",
                flight_date=date(2026, 1, 1),
                duration_minutes=10,
            ),
            Flight(
                id="duration-a",
                title="A",
                flight_date=date(2026, 1, 1),
                duration_minutes=10,
            ),
            Flight(
                id="duration-null",
                title="Null",
                flight_date=date(2026, 1, 1),
                duration_minutes=None,
            ),
        ]
    )
    db_session.commit()

    first = client.get(
        API_URL,
        params={"page_size": 1, "sort_by": "duration_minutes", "sort_order": "asc"},
    ).json()
    second = client.get(
        API_URL,
        params={
            "page_size": 1,
            "sort_by": "duration_minutes",
            "sort_order": "asc",
            "cursor": first["next_cursor"],
        },
    ).json()
    third = client.get(
        API_URL,
        params={
            "page_size": 1,
            "sort_by": "duration_minutes",
            "sort_order": "asc",
            "cursor": second["next_cursor"],
        },
    ).json()

    assert [
        first["flights"][0]["id"],
        second["flights"][0]["id"],
        third["flights"][0]["id"],
    ] == [
        "duration-a",
        "duration-b",
        "duration-null",
    ]


def test_summaries_do_no_parser_or_job_work(client, db_session, arguel_site):
    _add_flights(db_session, count=2)

    with (
        patch("routes.normalize_track", side_effect=AssertionError("parser called")),
        patch("routes.get_export_status_manual", side_effect=AssertionError("job called")),
        patch("routes.get_gopro_overlay_job", side_effect=AssertionError("job called")),
    ):
        response = client.get(API_URL)

    assert response.status_code == 200


def test_summaries_use_constant_two_query_budget(client, db_session, arguel_site):
    _add_flights(db_session, count=30)
    engine = db_session.get_bind()
    statements: list[str] = []

    def count_statement(_conn, _cursor, statement, _parameters, _context, _executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", count_statement)
    try:
        response = client.get(API_URL, params={"page_size": 25})
    finally:
        event.remove(engine, "before_cursor_execute", count_statement)

    assert response.status_code == 200
    assert len(statements) == 2


def test_summaries_reject_cursor_when_filters_change(client, db_session, arguel_site):
    _add_flights(db_session, count=2)
    cursor = client.get(API_URL, params={"page_size": 1}).json()["next_cursor"]

    response = client.get(API_URL, params={"page_size": 1, "cursor": cursor, "q": "changed"})

    assert response.status_code == 422


def test_summaries_page_size_limits(client):
    assert client.get(API_URL, params={"page_size": 0}).status_code == 422
    assert client.get(API_URL, params={"page_size": 101}).status_code == 422
