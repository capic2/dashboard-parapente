import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import Mock

import config
import job_queue
import youtube_upload
import youtube_upload_worker


def test_worker_import_does_not_require_weatherapi_key() -> None:
    environment = os.environ.copy()
    environment.update(
        {
            "ENVIRONMENT": "production",
            "TESTING": "false",
            "BACKEND_DATABASE_URL": "sqlite:///worker-import.db",
            "BACKEND_LOG_FILE": "/tmp/youtube-worker-import.log",
            "BACKEND_JWT_SECRET": "worker-import-secret",
            "BACKEND_METRICS_TOKEN": "worker-import-metrics",
        }
    )
    environment.pop("BACKEND_WEATHERAPI_KEY", None)

    result = subprocess.run(
        [sys.executable, "-c", "import youtube_upload_worker"],
        cwd=Path(youtube_upload_worker.__file__).parent,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr


def test_upload_jobs_are_enqueued_on_dedicated_queue(monkeypatch) -> None:
    enqueue_once = Mock()
    monkeypatch.setattr(config, "YOUTUBE_UPLOAD_QUEUE_NAME", "youtube-test-queue")
    monkeypatch.setattr(job_queue, "enqueue_once", enqueue_once)

    youtube_upload._enqueue_rq("upload-job")

    enqueue_once.assert_called_once_with(
        "youtube_upload.process_youtube_upload",
        "upload-job",
        job_id="youtube-upload-upload-job",
        timeout=config.JOB_QUEUE_TIMEOUT_SECONDS,
        queue_name="youtube-test-queue",
    )


def test_failed_overlay_upload_cleanup_preserves_flight_workspace_for_retry(
    tmp_path, monkeypatch
) -> None:
    flight_root = tmp_path / "paragliding"
    export_root = tmp_path / "legacy-exports"
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(flight_root))
    monkeypatch.setattr(config, "VIDEO_EXPORT_DIR", str(export_root))
    job_id = "overlay-job"
    work_dir = flight_root / "20261016" / "01" / "temp" / "youtube-exports" / job_id
    source_path = work_dir / f"youtube-overlay-{job_id}.mp4"
    source_path.parent.mkdir(parents=True)
    source_path.write_bytes(b"generated video")
    cached_source = work_dir / "source.mp4"
    cached_source.write_bytes(b"cached source")

    youtube_upload._delete_generated_overlay_source(source_path)

    assert work_dir.is_dir()
    assert not source_path.exists()
    assert cached_source.read_bytes() == b"cached source"


def test_completed_overlay_upload_cleanup_removes_flight_temp_workspace(
    tmp_path, monkeypatch
) -> None:
    flight_root = tmp_path / "paragliding"
    export_root = tmp_path / "legacy-exports"
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(flight_root))
    monkeypatch.setattr(config, "VIDEO_EXPORT_DIR", str(export_root))
    job_id = "overlay-job"
    work_dir = flight_root / "20261016" / "01" / "temp" / "youtube-exports" / job_id
    source_path = work_dir / f"youtube-overlay-{job_id}.mp4"
    source_path.parent.mkdir(parents=True)
    source_path.write_bytes(b"generated video")

    youtube_upload._delete_generated_overlay_source(source_path, cleanup_workspace=True)

    assert not work_dir.exists()


def test_generated_overlay_cleanup_rejects_parent_symlink_outside_flight_root(
    tmp_path, monkeypatch
) -> None:
    flight_root = tmp_path / "paragliding"
    export_root = tmp_path / "legacy-exports"
    outside_temp = tmp_path / "outside" / "temp"
    monkeypatch.setattr(config, "PARAGLIDING_DATA_ROOT", str(flight_root))
    monkeypatch.setattr(config, "VIDEO_EXPORT_DIR", str(export_root))
    job_id = "overlay-job"
    outside_work_dir = outside_temp / "youtube-exports" / job_id
    source_path = (
        flight_root
        / "20261016"
        / "01"
        / "temp"
        / "youtube-exports"
        / job_id
        / f"youtube-overlay-{job_id}.mp4"
    )
    outside_work_dir.mkdir(parents=True)
    outside_source_path = outside_work_dir / source_path.name
    outside_source_path.write_bytes(b"generated video")
    (flight_root / "20261016" / "01").mkdir(parents=True)
    (flight_root / "20261016" / "01" / "temp").symlink_to(outside_temp)

    youtube_upload._delete_generated_overlay_source(source_path, cleanup_workspace=True)

    assert outside_source_path.read_bytes() == b"generated video"
    assert outside_work_dir.is_dir()


def test_legacy_shared_queue_job_is_removed_before_requeue(monkeypatch) -> None:
    legacy_job = Mock(origin="video-test-queue")
    queue = Mock()
    queue.fetch_job.return_value = legacy_job
    delete_job = Mock(return_value=True)
    monkeypatch.setattr(config, "JOB_QUEUE_NAME", "video-test-queue")
    monkeypatch.setattr(config, "YOUTUBE_UPLOAD_QUEUE_NAME", "youtube-test-queue")
    monkeypatch.setattr(job_queue, "get_queue", Mock(return_value=queue))
    monkeypatch.setattr(job_queue, "delete_job", delete_job)

    youtube_upload._remove_legacy_rq_job("upload-job")

    delete_job.assert_called_once_with(
        "youtube-upload-upload-job",
        queue_name="video-test-queue",
    )


def test_source_video_path_refresh_finds_regular_file(tmp_path: Path) -> None:
    video_path = tmp_path / "pano.mp4"
    video_path.write_bytes(b"video")

    assert youtube_upload._refresh_source_video_path(video_path) == video_path


def test_source_video_path_refresh_returns_none_when_file_is_missing(
    tmp_path: Path,
) -> None:
    assert youtube_upload._refresh_source_video_path(tmp_path / "missing.mp4") is None


def test_source_video_path_refresh_ignores_symlink(tmp_path: Path) -> None:
    target_path = tmp_path / "target.mp4"
    target_path.write_bytes(b"video")
    video_path = tmp_path / "pano.mp4"
    video_path.symlink_to(target_path)

    assert youtube_upload._refresh_source_video_path(video_path) is None


def test_worker_recovers_uploads_and_listens_only_to_dedicated_queue(
    monkeypatch,
) -> None:
    queue = object()
    worker = Mock()
    worker_factory = Mock(return_value=worker)
    recover_uploads = Mock(return_value=1)
    monkeypatch.setattr(config, "YOUTUBE_UPLOAD_QUEUE_NAME", "youtube-test-queue")
    monkeypatch.setattr(youtube_upload_worker, "is_rq_enabled", lambda: True)
    monkeypatch.setattr(
        youtube_upload_worker,
        "enqueue_pending_youtube_uploads",
        recover_uploads,
    )
    monkeypatch.setattr(youtube_upload_worker, "get_queue", Mock(return_value=queue))
    monkeypatch.setattr(youtube_upload_worker, "get_redis_connection", lambda: "redis")
    monkeypatch.setattr(youtube_upload_worker, "Worker", worker_factory)

    youtube_upload_worker.main()

    recover_uploads.assert_called_once_with(
        recover_active=True,
        migrate_legacy_queue=True,
    )
    youtube_upload_worker.get_queue.assert_called_once_with("youtube-test-queue")
    worker_factory.assert_called_once_with([queue], connection="redis")
    worker.work.assert_called_once_with(with_scheduler=True)
