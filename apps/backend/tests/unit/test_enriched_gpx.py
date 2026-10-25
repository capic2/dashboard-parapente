from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import os
from time import sleep
from unittest.mock import Mock, patch

import pytest

import gopro_overlay_export
from gopro_overlay_export import EnrichedGpxCancelled, ensure_enriched_gpx

_VALID_GPX = """<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
<trkpt lat="46.0" lon="6.0"><ele>1000</ele><time>2026-01-01T12:00:00Z</time></trkpt>
<trkpt lat="46.1" lon="6.1"><ele>1001</ele><time>2026-01-01T12:00:01Z</time></trkpt>
</trkseg></trk></gpx>"""


def test_enriched_gpx_is_cached_until_a_source_changes(tmp_path: Path) -> None:
    gpx_path = tmp_path / "track.gpx"
    osv_path = tmp_path / "camera.osv"
    merged_path = tmp_path / "merged-gopro-overlay.gpx"
    gpx_path.write_text(_VALID_GPX, encoding="utf-8")
    osv_path.write_text("osv", encoding="utf-8")

    def merge(_osv_paths: list[Path], _gpx_path: Path, output_dir: Path, **_kwargs: object) -> Path:
        merged_path.write_text(_VALID_GPX, encoding="utf-8")
        return merged_path

    with patch("gopro_overlay_export._merge_osv_files_with_gpx", side_effect=merge) as merger:
        assert ensure_enriched_gpx([osv_path], gpx_path, tmp_path) == merged_path
        assert ensure_enriched_gpx([osv_path], gpx_path, tmp_path) == merged_path
        osv_path.write_text("updated osv", encoding="utf-8")
        assert ensure_enriched_gpx([osv_path], gpx_path, tmp_path) == merged_path
        source_stat = gpx_path.stat()
        gpx_path.write_text(_VALID_GPX.replace("46.0", "47.0"), encoding="utf-8")
        os.utime(gpx_path, ns=(source_stat.st_atime_ns, source_stat.st_mtime_ns))
        assert ensure_enriched_gpx([osv_path], gpx_path, tmp_path) == merged_path

    assert merger.call_count == 3


def test_enriched_gpx_serializes_concurrent_rebuilds(tmp_path: Path) -> None:
    gpx_path = tmp_path / "track.gpx"
    osv_path = tmp_path / "camera.osv"
    gpx_path.write_text(_VALID_GPX, encoding="utf-8")
    osv_path.write_text("osv", encoding="utf-8")

    def merge(_osv_paths: list[Path], _gpx_path: Path, output_dir: Path, **_kwargs: object) -> Path:
        sleep(0.02)
        output_path = output_dir / "merged-gopro-overlay.gpx"
        output_path.write_text(_VALID_GPX, encoding="utf-8")
        return output_path

    with patch("gopro_overlay_export._merge_osv_files_with_gpx", side_effect=merge) as merger:
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(
                executor.map(
                    lambda _: ensure_enriched_gpx([osv_path], gpx_path, tmp_path),
                    range(2),
                )
            )

    assert results == [tmp_path / "merged-gopro-overlay.gpx"] * 2
    assert merger.call_count == 1


def test_enriched_gpx_retries_if_staged_file_disappears_during_validation(
    tmp_path: Path,
) -> None:
    gpx_path = tmp_path / "track.gpx"
    osv_path = tmp_path / "camera.osv"
    gpx_path.write_text(_VALID_GPX, encoding="utf-8")
    osv_path.write_text("osv", encoding="utf-8")

    merge_attempts = 0

    def merge(_osv_paths: list[Path], _gpx_path: Path, output_dir: Path, **_kwargs: object) -> Path:
        nonlocal merge_attempts
        merge_attempts += 1
        output_path = output_dir / "merged-gopro-overlay.gpx"
        output_path.write_text(_VALID_GPX, encoding="utf-8")
        return output_path

    def staged_file_is_usable(path: Path) -> bool:
        if merge_attempts == 1:
            path.unlink()
            return False
        return True

    with (
        patch("gopro_overlay_export._merge_osv_files_with_gpx", side_effect=merge) as merger,
        patch(
            "gopro_overlay_export._has_usable_gpx_timestamps",
            side_effect=staged_file_is_usable,
        ),
    ):
        enriched_path = ensure_enriched_gpx([osv_path], gpx_path, tmp_path)

    assert enriched_path == tmp_path / "merged-gopro-overlay.gpx"
    assert enriched_path.read_text(encoding="utf-8") == _VALID_GPX
    assert merger.call_count == 2


def test_enriched_gpx_retries_if_merge_helper_creates_no_output(tmp_path: Path) -> None:
    gpx_path = tmp_path / "track.gpx"
    osv_path = tmp_path / "camera.osv"
    script_dir = tmp_path / "scripts"
    script_dir.mkdir()
    gpx_path.write_text(_VALID_GPX, encoding="utf-8")
    osv_path.write_text("osv", encoding="utf-8")
    (script_dir / "osv_merge.py").write_text(
        "from pathlib import Path\n"
        "import sys\n"
        "output = Path(sys.argv[-1])\n"
        "marker = output.parent.parent / '.merge-attempt'\n"
        "if marker.exists():\n"
        f"    output.write_text({_VALID_GPX!r}, encoding='utf-8')\n"
        "else:\n"
        "    marker.touch()\n",
        encoding="utf-8",
    )

    with patch("gopro_overlay_export.config.GOPRO_OVERLAY_ROOT", str(script_dir)):
        enriched_path = ensure_enriched_gpx([osv_path], gpx_path, tmp_path)

    assert enriched_path == tmp_path / "merged-gopro-overlay.gpx"
    assert enriched_path.read_text(encoding="utf-8") == _VALID_GPX


def test_osv_merge_terminates_when_enrichment_is_cancelled(tmp_path: Path) -> None:
    script_dir = tmp_path / "scripts"
    script_dir.mkdir()
    (script_dir / "osv_merge.py").touch()
    gpx_path = tmp_path / "track.gpx"
    osv_path = tmp_path / "camera.osv"
    gpx_path.write_text(_VALID_GPX, encoding="utf-8")
    osv_path.write_text("osv", encoding="utf-8")

    process = Mock()
    process.stdout = object()
    process.poll.return_value = None
    process.wait.return_value = -15

    def wait_for_cancellation(*_args):
        sleep(1.01)
        return [], [], []

    with (
        patch("gopro_overlay_export.subprocess.Popen", return_value=process),
        patch("gopro_overlay_export.select.select", side_effect=wait_for_cancellation),
        patch("gopro_overlay_export.config.GOPRO_OVERLAY_ROOT", str(script_dir)),
    ):
        with pytest.raises(EnrichedGpxCancelled):
            gopro_overlay_export._merge_osv_files_with_gpx(
                [osv_path],
                gpx_path,
                tmp_path / "output",
                cancellation_check=lambda: True,
            )

    process.terminate.assert_called_once()
    process.kill.assert_called_once()
