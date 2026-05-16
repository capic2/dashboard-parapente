"""RQ worker entrypoint for backend background jobs."""

from __future__ import annotations

import logging

from rq import Worker

import config
from job_queue import get_queue, get_redis_connection, is_rq_enabled
from video_export_manual import enqueue_pending_video_export_jobs

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    if not is_rq_enabled():
        raise RuntimeError("RQ worker requires BACKEND_JOB_QUEUE_BACKEND=rq")

    queued_count = enqueue_pending_video_export_jobs()
    if queued_count:
        logger.info("Enqueued %s pending video export job(s)", queued_count)

    queue = get_queue()
    worker = Worker([queue], connection=get_redis_connection())
    logger.info("Starting RQ worker for queue '%s'", config.JOB_QUEUE_NAME)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
