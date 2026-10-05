"""RQ worker entrypoint dedicated to GoPro preview jobs."""

from __future__ import annotations

import logging

from rq import Worker

import config
from job_queue import get_queue, get_redis_connection, is_rq_enabled

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    if not is_rq_enabled():
        raise RuntimeError("GoPro preview RQ worker requires BACKEND_JOB_QUEUE_BACKEND=rq")

    queue = get_queue(config.GOPRO_PREVIEW_QUEUE_NAME)
    worker = Worker([queue], connection=get_redis_connection())
    logger.info("Starting GoPro preview RQ worker for queue '%s'", config.GOPRO_PREVIEW_QUEUE_NAME)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
