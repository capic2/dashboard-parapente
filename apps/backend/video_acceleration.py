"""Shared NVIDIA capability detection and video encoder arguments."""

from __future__ import annotations

import subprocess
from functools import lru_cache
from typing import Literal

VideoAccelerator = Literal["cpu", "nvidia"]


@lru_cache(maxsize=1)
def ffmpeg_can_encode_nvenc() -> bool:
    """Run a real encode so advertised-but-unusable NVENC is rejected."""

    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=c=black:s=256x256:d=0.04",
                "-frames:v",
                "1",
                "-c:v",
                "h264_nvenc",
                "-f",
                "null",
                "-",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return False
    return result.returncode == 0


@lru_cache(maxsize=1)
def ffmpeg_supports_cuda_overlay() -> bool:
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-filters"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.SubprocessError, TimeoutError):
        return False
    filters = result.stdout or ""
    return result.returncode == 0 and "scale_cuda" in filters and "overlay_cuda" in filters


def select_video_accelerator(preference: str | None) -> VideoAccelerator:
    if (preference or "cpu").strip().lower() == "nvidia" and ffmpeg_can_encode_nvenc():
        return "nvidia"
    return "cpu"


def chromium_launch_args(accelerator: VideoAccelerator) -> list[str]:
    args = [
        "--enable-gpu",
        "--enable-webgl",
        "--enable-webgl2",
        "--ignore-gpu-blocklist",
        "--disable-gpu-vsync",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--js-flags=--max-old-space-size=8192",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--force-device-scale-factor=1",
        "--high-dpi-support=1",
    ]
    if accelerator == "nvidia":
        return [
            *args,
            "--use-gl=angle",
            "--use-angle=gl-egl",
            "--enable-gpu-rasterization",
            "--enable-zero-copy",
        ]
    return [
        *args,
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
        "--enable-unsafe-swiftshader",
    ]


def h264_encode_args(
    accelerator: VideoAccelerator,
    *,
    quality: str,
    cpu_preset: str,
    include_audio: bool,
) -> list[str]:
    if accelerator == "nvidia":
        args = [
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p4",
            "-tune",
            "hq",
            "-rc",
            "vbr",
            "-cq",
            quality,
            "-b:v",
            "0",
            "-pix_fmt",
            "yuv420p",
        ]
    else:
        args = [
            "-c:v",
            "libx264",
            "-preset",
            cpu_preset,
            "-crf",
            quality,
            "-pix_fmt",
            "yuv420p",
        ]
    audio_args = ["-c:a", "copy"] if include_audio else ["-an"]
    return [*args, *audio_args]
