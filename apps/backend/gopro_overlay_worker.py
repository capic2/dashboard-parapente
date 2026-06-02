"""RQ worker entrypoint for GoPro overlay jobs."""

from __future__ import annotations

import logging

from rq import Worker

import config
from gopro_overlay_export import enqueue_pending_gopro_overlay_jobs
from job_queue import get_queue, get_redis_connection, is_rq_enabled

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    if not is_rq_enabled():
        raise RuntimeError("GoPro overlay RQ worker requires BACKEND_JOB_QUEUE_BACKEND=rq")

    queued_count = enqueue_pending_gopro_overlay_jobs(mark_interrupted=True)
    if queued_count:
        logger.info("Enqueued %s pending GoPro overlay job(s)", queued_count)

    queue = get_queue(config.GOPRO_OVERLAY_QUEUE_NAME)
    worker = Worker([queue], connection=get_redis_connection())
    logger.info("Starting GoPro overlay RQ worker for queue '%s'", config.GOPRO_OVERLAY_QUEUE_NAME)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
