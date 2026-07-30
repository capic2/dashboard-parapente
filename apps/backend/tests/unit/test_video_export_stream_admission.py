import pytest

import video_export
from deployment_drain import DeploymentDrainActive, deployment_drain


class RecordingThread:
    instances: list["RecordingThread"] = []

    def __init__(self, *, target, args):
        self.target = target
        self.args = args
        self.daemon = False
        self.started = False
        self.instances.append(self)

    def start(self) -> None:
        self.started = True


def test_stream_export_admission_registers_job_and_starts_thread(monkeypatch):
    jobs = {}
    RecordingThread.instances.clear()
    monkeypatch.setattr(video_export, "export_jobs", jobs)
    monkeypatch.setattr(video_export.threading, "Thread", RecordingThread)

    job_id = video_export.start_video_export_background("flight-admitted")

    assert jobs[job_id]["flight_id"] == "flight-admitted"
    assert jobs[job_id]["status"] == "started"
    assert len(RecordingThread.instances) == 1
    assert RecordingThread.instances[0].daemon is True
    assert RecordingThread.instances[0].started is True


def test_stream_export_drain_rejection_creates_no_job_or_thread(monkeypatch):
    jobs = {}
    RecordingThread.instances.clear()
    monkeypatch.setattr(video_export, "export_jobs", jobs)
    monkeypatch.setattr(video_export.threading, "Thread", RecordingThread)
    deployment_drain.begin("deploy-123", "sha-abc", "https://github.example/runs/123")

    with pytest.raises(DeploymentDrainActive):
        video_export.start_video_export_background("flight-rejected")

    assert jobs == {}
    assert RecordingThread.instances == []
