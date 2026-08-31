"""Shared automatic input resolution for GoPro overlay jobs."""

from __future__ import annotations

import fnmatch
import re
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


def _flight_date(directory: Path) -> str | None:
    """Return the YYYYMMDD flight directory component, when available."""
    for part in (directory.name, *directory.parts[::-1]):
        match = re.fullmatch(r"\d{8}", part)
        if match:
            return part
    return None


def _latest_matching_flight(directory: Path, excluded_paths: tuple[Path, ...]) -> Path | None:
    """Select a flight PIP belonging to this flight directory.

    The storage directory can contain Cesium exports from another flight.  A
    plain ``latest flight*.mp4`` lookup silently used those files as the PIP,
    producing a misleading inset instead of failing over to the source video.
    When filenames carry a date, only the date matching the directory is valid;
    legacy undated names retain the previous fallback behaviour.
    """
    flight_date = _flight_date(directory)
    candidates = [
        path
        for path in directory.iterdir()
        if path.is_file() and fnmatch.fnmatchcase(path.name.lower(), "flight*.mp4")
    ] if directory.is_dir() else []
    if flight_date:
        dated = [
            path
            for path in candidates
            if (match := re.search(r"(?<!\d)(\d{8})(?!\d)", path.name))
            and match.group(1) == flight_date
        ]
        candidates = dated or [
            path for path in candidates
            if not re.search(r"(?<!\d)\d{8}(?!\d)", path.name)
        ]
    if not candidates:
        return None
    excluded = {path.expanduser().resolve() for path in excluded_paths}
    candidates = [path for path in candidates if path.resolve() not in excluded]
    return max(candidates, key=lambda path: (path.stat().st_mtime, path.name)) if candidates else None


def resolve_automatic_overlay_inputs(
    input_directory: Path,
    configured_gpx_path: Path | None,
    generated_video_path: Path | None,
    previous_overlay_path: Path | None = None,
) -> tuple[Path | None, Path | None]:
    """Resolve GPX and PIP using the same fallback order as the overlay route."""
    gpx_path = first_matching_file(input_directory, "Zepp*.gpx") or configured_gpx_path
    excluded_paths = (previous_overlay_path,) if previous_overlay_path else ()
    pip_path = _latest_matching_flight(input_directory, excluded_paths)
    # Do not silently turn an unrelated dated flight export into a PIP.  The
    # caller can report the missing matching export and avoid generating a
    # visually corrupted overlay.  Keep the historical source-video fallback
    # only when the directory contains no flight export at all.
    if (
        pip_path is None
        and latest_matching_file(input_directory, "flight*.mp4", excluded_paths) is None
    ):
        pip_path = generated_video_path
    return gpx_path, pip_path
