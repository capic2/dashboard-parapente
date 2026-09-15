from pathlib import Path
import subprocess

import pytest

from gopro_overlay_export import gopro_overlay_browser_preview_path


def test_browser_preview_converts_mov_to_webm(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source_path = tmp_path / "overlay.mov"
    source_path.write_bytes(b"mov")
    commands: list[list[str]] = []

    def fake_run(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
        commands.append(command)
        Path(command[-1]).write_bytes(b"webm")
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr("gopro_overlay_export.subprocess.run", fake_run)

    preview_path = gopro_overlay_browser_preview_path(source_path)

    assert preview_path == tmp_path / "overlay.webm"
    assert preview_path.read_bytes() == b"webm"
    assert ["-f", "webm"] == commands[0][-3:-1]


def test_browser_preview_falls_back_to_mov_when_ffmpeg_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source_path = tmp_path / "overlay.mov"
    source_path.write_bytes(b"mov")

    def failing_run(*_: object, **__: object) -> subprocess.CompletedProcess[str]:
        raise subprocess.TimeoutExpired("ffmpeg", 600)

    monkeypatch.setattr("gopro_overlay_export.subprocess.run", failing_run)

    assert gopro_overlay_browser_preview_path(source_path) == source_path
