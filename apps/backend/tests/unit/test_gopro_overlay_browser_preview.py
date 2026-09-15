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
    assert commands[0][commands[0].index("-f") : commands[0].index("-f") + 2] == ["-f", "webm"]
    assert commands[0][
        commands[0].index("-auto-alt-ref") : commands[0].index("-auto-alt-ref") + 2
    ] == [
        "-auto-alt-ref",
        "0",
    ]
    assert "alpha_mode=1" in commands[0]


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
