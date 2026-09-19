"""RQ worker entrypoint for backend background jobs."""

from __future__ import annotations

import logging
import multiprocessing
import threading

from rq import Worker

import config
from job_queue import get_queue, get_redis_connection, is_rq_enabled
from highlight_video_worker import enqueue_pending_highlight_video_jobs
from video_export_manual import enqueue_pending_video_export_jobs

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _reconciliation_loop(stop_event: threading.Event) -> None:
    """Re-enqueue database jobs that missed Redis during a transient outage."""
    while not stop_event.wait(config.JOB_QUEUE_RECONCILIATION_INTERVAL_SECONDS):
        try:
            queued_count = (
                enqueue_pending_video_export_jobs() + enqueue_pending_highlight_video_jobs()
            )
            if queued_count:
                logger.info("Reconciled %s pending media job(s)", queued_count)
        except Exception:
            logger.warning("Could not reconcile pending media jobs", exc_info=True)


def _run_worker() -> None:
    if not is_rq_enabled():
        raise RuntimeError("RQ worker requires BACKEND_JOB_QUEUE_BACKEND=rq")

    queue = get_queue()
    worker = Worker([queue], connection=get_redis_connection())
    logger.info("Starting RQ worker for queue '%s'", config.JOB_QUEUE_NAME)
    stop_reconciliation = threading.Event()
    reconciliation_thread = threading.Thread(
        target=_reconciliation_loop,
        args=(stop_reconciliation,),
        name="video-export-queue-reconciliation",
        daemon=True,
    )
    reconciliation_thread.start()
    try:
        worker.work(with_scheduler=True)
    finally:
        stop_reconciliation.set()
        reconciliation_thread.join(timeout=5)


def main() -> None:
    # The dedicated highlight worker owns recovery of running highlight jobs.
    # Recovering them here races with that worker during a deployment and can
    # reset a job that has already started processing.
    recovered_count = enqueue_pending_video_export_jobs(recover_active=True)
    if recovered_count:
        logger.info("Enqueued %s recovered media job(s)", recovered_count)

    worker_count = config.JOB_WORKER_COUNT
    if worker_count == 1:
        _run_worker()
        return

    logger.info(
        "Starting %s parallel RQ workers for queue '%s'",
        worker_count,
        config.JOB_QUEUE_NAME,
    )
    processes = [
        multiprocessing.Process(
            target=_run_worker,
            name=f"rq-worker-{index}",
        )
        for index in range(worker_count)
    ]
    for process in processes:
        process.start()

    try:
        for process in processes:
            process.join()
    except KeyboardInterrupt:
        logger.info("Stopping parallel RQ workers")
        for process in processes:
            if process.is_alive():
                process.terminate()
        for process in processes:
            process.join(timeout=5)


if __name__ == "__main__":
    main()
