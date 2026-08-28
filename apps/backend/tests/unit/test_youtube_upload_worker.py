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
