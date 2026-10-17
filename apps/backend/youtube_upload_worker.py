"""RQ worker entrypoint dedicated to YouTube uploads."""

from __future__ import annotations

import logging

from rq import Worker

import config
from job_queue import get_queue, get_redis_connection, is_rq_enabled
from youtube_upload import enqueue_pending_youtube_uploads

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    if not is_rq_enabled():
        raise RuntimeError("YouTube upload worker requires BACKEND_JOB_QUEUE_BACKEND=rq")

    queued_count = enqueue_pending_youtube_uploads(
        recover_active=True,
        migrate_legacy_queue=True,
    )
    if queued_count:
        logger.info("Enqueued %s pending YouTube upload job(s)", queued_count)

    queue = get_queue(config.YOUTUBE_UPLOAD_QUEUE_NAME)
    worker = Worker([queue], connection=get_redis_connection())
    logger.info(
        "Starting YouTube upload RQ worker for queue '%s'",
        config.YOUTUBE_UPLOAD_QUEUE_NAME,
    )
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
