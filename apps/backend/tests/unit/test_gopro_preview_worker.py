from unittest.mock import Mock

import pytest

import config
import gopro_preview_worker


def test_preview_worker_listens_to_preview_queue_only(monkeypatch: pytest.MonkeyPatch) -> None:
    preview_queue = object()
    worker = Mock()
    worker_factory = Mock(return_value=worker)

    monkeypatch.setattr(config, "GOPRO_PREVIEW_QUEUE_NAME", "preview-test-queue")
    monkeypatch.setattr(gopro_preview_worker, "is_rq_enabled", lambda: True)
    monkeypatch.setattr(gopro_preview_worker, "get_queue", lambda _queue_name: preview_queue)
    monkeypatch.setattr(gopro_preview_worker, "get_redis_connection", lambda: "redis")
    monkeypatch.setattr(gopro_preview_worker, "Worker", worker_factory)

    gopro_preview_worker.main()

    worker_factory.assert_called_once_with([preview_queue], connection="redis")
    worker.work.assert_called_once_with(with_scheduler=True)
