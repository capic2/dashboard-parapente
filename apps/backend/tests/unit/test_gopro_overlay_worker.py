from unittest.mock import Mock

import config
import gopro_overlay_worker


def test_worker_listens_to_overlay_before_preview_queue(monkeypatch) -> None:
    overlay_queue = object()
    preview_queue = object()
    queues = {
        "overlay-test-queue": overlay_queue,
        "preview-test-queue": preview_queue,
    }
    worker = Mock()
    worker_factory = Mock(return_value=worker)

    monkeypatch.setattr(config, "GOPRO_OVERLAY_QUEUE_NAME", "overlay-test-queue")
    monkeypatch.setattr(config, "GOPRO_PREVIEW_QUEUE_NAME", "preview-test-queue")
    monkeypatch.setattr(gopro_overlay_worker, "is_rq_enabled", lambda: True)
    monkeypatch.setattr(gopro_overlay_worker, "_require_gpu_runtime", lambda: None)
    monkeypatch.setattr(
        gopro_overlay_worker,
        "enqueue_pending_gopro_overlay_jobs",
        lambda **_kwargs: 0,
    )
    monkeypatch.setattr(gopro_overlay_worker, "get_queue", queues.__getitem__)
    monkeypatch.setattr(gopro_overlay_worker, "get_redis_connection", lambda: "redis")
    monkeypatch.setattr(gopro_overlay_worker, "Worker", worker_factory)

    gopro_overlay_worker.main()

    worker_factory.assert_called_once_with([overlay_queue, preview_queue], connection="redis")
    worker.work.assert_called_once_with(with_scheduler=True)


def test_worker_recovers_active_overlay_jobs_before_listening(monkeypatch) -> None:
    queue = object()
    worker = Mock()
    worker_factory = Mock(return_value=worker)
    recover_overlays = Mock(return_value=1)

    monkeypatch.setattr(gopro_overlay_worker, "is_rq_enabled", lambda: True)
    monkeypatch.setattr(gopro_overlay_worker, "_require_gpu_runtime", lambda: None)
    monkeypatch.setattr(
        gopro_overlay_worker, "enqueue_pending_gopro_overlay_jobs", recover_overlays
    )
    monkeypatch.setattr(gopro_overlay_worker, "get_queue", lambda _queue_name: queue)
    monkeypatch.setattr(gopro_overlay_worker, "get_redis_connection", lambda: "redis")
    monkeypatch.setattr(gopro_overlay_worker, "Worker", worker_factory)

    gopro_overlay_worker.main()

    recover_overlays.assert_called_once_with(recover_active=True)
