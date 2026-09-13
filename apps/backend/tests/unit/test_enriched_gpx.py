from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from time import sleep
from unittest.mock import patch

from gopro_overlay_export import ensure_enriched_gpx

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

    assert merger.call_count == 2


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
