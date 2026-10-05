"""Shared automatic input resolution for GoPro overlay jobs."""

from __future__ import annotations

import fnmatch
from pathlib import Path


def latest_matching_file(
    directory: Path, pattern: str, excluded_paths: tuple[Path, ...] = ()
) -> Path | None:
    """Return the most recently modified matching file."""
    if not directory.is_dir():
        return None
    pattern_lower = pattern.lower()
    excluded = {path.expanduser().resolve() for path in excluded_paths}
    matches = [
        path
        for path in directory.iterdir()
        if (
            path.is_file()
            and fnmatch.fnmatchcase(path.name.lower(), pattern_lower)
            and path.resolve() not in excluded
        )
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
    previous_overlay_path: Path | None = None,
) -> tuple[Path | None, Path | None]:
    """Resolve GPX from the flight record, with discovery only as a fallback."""
    gpx_path = configured_gpx_path or first_matching_file(input_directory, "Zepp*.gpx")
    excluded_paths = (previous_overlay_path,) if previous_overlay_path else ()
    pip_path = (
        latest_matching_file(input_directory, "flight*.mp4", excluded_paths) or generated_video_path
    )
    return gpx_path, pip_path
