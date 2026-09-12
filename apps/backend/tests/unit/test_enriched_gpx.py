from pathlib import Path
from unittest.mock import patch

from gopro_overlay_export import ensure_enriched_gpx


def test_enriched_gpx_is_cached_until_a_source_changes(tmp_path: Path) -> None:
    gpx_path = tmp_path / "track.gpx"
    osv_path = tmp_path / "camera.osv"
    merged_path = tmp_path / "merged-gopro-overlay.gpx"
    gpx_path.write_text("gpx", encoding="utf-8")
    osv_path.write_text("osv", encoding="utf-8")

    def merge(*_args, **_kwargs):
        merged_path.write_text("merged", encoding="utf-8")
        return merged_path

    with patch("gopro_overlay_export._merge_osv_files_with_gpx", side_effect=merge) as merger:
        assert ensure_enriched_gpx([osv_path], gpx_path, tmp_path) == merged_path
        assert ensure_enriched_gpx([osv_path], gpx_path, tmp_path) == merged_path
        osv_path.write_text("updated osv", encoding="utf-8")
        assert ensure_enriched_gpx([osv_path], gpx_path, tmp_path) == merged_path

    assert merger.call_count == 2
