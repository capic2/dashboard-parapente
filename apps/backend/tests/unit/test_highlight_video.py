from datetime import date
from pathlib import Path
from unittest.mock import Mock, patch

from models import Flight, HighlightVideoJob
from highlight_video import HighlightClip, clamp_clip, overlay_interval_for_clip
import highlight_video_worker
from highlight_video_worker import (
    _probe_video_dimensions,
    _render_clip,
    _set_job_stage,
    _flight_phase_times,
    select_flight_event_clips,
)


def test_worker_restart_recovers_and_requeues_active_highlight_jobs(test_db, monkeypatch):
    monkeypatch.setattr(highlight_video_worker, "SessionLocal", test_db)
    monkeypatch.setattr("job_queue.is_rq_enabled", lambda: True)
    enqueued: list[str] = []
    monkeypatch.setattr(
        highlight_video_worker,
        "_enqueue_highlight_video_job_in_rq",
        lambda job_id: enqueued.append(job_id),
    )
    with test_db() as db:
        db.add(Flight(id="flight-recover", name="Recover", flight_date=date(2026, 8, 28)))
        db.add_all(
            [
                HighlightVideoJob(
                    id="highlight-running",
                    flight_id="flight-recover",
                    status="running",
                    progress=10,
                    message="Analyse en cours",
                    source_video_path="/tmp/pano.mp4",
                ),
                HighlightVideoJob(
                    id="highlight-queued",
                    flight_id="flight-recover",
                    status="queued",
                    progress=0,
                    source_video_path="/tmp/pano.mp4",
                ),
            ]
        )
        db.commit()

    assert highlight_video_worker.enqueue_pending_highlight_video_jobs(recover_active=True) == 2
    assert enqueued == ["highlight-running", "highlight-queued"]

    with test_db() as db:
        recovered = db.get(HighlightVideoJob, "highlight-running")
        assert recovered is not None
        assert recovered.status == "queued"
        assert recovered.progress == 0
        assert recovered.message == "Récupéré après le redémarrage du worker"
        assert recovered.started_at is None


def test_highlight_jobs_are_enqueued_on_the_dedicated_queue(monkeypatch) -> None:
    enqueued = Mock()
    monkeypatch.setattr(highlight_video_worker.config, "HIGHLIGHT_QUEUE_NAME", "highlight-queue")
    monkeypatch.setattr("job_queue.enqueue_once", enqueued)

    highlight_video_worker._enqueue_highlight_video_job_in_rq("highlight-123")

    assert enqueued.call_args.kwargs["queue_name"] == "highlight-queue"


def test_duplicate_rq_execution_does_not_claim_running_highlight_job(test_db, monkeypatch):
    monkeypatch.setattr(highlight_video_worker, "SessionLocal", test_db)
    with test_db() as db:
        db.add(Flight(id="flight-claimed", name="Claimed", flight_date=date(2026, 8, 28)))
        db.add(
            HighlightVideoJob(
                id="highlight-claimed",
                flight_id="flight-claimed",
                status="running",
                progress=10,
                source_video_path="/tmp/pano.mp4",
            )
        )
        db.commit()

    highlight_video_worker.process_highlight_video_job("highlight-claimed")

    with test_db() as db:
        job = db.get(HighlightVideoJob, "highlight-claimed")
        assert job is not None
        assert job.status == "running"
        assert job.progress == 10


def test_clip_maps_pano_time_to_overlay_time():
    clip = HighlightClip(start_seconds=12.5, duration_seconds=6.0, yaw_degrees=90)

    assert clip.overlay_start_seconds(2.25) == 14.75
    assert clip.overlay_end_seconds(2.25) == 20.75


def test_overlay_interval_is_clamped_to_overlay_duration():
    clip = HighlightClip(start_seconds=98, duration_seconds=8, yaw_degrees=0)

    assert overlay_interval_for_clip(clip, 3, 105) == (101, 105)


def test_overlay_interval_is_missing_when_clip_is_after_overlay():
    clip = HighlightClip(start_seconds=30, duration_seconds=5, yaw_degrees=0)

    assert overlay_interval_for_clip(clip, 10, 20) is None


def test_clamp_clip_keeps_source_bounds():
    clip = clamp_clip(-2, 12, 10)

    assert clip.start_seconds == 0
    assert clip.duration_seconds == 10


def test_event_selection_guarantees_takeoff_landing_and_thermal():
    points = [
        {"timestamp": index * 60_000, "elevation": elevation}
        for index, elevation in enumerate([500, 510, 530, 570, 590, 580])
    ]

    clips = select_flight_event_clips(
        600,
        points,
        [
            HighlightClip(30, 8, 0, "dynamic"),
            HighlightClip(300, 8, 0, "dynamic"),
            HighlightClip(540, 8, 0, "dynamic"),
        ],
    )

    assert {clip.category for clip in clips} >= {"takeoff", "landing", "thermal"}


def test_event_selection_uses_visual_activity_for_phases_without_fixed_offsets():
    clips = select_flight_event_clips(
        600,
        None,
        [HighlightClip(42, 8, 0, "dynamic"), HighlightClip(520, 8, 0, "dynamic")],
    )

    assert [(clip.category, clip.start_seconds) for clip in clips[:2]] == [
        ("takeoff", 34),
        ("landing", 520),
    ]


def test_thermal_selection_uses_sustained_climb_not_single_altitude_spike():
    points = [
        {"timestamp": index * 10_000, "elevation": elevation}
        for index, elevation in enumerate([500, 501, 550, 502, 503, 504, 505])
    ]

    clips = select_flight_event_clips(120, points, [])

    thermal = next(clip for clip in clips if clip.category == "thermal")
    assert thermal.start_seconds > 20


def test_flight_phase_detection_uses_sustained_altitude_trends():
    elevations = [500, 500, 500, 520, 540, 560, 580, 590, 570, 550, 530, 510, 500, 500, 500]
    points = [
        {"timestamp": index * 30_000, "elevation": elevation}
        for index, elevation in enumerate(elevations)
    ]

    takeoff, landing = _flight_phase_times(points)

    assert takeoff is not None and 30 < takeoff < 120
    assert landing is not None and 300 < landing < 400


def test_flight_phase_detection_uses_stationary_position_when_altitude_drifts():
    points = []
    for index in range(60):
        if index < 10:
            elevation = 500
        elif index < 25:
            elevation = 500 + (index - 10) * 8
        else:
            elevation = 620 - (index - 25) * 2
        points.append(
            {
                "timestamp": index * 1_000,
                "elevation": elevation,
                "lat": 47.0 if index >= 50 else 47.0 + index * 0.0001,
                "lon": 6.0,
            }
        )

    _takeoff, landing = _flight_phase_times(points)

    assert landing is not None and 45 < landing < 55


def test_event_selection_prefers_gpx_phases_over_visual_activity():
    points = [
        {"timestamp": index * 30_000, "elevation": elevation}
        for index, elevation in enumerate(
            [500, 500, 500, 520, 540, 560, 580, 590, 570, 550, 530, 510, 500, 500]
        )
    ]

    clips = select_flight_event_clips(
        420,
        points,
        [
            HighlightClip(12, 8, 0, "dynamic"),
            HighlightClip(390, 8, 0, "dynamic"),
        ],
    )

    phase_clips = {clip.category: clip for clip in clips if clip.category in {"takeoff", "landing"}}
    assert round(phase_clips["takeoff"].start_seconds) == 77
    assert round(phase_clips["landing"].start_seconds) == 400
    assert phase_clips["takeoff"].start_seconds != 12
    assert phase_clips["landing"].start_seconds != 390


def test_probe_video_dimensions_accepts_ffprobe_trailing_separator():
    result = type("Result", (), {"stdout": "6000x3000x\n"})()
    with patch("highlight_video_worker.subprocess.run", return_value=result):
        assert _probe_video_dimensions(Path("/tmp/pano.mp4")) == (6000, 3000)


def test_set_job_stage_persists_progress_and_logs_stage():
    with (
        patch("highlight_video_worker._update_job") as update_job,
        patch("highlight_video_worker.logger") as logger,
    ):
        _set_job_stage(
            "highlight-1",
            progress=10,
            stage="frame_scoring",
            message="Analyse des images",
        )

    update_job.assert_called_once_with("highlight-1", progress=10, message="Analyse des images")
    logger.info.assert_called_once_with(
        "Highlight job stage: job_id=%s stage=%s progress=%d message=%s",
        "highlight-1",
        "frame_scoring",
        10,
        "Analyse des images",
    )


def test_render_clip_uses_overlay_as_full_frame_without_picture_in_picture(tmp_path):
    source_path = tmp_path / "pano.mp4"
    overlay_path = tmp_path / "overlay.mp4"
    output_path = tmp_path / "clip.mp4"
    source_path.touch()
    overlay_path.touch()

    with (
        patch("highlight_video_worker._probe_duration", return_value=120),
        patch("highlight_video_worker._output_dimensions", return_value=(1920, 1080)),
        patch("highlight_video_worker.select_video_accelerator", return_value="cpu"),
        patch("highlight_video_worker.h264_encode_args", return_value=["-f", "mp4"]),
        patch("highlight_video_worker.subprocess.run") as run,
    ):
        _render_clip(
            source_path,
            output_path,
            HighlightClip(start_seconds=12.5, duration_seconds=6.0, yaw_degrees=90),
            overlay_path,
            overlay_offset_seconds=2.25,
        )

    command = run.call_args.args[0]
    assert command[command.index("-ss") + 1] == "14.750"
    assert str(overlay_path) in command
    assert "-filter_complex" not in command
    assert "overlay=W-w-32:H-h-32:eof_action=pass[v]" not in command


def test_render_clip_uses_a_wide_projection_for_pano_source(tmp_path):
    source_path = tmp_path / "pano.mp4"
    output_path = tmp_path / "clip.mp4"
    source_path.touch()

    with (
        patch("highlight_video_worker._output_dimensions", return_value=(1920, 960)),
        patch("highlight_video_worker.select_video_accelerator", return_value="cpu"),
        patch("highlight_video_worker.h264_encode_args", return_value=["-f", "mp4"]),
        patch("highlight_video_worker.subprocess.run") as run,
    ):
        _render_clip(
            source_path,
            output_path,
            HighlightClip(start_seconds=12.5, duration_seconds=6.0, yaw_degrees=90),
            None,
            overlay_offset_seconds=0,
        )

    command = run.call_args.args[0]
    assert "h_fov=130:w=1920:h=960" in command[command.index("-vf") + 1]
