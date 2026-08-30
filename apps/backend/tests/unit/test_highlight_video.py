from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
import pytest

from models import Flight, HighlightVideoJob
from highlight_video import HighlightClip, clamp_clip, overlay_interval_for_clip
import highlight_video_worker
from highlight_video_worker import (
    _probe_video_dimensions,
    _output_dimensions,
    _clip_creation_time,
    _clip_is_covered_by_gpx,
    _render_clip,
    _render_method_for_accelerator,
    _set_job_stage,
    _flight_phase_times,
    _render_gopro_overlay,
    select_flight_event_clips,
)


def test_render_method_matches_selected_accelerator() -> None:
    assert _render_method_for_accelerator("nvidia") == "gpu"
    assert _render_method_for_accelerator("cpu") == "cpu"


def test_best_yaw_allows_a_face_view_when_no_clearer_view_exists(tmp_path: Path) -> None:
    source_path = tmp_path / "pano.mp4"
    source_path.touch()
    tiled = np.full((320, 1280, 3), [200, 140, 120], dtype=np.uint8)

    with patch(
        "highlight_video_worker.subprocess.run",
        return_value=Mock(stdout=tiled.tobytes()),
    ) as run:
        yaw = highlight_video_worker._best_yaw(
            source_path,
            HighlightClip(start_seconds=0, duration_seconds=8, yaw_degrees=0),
        )

    assert yaw == -180
    command = run.call_args.args[0]
    assert (
        "scale=3840:1920:flags=fast_bilinear,v360" in command[command.index("-filter_complex") + 1]
    )


def test_output_dimensions_keep_2_to_1_pano_at_worker_width(tmp_path: Path) -> None:
    source_path = tmp_path / "pano.mp4"
    source_path.touch()
    with patch("highlight_video_worker._probe_video_dimensions", return_value=(7680, 3840)):
        assert _output_dimensions(source_path) == (1920, 960)


def test_best_yaw_prefers_clear_centre_over_a_face_filling_the_view(tmp_path: Path) -> None:
    source_path = tmp_path / "pano.mp4"
    source_path.touch()
    tiled = np.full((320, 1280, 3), [80, 120, 160], dtype=np.uint8)
    # The first candidate is dominated by skin in the centre; the next yaw
    # keeps the landscape clear and should therefore win despite the wider
    # scorer still allowing a pilot at the edge of the frame.
    tiled[40:280, 64:256] = [190, 135, 115]

    with patch(
        "highlight_video_worker.subprocess.run",
        return_value=Mock(stdout=tiled.tobytes()),
    ):
        yaw = highlight_video_worker._best_yaw(
            source_path,
            HighlightClip(start_seconds=0, duration_seconds=8, yaw_degrees=0),
        )

    assert yaw == -135


def test_best_yaw_keeps_a_clear_view_with_pilot_at_the_edge(tmp_path: Path) -> None:
    source_path = tmp_path / "pano.mp4"
    source_path.touch()
    tiled = np.full((320, 1280, 3), [35, 35, 35], dtype=np.uint8)
    tiled[:160, :320] = [80, 120, 160]
    tiled[:160, :48] = [190, 135, 115]

    with patch(
        "highlight_video_worker.subprocess.run",
        return_value=Mock(stdout=tiled.tobytes()),
    ):
        yaw = highlight_video_worker._best_yaw(
            source_path,
            HighlightClip(start_seconds=0, duration_seconds=8, yaw_degrees=0),
        )

    assert yaw == -180


def test_source_timeline_start_aligns_the_osv_timestamp(tmp_path: Path) -> None:
    source = tmp_path / "pano.mp4"
    gpx = tmp_path / "external.gpx"
    osv = tmp_path / "flight.OSV"
    gpx_start = datetime(2026, 8, 26, 17, 44, 47, tzinfo=timezone.utc)
    osv_start = datetime(2026, 8, 26, 18, 44, 6, tzinfo=timezone.utc)
    aligned = datetime(2026, 8, 26, 17, 44, 6, tzinfo=timezone.utc)

    with (
        patch("highlight_video_worker.latest_matching_file", return_value=osv),
        patch("gopro_overlay_export.first_gpx_timestamp", return_value=gpx_start),
        patch("gopro_overlay_export.probe_video_start_time", return_value=osv_start),
        patch("gopro_overlay_export.align_video_start_time_to_gpx", return_value=aligned) as align,
    ):
        result = highlight_video_worker._source_timeline_start(source, gpx)

    assert result == aligned
    align.assert_called_once_with(osv_start, gpx_start)


def test_source_timeline_start_falls_back_to_gpx_when_osv_timestamp_is_missing(
    tmp_path: Path,
) -> None:
    source = tmp_path / "pano.mp4"
    gpx = tmp_path / "external.gpx"
    osv = tmp_path / "flight.OSV"
    gpx_start = datetime(2026, 8, 26, 17, 44, 47, tzinfo=timezone.utc)

    with (
        patch("highlight_video_worker.latest_matching_file", return_value=osv),
        patch("gopro_overlay_export.first_gpx_timestamp", return_value=gpx_start),
        patch("gopro_overlay_export.probe_video_start_time", return_value=None),
        patch("gopro_overlay_export.align_video_start_time_to_gpx") as align,
    ):
        result = highlight_video_worker._source_timeline_start(source, gpx)

    assert result == gpx_start
    align.assert_not_called()


def test_clip_creation_time_uses_gpx_aligned_utc_timeline_without_legacy_offset() -> None:
    timeline_start = datetime(2026, 8, 26, 17, 44, 6, tzinfo=timezone.utc)
    clip = HighlightClip(start_seconds=120, duration_seconds=8, yaw_degrees=0)

    assert _clip_creation_time(timeline_start, clip, 15142.8) == datetime(
        2026, 8, 26, 17, 46, 6, tzinfo=timezone.utc
    )


def test_clip_gpx_coverage_rejects_clip_after_track_end() -> None:
    timeline_start = datetime(2026, 8, 26, 17, 44, 47, tzinfo=timezone.utc)
    track_points = [
        {"timestamp": int(timeline_start.timestamp() * 1000)},
        {"timestamp": int((timeline_start + timedelta(seconds=181)).timestamp() * 1000)},
    ]

    assert _clip_is_covered_by_gpx(
        timeline_start,
        HighlightClip(start_seconds=172, duration_seconds=8, yaw_degrees=0),
        track_points,
    )
    assert not _clip_is_covered_by_gpx(
        timeline_start,
        HighlightClip(start_seconds=197, duration_seconds=8, yaw_degrees=0),
        track_points,
    )


def test_clip_gpx_coverage_rejects_clip_before_track_start() -> None:
    timeline_start = datetime(2026, 8, 26, 17, 44, 6, tzinfo=timezone.utc)
    gpx_start = timeline_start + timedelta(seconds=41)
    track_points = [
        {"timestamp": int(gpx_start.timestamp() * 1000)},
        {"timestamp": int((gpx_start + timedelta(seconds=181)).timestamp() * 1000)},
    ]

    assert not _clip_is_covered_by_gpx(
        timeline_start,
        HighlightClip(start_seconds=20, duration_seconds=8, yaw_degrees=0),
        track_points,
    )
    assert _clip_is_covered_by_gpx(
        timeline_start,
        HighlightClip(start_seconds=41, duration_seconds=8, yaw_degrees=0),
        track_points,
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


def test_worker_persists_gpu_render_method_when_claiming_job(test_db, monkeypatch):
    monkeypatch.setattr(highlight_video_worker, "SessionLocal", test_db)
    monkeypatch.setattr(
        highlight_video_worker, "select_video_accelerator", lambda _configured: "nvidia"
    )
    monkeypatch.setattr(
        highlight_video_worker,
        "_probe_duration",
        Mock(side_effect=RuntimeError("stop after claim")),
    )
    with test_db() as db:
        db.add(Flight(id="flight-gpu", name="GPU", flight_date=date(2026, 8, 30)))
        db.add(
            HighlightVideoJob(
                id="highlight-gpu",
                flight_id="flight-gpu",
                status="queued",
                progress=0,
                source_video_path="/tmp/pano.mp4",
            )
        )
        db.commit()

    highlight_video_worker.process_highlight_video_job("highlight-gpu")

    with test_db() as db:
        job = db.get(HighlightVideoJob, "highlight-gpu")
        assert job is not None
        assert job.render_method == "gpu"


def test_clip_maps_pano_time_to_overlay_time():
    clip = HighlightClip(start_seconds=12.5, duration_seconds=6.0, yaw_degrees=90)

    assert clip.overlay_start_seconds(2.25) == 14.75
    assert clip.overlay_end_seconds(2.25) == 20.75


def test_select_highlight_clips_forwards_analysis_progress(tmp_path, monkeypatch):
    progress: list[tuple[int, int]] = []
    monkeypatch.setattr(
        highlight_video_worker,
        "_frame_scores",
        lambda _source, _duration, callback=None: callback(1, 2) or [] if callback else [],
    )

    highlight_video_worker.select_highlight_clips(
        60, tmp_path / "pano.mp4", lambda completed, total: progress.append((completed, total))
    )

    assert progress == [(1, 2)]


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


def test_render_clip_never_incrusts_an_existing_video_overlay(tmp_path: Path) -> None:
    source_path = tmp_path / "pano.mp4"
    output_path = tmp_path / "clip.mp4"
    source_path.touch()

    with (
        patch("highlight_video_worker._output_dimensions", return_value=(1920, 1080)),
        patch("highlight_video_worker.select_video_accelerator", return_value="cpu"),
        patch("highlight_video_worker.h264_encode_args", return_value=["-f", "mp4"]) as encode_args,
        patch("highlight_video_worker.subprocess.run") as run,
    ):
        _render_clip(
            source_path,
            output_path,
            HighlightClip(start_seconds=12.5, duration_seconds=6.0, yaw_degrees=90),
        )

    command = run.call_args.args[0]
    assert command[command.index("-ss") + 1] == "12.500"
    assert str(source_path) in command
    assert command.count("-i") == 1
    assert "-filter_complex" not in command
    video_filter = command[command.index("-vf") + 1]
    assert "output=cylindrical" in video_filter
    assert "scale=3840:1920:flags=fast_bilinear,v360" in video_filter
    assert "h_fov=160:w=1920:h=1080" in video_filter
    assert command[command.index("-map") + 1] == "0:v:0"
    shortest_index = command.index("-shortest")
    assert command[shortest_index + 1 : shortest_index + 3] == ["-t", "6.000"]
    assert encode_args.call_args.kwargs["quality"] == "18"


def test_render_clip_uses_a_wide_projection_for_pano_source(tmp_path: Path) -> None:
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
        )

    command = run.call_args.args[0]
    assert "output=cylindrical" in command[command.index("-vf") + 1]
    assert "h_fov=160:w=1920:h=960" in command[command.index("-vf") + 1]


def test_render_clip_embeds_the_selected_source_time_for_gopro_overlay(tmp_path: Path) -> None:
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
            HighlightClip(start_seconds=120, duration_seconds=8, yaw_degrees=0),
            creation_time=datetime(2026, 8, 26, 17, 46, 6, tzinfo=timezone.utc),
        )

    command = run.call_args.args[0]
    assert command.count("creation_time=2026-08-26T17:46:06Z") == 2


def test_render_clip_enables_cuda_decode_for_nvidia_inputs(tmp_path: Path) -> None:
    source_path = tmp_path / "pano.mp4"
    output_path = tmp_path / "clip.mp4"
    source_path.touch()

    with (
        patch("highlight_video_worker._output_dimensions", return_value=(1920, 960)),
        patch("highlight_video_worker.select_video_accelerator", return_value="nvidia"),
        patch("highlight_video_worker.h264_encode_args", return_value=["-f", "mp4"]),
        patch("highlight_video_worker.subprocess.run") as run,
    ):
        _render_clip(
            source_path,
            output_path,
            HighlightClip(start_seconds=12.5, duration_seconds=6.0, yaw_degrees=90),
        )

    command = run.call_args.args[0]
    input_indexes = [index for index, value in enumerate(command) if value == "-i"]
    assert len(input_indexes) == 1
    assert all(command[index - 2 : index] == ["-hwaccel", "cuda"] for index in input_indexes)


def test_render_gopro_overlay_uses_parapente_layout_with_flight_pip(tmp_path: Path) -> None:
    montage = tmp_path / "highlights-pano.mp4"
    gpx = tmp_path / "highlights.gpx"
    pip = tmp_path / "flight.mp4"
    output = tmp_path / "highlights.mp4"
    output.touch()
    completed = {"status": "completed", "progress": 100, "message": "done"}

    with (
        patch(
            "gopro_overlay_export.create_gopro_overlay_job_from_paths",
            return_value={"job_id": "overlay-1"},
        ) as create_job,
        patch("gopro_overlay_export.get_gopro_overlay_job", return_value=completed),
    ):
        completed_result = _render_gopro_overlay(montage, gpx, pip, output)

    assert completed_result is True

    create_job.assert_called_once_with(
        video_path=montage,
        gpx_path=gpx,
        pip_path=pip,
        layout_id="parapente-3840",
        output_filename=output.name,
        output_resolution="source",
        output_dir=str(tmp_path),
        flight_id=None,
    )


def test_render_gopro_overlay_cancels_its_child_job(tmp_path: Path) -> None:
    montage = tmp_path / "highlights-pano.mp4"
    gpx = tmp_path / "highlights.gpx"
    pip = tmp_path / "flight.mp4"
    output = tmp_path / "highlights.mp4"

    with (
        patch(
            "gopro_overlay_export.create_gopro_overlay_job_from_paths",
            return_value={"job_id": "overlay-1"},
        ),
        patch("gopro_overlay_export.cancel_gopro_overlay_job") as cancel_job,
        patch("gopro_overlay_export.get_gopro_overlay_job") as get_job,
    ):
        completed_result = _render_gopro_overlay(
            montage,
            gpx,
            pip,
            output,
            cancellation_callback=lambda: True,
        )

    assert completed_result is False
    cancel_job.assert_called_once_with("overlay-1")
    get_job.assert_not_called()


def test_render_gopro_overlay_reports_child_failure(tmp_path: Path) -> None:
    output = tmp_path / "highlights.mp4"
    failed = {"status": "failed", "progress": 10, "error": "renderer crashed"}

    with (
        patch(
            "gopro_overlay_export.create_gopro_overlay_job_from_paths",
            return_value={"job_id": "overlay-1"},
        ),
        patch("gopro_overlay_export.get_gopro_overlay_job", return_value=failed),
        pytest.raises(RuntimeError, match="renderer crashed"),
    ):
        _render_gopro_overlay(
            tmp_path / "pano.mp4",
            tmp_path / "flight.gpx",
            tmp_path / "flight.mp4",
            output,
        )


def test_render_gopro_overlay_times_out(tmp_path: Path) -> None:
    output = tmp_path / "highlights.mp4"

    with (
        patch(
            "gopro_overlay_export.create_gopro_overlay_job_from_paths",
            return_value={"job_id": "overlay-1"},
        ),
        patch("highlight_video_worker.time.monotonic", side_effect=[0, 999999]),
        pytest.raises(TimeoutError, match="dépassé le délai"),
    ):
        _render_gopro_overlay(
            tmp_path / "pano.mp4",
            tmp_path / "flight.gpx",
            tmp_path / "flight.mp4",
            output,
        )
