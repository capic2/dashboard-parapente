"""RQ worker entrypoint for GoPro overlay jobs."""

from __future__ import annotations

import logging
from pathlib import Path

from rq import Worker

import config
from gopro_overlay_export import enqueue_pending_gopro_overlay_jobs
from job_queue import get_queue, get_redis_connection, is_rq_enabled

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _gpu_runtime_summary() -> str:
    render_device = Path(config.GOPRO_OVERLAY_RENDER_DEVICE)
    return (
        "render_device={render_device} present={present} profile={profile} "
        "config_dir={config_dir} extra_args={extra_args}"
    ).format(
        render_device=render_device,
        present=render_device.exists(),
        profile=config.GOPRO_OVERLAY_PROFILE or "<none>",
        config_dir=config.GOPRO_OVERLAY_CONFIG_DIR or "<none>",
        extra_args=config.GOPRO_OVERLAY_EXTRA_ARGS or "<none>",
    )


def main() -> None:
    if not is_rq_enabled():
        raise RuntimeError("GoPro overlay RQ worker requires BACKEND_JOB_QUEUE_BACKEND=rq")

    queued_count = enqueue_pending_gopro_overlay_jobs(mark_interrupted=True)
    if queued_count:
        logger.info("Enqueued %s pending GoPro overlay job(s)", queued_count)

    queue = get_queue(config.GOPRO_OVERLAY_QUEUE_NAME)
    worker = Worker([queue], connection=get_redis_connection())
    logger.info(
        "Starting GoPro overlay RQ worker for queue '%s' (%s)",
        config.GOPRO_OVERLAY_QUEUE_NAME,
        _gpu_runtime_summary(),
    )
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
