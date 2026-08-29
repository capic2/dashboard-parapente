from unittest.mock import Mock

import config
import highlight_video_rq_worker


def test_worker_listens_to_dedicated_highlight_queue(monkeypatch) -> None:
    queue = object()
    worker = Mock()
    worker_factory = Mock(return_value=worker)
    recover_highlights = Mock(return_value=1)

    monkeypatch.setattr(config, "HIGHLIGHT_QUEUE_NAME", "highlight-test-queue")
    monkeypatch.setattr(highlight_video_rq_worker, "is_rq_enabled", lambda: True)
    monkeypatch.setattr(
        highlight_video_rq_worker,
        "enqueue_pending_highlight_video_jobs",
        recover_highlights,
    )
    monkeypatch.setattr(highlight_video_rq_worker, "get_queue", lambda name: queue)
    monkeypatch.setattr(highlight_video_rq_worker, "get_redis_connection", lambda: "redis")
    monkeypatch.setattr(highlight_video_rq_worker, "Worker", worker_factory)

    highlight_video_rq_worker.main()

    recover_highlights.assert_called_once_with(recover_active=True)
    worker_factory.assert_called_once_with([queue], connection="redis")
    worker.work.assert_called_once_with(with_scheduler=True)
