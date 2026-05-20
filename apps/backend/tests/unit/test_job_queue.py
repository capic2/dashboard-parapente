"""Unit tests for RQ queue helpers."""

import job_queue


class FakeJob:
    def __init__(self, status: str):
        self.status = status
        self.deleted = False

    def get_status(self, refresh: bool = True) -> str:
        return self.status

    def delete(self) -> None:
        self.deleted = True


class FakeQueue:
    def __init__(self, existing_job: FakeJob | None):
        self.existing_job = existing_job
        self.enqueued: list[dict[str, object]] = []

    def fetch_job(self, job_id: str) -> FakeJob | None:
        return self.existing_job

    def enqueue(self, function_path: str, *args: object, **kwargs: object) -> dict[str, object]:
        enqueued_job = {"function_path": function_path, "args": args, "kwargs": kwargs}
        self.enqueued.append(enqueued_job)
        return enqueued_job


def test_enqueue_once_reuses_existing_pending_job(monkeypatch):
    existing_job = FakeJob("queued")
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    result = job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert result is existing_job
    assert existing_job.deleted is False
    assert queue.enqueued == []


def test_enqueue_once_replaces_stale_started_job(monkeypatch):
    existing_job = FakeJob("started")
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    result = job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert existing_job.deleted is True
    assert result == queue.enqueued[0]
    assert queue.enqueued[0]["kwargs"]["job_id"] == "video-export-job-recovered"


def test_enqueue_once_replaces_terminal_existing_job(monkeypatch):
    existing_job = FakeJob("failed")
    queue = FakeQueue(existing_job)
    monkeypatch.setattr(job_queue, "get_queue", lambda _name=None: queue)

    job_queue.enqueue_once(
        "video_export_manual.process_video_export_job",
        "job-recovered",
        job_id="video-export-job-recovered",
    )

    assert existing_job.deleted is True
    assert len(queue.enqueued) == 1
