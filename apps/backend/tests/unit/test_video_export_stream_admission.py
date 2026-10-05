import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

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


def test_stream_transcode_command_uses_nvenc() -> None:
    command = video_export._stream_transcode_command(
        Path("input.webm"),
        Path("output.mp4"),
        "nvidia",
    )

    assert command[command.index("-c:v") + 1] == "h264_nvenc"
    assert command[command.index("-cq") + 1] == "23"
    assert "-an" in command


def test_stream_transcode_command_uses_cpu_fallback() -> None:
    command = video_export._stream_transcode_command(
        Path("input.webm"),
        Path("output.mp4"),
        "cpu",
    )

    assert command[command.index("-c:v") + 1] == "libx264"
    assert command[command.index("-crf") + 1] == "23"


@pytest.mark.asyncio
async def test_stream_ffmpeg_process_is_killed_when_coroutine_is_cancelled(monkeypatch) -> None:
    class Process:
        returncode = None
        killed = False

        def poll(self):
            return self.returncode

        def kill(self):
            self.killed = True
            self.returncode = -9

        def wait(self):
            return self.returncode

    process = Process()
    monkeypatch.setattr(video_export.subprocess, "Popen", lambda *_, **__: process)
    monkeypatch.setattr(
        video_export.asyncio, "sleep", AsyncMock(side_effect=asyncio.CancelledError)
    )

    with pytest.raises(asyncio.CancelledError):
        await video_export._run_ffmpeg_process("job-1", ["ffmpeg"])

    assert process.killed is True
