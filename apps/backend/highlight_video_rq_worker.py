"""RQ worker entrypoint dedicated to highlight video jobs."""

from __future__ import annotations

import logging

from rq import Worker

import config
from highlight_video_worker import enqueue_pending_highlight_video_jobs
from job_queue import get_queue, get_redis_connection, is_rq_enabled

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


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
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
