"""Unit tests for the RQ worker entrypoint."""

from __future__ import annotations

import job_worker


def test_main_runs_one_worker_without_spawning(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(job_worker.config, "JOB_WORKER_COUNT", 1)
    monkeypatch.setattr(job_worker, "_run_worker", lambda: calls.append(True))

    job_worker.main()

    assert calls == [True]


def test_main_spawns_configured_number_of_workers(monkeypatch) -> None:
    started = []

    class FakeProcess:
        def __init__(self, **kwargs):
            self.name = kwargs["name"]

        def start(self):
            started.append(("start", self.name))

        def join(self, timeout=None):
            started.append(("join", self.name, timeout))

    monkeypatch.setattr(job_worker.config, "JOB_WORKER_COUNT", 5)
    monkeypatch.setattr(job_worker.multiprocessing, "Process", FakeProcess)

    job_worker.main()

    assert started == [
        ("start", "rq-worker-0"),
        ("start", "rq-worker-1"),
        ("start", "rq-worker-2"),
        ("start", "rq-worker-3"),
        ("start", "rq-worker-4"),
        ("join", "rq-worker-0", None),
        ("join", "rq-worker-1", None),
        ("join", "rq-worker-2", None),
        ("join", "rq-worker-3", None),
        ("join", "rq-worker-4", None),
    ]


class _StopAfterFirstWait:
    def __init__(self) -> None:
        self.waited: list[float] = []

    def wait(self, timeout: float) -> bool:
        self.waited.append(timeout)
        return len(self.waited) > 1


def test_reconciliation_loop_requeues_pending_jobs(monkeypatch) -> None:
    reconciled: list[bool] = []
    stop_event = _StopAfterFirstWait()

    monkeypatch.setattr(
        job_worker.config,
        "JOB_QUEUE_RECONCILIATION_INTERVAL_SECONDS",
        30,
    )
    monkeypatch.setattr(
        job_worker,
        "enqueue_pending_video_export_jobs",
        lambda: reconciled.append(True) or 1,
    )

    job_worker._reconciliation_loop(stop_event)  # type: ignore[arg-type]

    assert reconciled == [True]
    assert stop_event.waited == [30, 30]


def test_reconciliation_loop_survives_redis_errors(monkeypatch) -> None:
    calls = 0
    stop_event = _StopAfterFirstWait()

    def fail_reconciliation() -> int:
        nonlocal calls
        calls += 1
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(
        job_worker.config,
        "JOB_QUEUE_RECONCILIATION_INTERVAL_SECONDS",
        1,
    )
    monkeypatch.setattr(job_worker, "enqueue_pending_video_export_jobs", fail_reconciliation)

    job_worker._reconciliation_loop(stop_event)  # type: ignore[arg-type]

    assert calls == 1
