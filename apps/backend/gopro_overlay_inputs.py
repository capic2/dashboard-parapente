"""Shared automatic input resolution for GoPro overlay jobs."""

from __future__ import annotations

import fnmatch
from pathlib import Path


def latest_matching_file(directory: Path, pattern: str) -> Path | None:
    """Return the most recently modified matching file."""
    if not directory.is_dir():
        return None
    pattern_lower = pattern.lower()
    matches = [
        path
        for path in directory.iterdir()
        if path.is_file() and fnmatch.fnmatchcase(path.name.lower(), pattern_lower)
    ]
    return max(matches, key=lambda path: (path.stat().st_mtime, path.name)) if matches else None


def first_matching_file(directory: Path, pattern: str) -> Path | None:
    """Return the first matching file in stable filename order."""
    if not directory.is_dir():
        return None
    pattern_lower = pattern.lower()
    matches = sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and fnmatch.fnmatchcase(path.name.lower(), pattern_lower)
    )
    return matches[0] if matches else None


def resolve_automatic_overlay_inputs(
    input_directory: Path,
    configured_gpx_path: Path | None,
    generated_video_path: Path | None,
) -> tuple[Path | None, Path | None]:
    """Resolve GPX and PIP using the same fallback order as the overlay route."""
    gpx_path = first_matching_file(input_directory, "Zepp*.gpx") or configured_gpx_path
    pip_path = latest_matching_file(input_directory, "flight*.mp4") or generated_video_path
    return gpx_path, pip_path
