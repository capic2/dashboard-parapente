from unittest.mock import patch

import video_acceleration


def test_select_video_accelerator_uses_cpu_without_nvidia_request() -> None:
    with patch("video_acceleration.ffmpeg_can_encode_nvenc") as probe:
        assert video_acceleration.select_video_accelerator("cpu") == "cpu"
    probe.assert_not_called()


def test_select_video_accelerator_uses_nvidia_after_successful_probe() -> None:
    with patch("video_acceleration.ffmpeg_can_encode_nvenc", return_value=True):
        assert video_acceleration.select_video_accelerator("nvidia") == "nvidia"


def test_select_video_accelerator_falls_back_to_cpu_after_failed_probe() -> None:
    with patch("video_acceleration.ffmpeg_can_encode_nvenc", return_value=False):
        assert video_acceleration.select_video_accelerator("nvidia") == "cpu"


def test_gpu_runtime_status_parses_live_nvidia_smi_output() -> None:
    class Result:
        returncode = 0
        stdout = "NVIDIA RTX 4090, 42, 1234, 24576\n"
        stderr = ""

    with patch("video_acceleration.subprocess.run", return_value=Result()) as run:
        status = video_acceleration.get_gpu_runtime_status()

    assert status["available"] is True
    assert status["devices"] == [
        {
            "name": "NVIDIA RTX 4090",
            "utilization_percent": 42,
            "memory_used_mb": 1234,
            "memory_total_mb": 24576,
        }
    ]
    assert run.call_args.args[0][0] == "nvidia-smi"


def test_gpu_runtime_status_reports_unavailable_when_nvidia_smi_fails() -> None:
    class Result:
        returncode = 1
        stdout = ""
        stderr = "No devices were found"

    with patch("video_acceleration.subprocess.run", return_value=Result()):
        status = video_acceleration.get_gpu_runtime_status()

    assert status["available"] is False
    assert status["devices"] == []


def test_nvenc_probe_runs_a_real_encode() -> None:
    video_acceleration.ffmpeg_can_encode_nvenc.cache_clear()

    class Result:
        returncode = 0

    with patch("video_acceleration.subprocess.run", return_value=Result()) as run:
        assert video_acceleration.ffmpeg_can_encode_nvenc() is True

    command = run.call_args.args[0]
    assert command[command.index("-c:v") + 1] == "h264_nvenc"
    assert "-frames:v" in command
    video_acceleration.ffmpeg_can_encode_nvenc.cache_clear()


def test_cuda_overlay_probe_requires_scale_and_overlay_filters() -> None:
    video_acceleration.ffmpeg_supports_cuda_overlay.cache_clear()

    class Result:
        returncode = 0
        stdout = " ... scale_cuda ... overlay_cuda ..."

    with patch("video_acceleration.subprocess.run", return_value=Result()):
        assert video_acceleration.ffmpeg_supports_cuda_overlay() is True
    video_acceleration.ffmpeg_supports_cuda_overlay.cache_clear()


def test_nvidia_encode_args_use_nvenc() -> None:
    args = video_acceleration.h264_encode_args(
        "nvidia",
        quality="18",
        cpu_preset="medium",
        include_audio=False,
    )

    assert args[args.index("-c:v") + 1] == "h264_nvenc"
    assert args[args.index("-cq") + 1] == "18"
    assert "-an" in args


def test_cpu_encode_args_use_libx264() -> None:
    args = video_acceleration.h264_encode_args(
        "cpu",
        quality="23",
        cpu_preset="veryfast",
        include_audio=True,
    )

    assert args[args.index("-c:v") + 1] == "libx264"
    assert args[args.index("-crf") + 1] == "23"
    assert args[-2:] == ["-c:a", "copy"]
