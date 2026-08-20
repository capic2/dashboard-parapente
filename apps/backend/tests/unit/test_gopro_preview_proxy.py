import json
import os
import time
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

import pytest

import config
import gopro_preview_proxy


def test_ffmpeg_command_concatenates_start_and_target_tail_without_audio(
    tmp_path: Path,
) -> None:
    camera_path = tmp_path / "camera.mp4"
    output_path = tmp_path / "preview.mp4"

    segments = gopro_preview_proxy.preview_segments(1000, 180)
    command = gopro_preview_proxy._ffmpeg_command(
        camera_path, output_path, segments, "cpu", include_audio=False
    )

    filters = command[command.index("-filter_complex") + 1]
    assert "[0:v:0]trim=duration=180" in filters
    assert "[1:v:0]trim=duration=180" in filters
    assert command[command.index("-ss") + 1] == "820"
    assert "concat=n=2:v=1:a=0[outv]" in filters
    assert "min(854,iw)" in filters
    assert "min(480,ih)" in filters
    assert "force_divisible_by=2" in filters
    assert "-an" in command
    assert command[command.index("-movflags") + 1] == "+faststart"
    assert command[command.index("-g") + 1] == "30"


def test_ffmpeg_command_concatenates_audio_with_video(tmp_path: Path) -> None:
    camera_path = tmp_path / "camera.mp4"
    output_path = tmp_path / "preview.mp4"

    command = gopro_preview_proxy._ffmpeg_command(
        camera_path,
        output_path,
        gopro_preview_proxy.preview_segments(1000, 180),
        "cpu",
        include_audio=True,
    )

    filters = command[command.index("-filter_complex") + 1]
    assert "[0:a:0]atrim=duration=180,asetpts=PTS-STARTPTS[a0]" in filters
    assert "[1:a:0]atrim=duration=180,asetpts=PTS-STARTPTS[a1]" in filters
    assert "[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]" in filters
    assert command.count("-map") == 2
    assert "[outa]" in command
    assert command[command.index("-c:a") + 1] == "aac"
    assert "-an" not in command


def test_preview_segments_use_one_continuous_segment_when_extremities_overlap() -> None:
    assert gopro_preview_proxy.preview_segments(300, 180) == [
        gopro_preview_proxy.PreviewSegment(0.0, 0.0, 300.0)
    ]


def test_preview_segments_map_tail_to_the_requested_target() -> None:
    assert gopro_preview_proxy.preview_segments(1000, 180) == [
        gopro_preview_proxy.PreviewSegment(0.0, 0.0, 180.0),
        gopro_preview_proxy.PreviewSegment(180.0, 820.0, 180.0),
    ]


def test_request_preview_invalidates_cache_for_a_different_target(tmp_path: Path) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    (tmp_path / gopro_preview_proxy.PREVIEW_FILENAME).write_bytes(b"preview")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "ready",
                "available_duration_seconds": 180,
                "requested_duration_seconds": 180,
                "target_end_seconds": 1000.0,
            }
        )
    )

    with patch("gopro_preview_proxy._enqueue_preview") as enqueue:
        state = gopro_preview_proxy.request_preview(camera_path, 180, 900.0)

    assert state.status == "generating"
    assert state.available_duration_seconds == 0
    enqueue.assert_called_once()


def test_request_preview_reuses_target_clamped_to_source_duration(tmp_path: Path) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    (tmp_path / gopro_preview_proxy.PREVIEW_FILENAME).write_bytes(b"preview")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "ready",
                "available_duration_seconds": 180,
                "requested_duration_seconds": 180,
                "source_duration_seconds": 300.0,
                "target_end_seconds": 300.0,
            }
        )
    )

    with patch("gopro_preview_proxy._enqueue_preview") as enqueue:
        state = gopro_preview_proxy.request_preview(camera_path, 180, 400.0)

    assert state.status == "ready"
    enqueue.assert_not_called()


def test_running_extension_keeps_published_segment_metadata(tmp_path: Path) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    (tmp_path / gopro_preview_proxy.PREVIEW_FILENAME).write_bytes(b"preview")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    segments = gopro_preview_proxy.preview_segments(1000, 180)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_started_at": 1000,
                "available_duration_seconds": 180,
                "requested_duration_seconds": 600,
                "target_end_seconds": 1000.0,
                "segments": [
                    {
                        "preview_start_seconds": segment.preview_start_seconds,
                        "source_start_seconds": segment.source_start_seconds,
                        "duration_seconds": segment.duration_seconds,
                    }
                    for segment in segments
                ],
            }
        )
    )

    with patch("gopro_preview_proxy.time.time", return_value=1001):
        state = gopro_preview_proxy.get_preview_state(camera_path, 1000.0)

    assert state.status == "generating"
    assert state.segments == tuple(segments)


def test_rq_job_id_changes_between_generations(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    enqueued_ids: list[str] = []

    monkeypatch.setattr("job_queue.is_rq_enabled", lambda: True)
    monkeypatch.setattr(
        "job_queue.enqueue_once",
        lambda *_args, **kwargs: enqueued_ids.append(kwargs["job_id"]),
    )

    gopro_preview_proxy._enqueue_preview(camera_path, fingerprint, 180, "generation-a")
    gopro_preview_proxy._enqueue_preview(camera_path, fingerprint, 180, "generation-b")

    assert len(set(enqueued_ids)) == 2


def test_rq_preview_uses_dedicated_queue(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    enqueued: list[dict[str, object]] = []

    monkeypatch.setattr(config, "GOPRO_PREVIEW_QUEUE_NAME", "preview-test-queue")
    monkeypatch.setattr("job_queue.is_rq_enabled", lambda: True)
    monkeypatch.setattr(
        "job_queue.enqueue_once",
        lambda *_args, **kwargs: enqueued.append(kwargs),
    )

    gopro_preview_proxy._enqueue_preview(camera_path, fingerprint, 180, "generation")

    assert enqueued[0]["queue_name"] == "preview-test-queue"


def test_request_preview_is_cached_and_invalidated_when_camera_changes(
    tmp_path: Path,
) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    preview_path = tmp_path / gopro_preview_proxy.PREVIEW_FILENAME
    preview_path.write_bytes(b"preview")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "ready",
                "available_duration_seconds": 180,
                "requested_duration_seconds": 180,
            }
        )
    )
    with patch("gopro_preview_proxy._enqueue_preview") as enqueue:
        assert gopro_preview_proxy.request_preview(camera_path, 180).status == "ready"
        enqueue.assert_not_called()

        camera_path.write_bytes(b"replacement-camera")
        state = gopro_preview_proxy.request_preview(camera_path, 180)

    assert state.status == "generating"
    assert state.available_duration_seconds == 0
    enqueue.assert_called_once()


def test_failed_extension_keeps_existing_preview_available(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    (tmp_path / gopro_preview_proxy.PREVIEW_FILENAME).write_bytes(b"short-preview")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "available_duration_seconds": 180,
                "requested_duration_seconds": 600,
            }
        )
    )
    monkeypatch.setattr(gopro_preview_proxy, "_probe_duration", lambda _path: 1200.0)
    monkeypatch.setattr(
        gopro_preview_proxy,
        "_run_ffmpeg",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("encode failed")),
    )

    gopro_preview_proxy.process_preview_job(str(camera_path), 600)

    state = gopro_preview_proxy.get_preview_state(camera_path)
    assert state.status == "failed"
    assert state.available_duration_seconds == 180
    assert (tmp_path / gopro_preview_proxy.PREVIEW_FILENAME).read_bytes() == b"short-preview"


def test_request_preview_does_not_enqueue_an_identical_running_request(
    tmp_path: Path,
) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_started_at": 1000,
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
            }
        )
    )

    with (
        patch("gopro_preview_proxy.time.time", return_value=1001),
        patch("gopro_preview_proxy._enqueue_preview") as enqueue,
    ):
        state = gopro_preview_proxy.request_preview(camera_path, 180)

    assert state.status == "generating"
    enqueue.assert_not_called()


def test_request_preview_requeues_a_stale_running_request(tmp_path: Path) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_started_at": 1,
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
            }
        )
    )

    with (
        patch("gopro_preview_proxy.time.time", return_value=10_000),
        patch("gopro_preview_proxy._enqueue_preview") as enqueue,
    ):
        state = gopro_preview_proxy.request_preview(camera_path, 180)

    assert state.status == "generating"
    enqueue.assert_called_once()


def test_stale_running_manifest_is_not_reported_as_generating(tmp_path: Path) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_started_at": 1,
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
            }
        )
    )

    with patch("gopro_preview_proxy.time.time", return_value=10_000):
        state = gopro_preview_proxy.get_preview_state(camera_path)

    assert state.status == "missing"


def test_enqueue_failure_preserves_concurrent_manifest_fields(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME

    def fail_enqueue(*_args) -> None:
        manifest = json.loads(manifest_path.read_text())
        manifest["concurrent_field"] = "preserved"
        manifest_path.write_text(json.dumps(manifest))
        raise RuntimeError("queue unavailable")

    monkeypatch.setattr(gopro_preview_proxy, "_enqueue_preview", fail_enqueue)

    with pytest.raises(RuntimeError, match="queue unavailable"):
        gopro_preview_proxy.request_preview(camera_path, 180)

    persisted = json.loads(manifest_path.read_text())
    assert persisted["status"] == "failed"
    assert persisted["generation_started_at"] is None
    assert persisted["concurrent_field"] == "preserved"


def test_enqueue_failure_does_not_overwrite_newer_generation(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME

    def fail_old_enqueue(*_args) -> None:
        manifest = json.loads(manifest_path.read_text())
        manifest.update(
            generation_id="newer-generation",
            generation_started_at=2000,
            requested_duration_seconds=600,
        )
        manifest_path.write_text(json.dumps(manifest))
        raise RuntimeError("old queue unavailable")

    monkeypatch.setattr(gopro_preview_proxy, "_enqueue_preview", fail_old_enqueue)

    with pytest.raises(RuntimeError, match="old queue unavailable"):
        gopro_preview_proxy.request_preview(camera_path, 180)

    persisted = json.loads(manifest_path.read_text())
    assert persisted["status"] == "generating"
    assert persisted["generation_id"] == "newer-generation"
    assert persisted["requested_duration_seconds"] == 600


def test_old_job_does_not_overwrite_manifest_for_replaced_camera(
    tmp_path: Path, monkeypatch
) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"old-camera")
    old_fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": old_fingerprint.size,
                    "mtime_ns": old_fingerprint.mtime_ns,
                },
                "status": "generating",
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
            }
        )
    )
    monkeypatch.setattr(gopro_preview_proxy, "_probe_duration", lambda _path: 1200.0)

    def replace_camera(_camera: Path, output: Path, _duration: int) -> None:
        output.write_bytes(b"preview")
        camera_path.write_bytes(b"new-replacement-camera")
        new_fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
        manifest_path.write_text(
            json.dumps(
                {
                    "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                    "source": {
                        "size": new_fingerprint.size,
                        "mtime_ns": new_fingerprint.mtime_ns,
                    },
                    "status": "generating",
                    "available_duration_seconds": 0,
                    "requested_duration_seconds": 180,
                }
            )
        )

    monkeypatch.setattr(gopro_preview_proxy, "_run_ffmpeg", replace_camera)

    gopro_preview_proxy.process_preview_job(str(camera_path), 180)

    persisted = json.loads(manifest_path.read_text())
    assert persisted["source"]["size"] == len(b"new-replacement-camera")
    assert persisted["status"] == "generating"


def test_camera_replacement_just_before_publish_does_not_publish_old_preview(
    tmp_path: Path, monkeypatch
) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"old-camera")
    old_fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": old_fingerprint.size,
                    "mtime_ns": old_fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_id": "old-generation",
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
            }
        )
    )
    probe_calls = iter([1200.0, 180.0])
    monkeypatch.setattr(gopro_preview_proxy, "_probe_duration", lambda _path: next(probe_calls))
    monkeypatch.setattr(
        gopro_preview_proxy,
        "_run_ffmpeg",
        lambda _camera, output, _duration: output.write_bytes(b"old-preview"),
    )
    original_state_lock = gopro_preview_proxy._state_lock

    @contextmanager
    def replace_before_state_lock(path: Path):
        camera_path.write_bytes(b"new-replacement-camera")
        new_fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
        manifest_path.write_text(
            json.dumps(
                {
                    "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                    "source": {
                        "size": new_fingerprint.size,
                        "mtime_ns": new_fingerprint.mtime_ns,
                    },
                    "status": "generating",
                    "generation_id": "new-generation",
                    "available_duration_seconds": 0,
                    "requested_duration_seconds": 180,
                }
            )
        )
        with original_state_lock(path):
            yield

    monkeypatch.setattr(gopro_preview_proxy, "_state_lock", replace_before_state_lock)

    gopro_preview_proxy.process_preview_job(str(camera_path), 180, "old-generation")

    persisted = json.loads(manifest_path.read_text())
    assert persisted["generation_id"] == "new-generation"
    assert not (tmp_path / gopro_preview_proxy.PREVIEW_FILENAME).exists()


def test_old_encode_failure_does_not_overwrite_newer_generation(
    tmp_path: Path, monkeypatch
) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_id": "old-generation",
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
            }
        )
    )
    monkeypatch.setattr(gopro_preview_proxy, "_probe_duration", lambda _path: 1200.0)

    def fail_old_encode(*_args) -> None:
        manifest = json.loads(manifest_path.read_text())
        manifest.update(
            generation_id="new-generation",
            generation_started_at=2000,
            requested_duration_seconds=600,
        )
        manifest_path.write_text(json.dumps(manifest))
        raise RuntimeError("old encode failed")

    monkeypatch.setattr(gopro_preview_proxy, "_run_ffmpeg", fail_old_encode)

    gopro_preview_proxy.process_preview_job(str(camera_path), 180, "old-generation")

    persisted = json.loads(manifest_path.read_text())
    assert persisted["status"] == "generating"
    assert persisted["generation_id"] == "new-generation"
    assert persisted["requested_duration_seconds"] == 600


def test_request_preview_reuses_proxy_covering_a_short_source(tmp_path: Path) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    (tmp_path / gopro_preview_proxy.PREVIEW_FILENAME).write_bytes(b"preview")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    (tmp_path / gopro_preview_proxy.MANIFEST_FILENAME).write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "ready",
                "available_duration_seconds": 60,
                "requested_duration_seconds": 60,
                "source_duration_seconds": 59.8,
            }
        )
    )

    with patch("gopro_preview_proxy._enqueue_preview") as enqueue:
        state = gopro_preview_proxy.request_preview(camera_path, 180)

    assert state.status == "ready"
    enqueue.assert_not_called()


def test_process_preview_enqueues_longer_request_received_during_generation(
    tmp_path: Path, monkeypatch
) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
            }
        )
    )
    probe_calls = iter([1200.0, 180.0])
    monkeypatch.setattr(gopro_preview_proxy, "_probe_duration", lambda _path: next(probe_calls))

    def finish_encode(_camera: Path, output: Path, _duration: int) -> None:
        output.write_bytes(b"preview")
        manifest = json.loads(manifest_path.read_text())
        manifest["requested_duration_seconds"] = 600
        manifest_path.write_text(json.dumps(manifest))

    monkeypatch.setattr(gopro_preview_proxy, "_run_ffmpeg", finish_encode)

    with patch("gopro_preview_proxy._enqueue_preview") as enqueue:
        gopro_preview_proxy.process_preview_job(str(camera_path), 180)

    enqueue.assert_called_once()
    assert enqueue.call_args.args[2] == 600


def test_process_preview_records_measured_truncated_duration(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_id": "generation",
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
                "target_end_seconds": 60.0,
            }
        )
    )
    probe_calls = iter([1200.0, 59.2])
    monkeypatch.setattr(gopro_preview_proxy, "_probe_duration", lambda _path: next(probe_calls))
    monkeypatch.setattr(
        gopro_preview_proxy,
        "_run_ffmpeg",
        lambda _camera, output, _duration: output.write_bytes(b"truncated-preview"),
    )

    gopro_preview_proxy.process_preview_job(str(camera_path), 180, "generation", 60.0)

    persisted = json.loads(manifest_path.read_text())
    assert persisted["available_duration_seconds"] == 59
    assert persisted["requested_duration_seconds"] == 180


def test_process_preview_records_target_and_segment_metadata(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "camera.mp4"
    camera_path.write_bytes(b"camera")
    fingerprint = gopro_preview_proxy._source_fingerprint(camera_path)
    manifest_path = tmp_path / gopro_preview_proxy.MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(
            {
                "profile_version": gopro_preview_proxy.PROFILE_VERSION,
                "source": {
                    "size": fingerprint.size,
                    "mtime_ns": fingerprint.mtime_ns,
                },
                "status": "generating",
                "generation_id": "generation",
                "available_duration_seconds": 0,
                "requested_duration_seconds": 180,
                "target_end_seconds": 1000.0,
            }
        )
    )
    probe_calls = iter([1200.0, 360.0])
    monkeypatch.setattr(gopro_preview_proxy, "_probe_duration", lambda _path: next(probe_calls))
    monkeypatch.setattr(
        gopro_preview_proxy,
        "_run_ffmpeg",
        lambda _camera, output, _segments: output.write_bytes(b"preview"),
    )

    gopro_preview_proxy.process_preview_job(str(camera_path), 180, "generation", 1000.0)

    persisted = json.loads(manifest_path.read_text())
    assert persisted["available_duration_seconds"] == 180
    assert persisted["target_end_seconds"] == 1000.0
    assert persisted["segments"] == [
        {
            "preview_start_seconds": 0.0,
            "source_start_seconds": 0.0,
            "duration_seconds": 180.0,
        },
        {
            "preview_start_seconds": 180.0,
            "source_start_seconds": 820.0,
            "duration_seconds": 180.0,
        },
    ]


def test_scanner_waits_for_stable_camera_observation(tmp_path: Path, monkeypatch) -> None:
    camera_path = tmp_path / "20260315" / "01" / "camera.mp4"
    camera_path.parent.mkdir(parents=True)
    camera_path.write_bytes(b"camera")
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(tmp_path))
    monkeypatch.setattr(config, "GOPRO_PREVIEW_STABLE_SECONDS", 30)
    requested: list[tuple[Path, int]] = []
    monkeypatch.setattr(
        gopro_preview_proxy,
        "request_preview",
        lambda path, duration: requested.append((path, duration)),
    )
    gopro_preview_proxy._STABILITY_OBSERVATIONS.clear()

    with patch("gopro_preview_proxy.time.monotonic", side_effect=[100.0, 131.0]):
        assert gopro_preview_proxy.scan_for_gopro_previews() == 0
        assert gopro_preview_proxy.scan_for_gopro_previews() == 1

    assert requested == [(camera_path, config.GOPRO_PREVIEW_DEFAULT_SECONDS)]


def test_scanner_removes_only_stale_preview_temporary_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    camera_path = tmp_path / "20260315" / "01" / "camera.mp4"
    camera_path.parent.mkdir(parents=True)
    camera_path.write_bytes(b"camera")
    stale_video = camera_path.with_name(".camera.preview.mp4.123.part.mp4")
    stale_manifest = camera_path.with_name(".camera.preview.json.123.456.tmp")
    recent_video = camera_path.with_name(".camera.preview.mp4.789.part.mp4")
    for path in (stale_video, stale_manifest, recent_video):
        path.write_bytes(b"temporary")
    stale_mtime = time.time() - 301
    os.utime(stale_video, (stale_mtime, stale_mtime))
    os.utime(stale_manifest, (stale_mtime, stale_mtime))
    monkeypatch.setattr(config, "GOPRO_OVERLAY_PARAGLIDING_ROOT", str(tmp_path))
    monkeypatch.setattr(config, "GOPRO_PREVIEW_TIMEOUT_SECONDS", 300)
    gopro_preview_proxy._STABILITY_OBSERVATIONS.clear()

    assert gopro_preview_proxy.scan_for_gopro_previews() == 0

    assert not stale_video.exists()
    assert not stale_manifest.exists()
    assert recent_video.exists()
