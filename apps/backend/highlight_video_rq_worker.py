"""RQ worker entrypoint dedicated to highlight video jobs."""

from __future__ import annotations

import logging
import threading

from rq import Worker

import config
from highlight_video_worker import enqueue_pending_highlight_video_jobs
from job_queue import get_queue, get_redis_connection, is_rq_enabled

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _reconciliation_loop(stop_event: threading.Event) -> None:
    """Continuously restore queued database jobs missing from Redis."""
    while not stop_event.wait(config.JOB_QUEUE_RECONCILIATION_INTERVAL_SECONDS):
        try:
            queued_count = enqueue_pending_highlight_video_jobs(recover_active=True)
            if queued_count:
                logger.info("Reconciled %s pending highlight video job(s)", queued_count)
        except Exception:
            logger.warning("Could not reconcile pending highlight video jobs", exc_info=True)


def main() -> None:
    if not is_rq_enabled():
        raise RuntimeError("Highlight video RQ worker requires BACKEND_JOB_QUEUE_BACKEND=rq")

    queued_count = enqueue_pending_highlight_video_jobs(recover_active=True)
    if queued_count:
        logger.info("Enqueued %s pending highlight video job(s)", queued_count)

    queue = get_queue(config.HIGHLIGHT_QUEUE_NAME)
    worker = Worker([queue], connection=get_redis_connection())
    logger.info(
        "Starting highlight video RQ worker for queue '%s'",
        config.HIGHLIGHT_QUEUE_NAME,
    )
    stop_reconciliation = threading.Event()
    reconciliation_thread = threading.Thread(
        target=_reconciliation_loop,
        args=(stop_reconciliation,),
        name="highlight-video-queue-reconciliation",
        daemon=True,
    )
    reconciliation_thread.start()
    try:
        worker.work(with_scheduler=True)
    finally:
        stop_reconciliation.set()
        reconciliation_thread.join(timeout=5)


if __name__ == "__main__":
    main()
