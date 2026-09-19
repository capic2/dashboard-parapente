"""Redis Queue integration for long-running backend jobs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import redis
from rq import Queue
from rq.command import send_stop_job_command
from rq.job import Job

import config

_PENDING_JOB_STATUSES = {"queued", "deferred", "scheduled", "started"}
_ENQUEUE_LOCK_TIMEOUT_SECONDS = 60
_ENQUEUE_LOCK_WAIT_SECONDS = 30


def _status_value(status: Any) -> str | None:
    if status is None:
        return None
    return str(getattr(status, "value", status)).lower()


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
    return _status_value(job.get_status(refresh=True))


def _delete_stale_job(job: Job) -> None:
    try:
        job.delete()
    except ValueError as error:
        message = str(error)
        if "Execution" not in message or "not found in Redis" not in message:
            raise
    except KeyError as error:
        # RQ 2.x can leave an execution id in the registry after a worker
        # interruption.  Fetching that execution then raises KeyError when
        # its hash is missing the created_at field.  The job is stale anyway;
        # allow enqueue_once() to replace it instead of blocking the queue.
        if error.args != (b"created_at",):
            raise


def delete_job(job_id: str, queue_name: str | None = None) -> bool:
    queue = get_queue(queue_name)
    job = queue.fetch_job(job_id)
    if job is None:
        return False
    if _job_status_value(job) == "started":
        send_stop_job_command(queue.connection, job_id)
    _delete_stale_job(job)
    return True


def delete_stale_started_job(
    job_id: str,
    *,
    stale_before: datetime,
    queue_name: str | None = None,
) -> bool:
    """Delete an orphaned started job only after its RQ heartbeat expires."""
    queue = get_queue(queue_name)
    job = queue.fetch_job(job_id)
    if job is None or _job_status_value(job) != "started":
        return False
    heartbeat = job.last_heartbeat or job.started_at or job.enqueued_at
    if heartbeat is None:
        return False
    if heartbeat.tzinfo is not None and stale_before.tzinfo is None:
        heartbeat = heartbeat.replace(tzinfo=None)
    if heartbeat >= stale_before:
        return False
    _delete_stale_job(job)
    return True


def enqueue_once(
    function_path: str,
    *args: Any,
    job_id: str,
    timeout: int | None = None,
    queue_name: str | None = None,
    **kwargs: Any,
) -> Job:
    queue = get_queue(queue_name)
    lock_name = f"rq:enqueue-once:{queue.name}:{job_id}"
    with queue.connection.lock(
        lock_name,
        timeout=_ENQUEUE_LOCK_TIMEOUT_SECONDS,
        blocking_timeout=_ENQUEUE_LOCK_WAIT_SECONDS,
    ):
        existing_job = queue.fetch_job(job_id)
        if existing_job is not None:
            if _job_status_value(existing_job) in _PENDING_JOB_STATUSES:
                return existing_job
            _delete_stale_job(existing_job)

        return queue.enqueue(
            function_path,
            *args,
            job_id=job_id,
            job_timeout=timeout or config.JOB_QUEUE_TIMEOUT_SECONDS,
            **kwargs,
        )
