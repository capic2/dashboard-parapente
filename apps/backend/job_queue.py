"""Redis Queue integration for long-running backend jobs."""

from __future__ import annotations

from typing import Any

import redis
from rq import Queue
from rq.job import Job

import config

_PENDING_JOB_STATUSES = {"queued", "deferred", "scheduled"}


def is_rq_enabled() -> bool:
    return config.JOB_QUEUE_BACKEND == "rq"


def get_redis_connection() -> redis.Redis:
    return redis.Redis(
        host=config.REDIS_HOST,
        port=config.REDIS_PORT,
        decode_responses=False,
    )


def get_queue(name: str | None = None) -> Queue:
    return Queue(name or config.JOB_QUEUE_NAME, connection=get_redis_connection())


def _job_status_value(job: Job) -> str | None:
    status = job.get_status(refresh=True)
    if status is None:
        return None
    return str(getattr(status, "value", status)).lower()


def enqueue_once(
    function_path: str,
    *args: Any,
    job_id: str,
    timeout: int | None = None,
    queue_name: str | None = None,
    **kwargs: Any,
) -> Job:
    queue = get_queue(queue_name)
    existing_job = queue.fetch_job(job_id)
    if existing_job is not None:
        if _job_status_value(existing_job) in _PENDING_JOB_STATUSES:
            return existing_job
        existing_job.delete()

    return queue.enqueue(
        function_path,
        *args,
        job_id=job_id,
        job_timeout=timeout or config.JOB_QUEUE_TIMEOUT_SECONDS,
        **kwargs,
    )
