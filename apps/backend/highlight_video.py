"""Time alignment and rendering primitives for pano highlight videos."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class HighlightClip:
    """A clip in pano time and its corresponding overlay time."""

    start_seconds: float
    duration_seconds: float
    yaw_degrees: float
    category: str = "highlight"

    def overlay_start_seconds(self, offset_seconds: float) -> float:
        """Translate pano time to overlay time using the stored positive offset."""
        return max(0.0, self.start_seconds + offset_seconds)

    def overlay_end_seconds(self, offset_seconds: float) -> float:
        return self.overlay_start_seconds(offset_seconds) + self.duration_seconds


def clamp_clip(
    start_seconds: float,
    end_seconds: float,
    source_duration_seconds: float,
) -> HighlightClip:
    """Return a safe clip bounded by the source video duration."""
    if source_duration_seconds < 0:
        raise ValueError("source duration cannot be negative")
    start = min(max(0.0, start_seconds), source_duration_seconds)
    end = min(max(start, end_seconds), source_duration_seconds)
    return HighlightClip(start, end - start, 0.0)


def overlay_interval_for_clip(
    clip: HighlightClip,
    overlay_offset_seconds: float,
    overlay_duration_seconds: float | None = None,
) -> tuple[float, float] | None:
    """Map a pano clip to overlay time and discard non-overlapping intervals."""
    start = clip.overlay_start_seconds(overlay_offset_seconds)
    end = clip.overlay_end_seconds(overlay_offset_seconds)
    if overlay_duration_seconds is not None:
        if overlay_duration_seconds <= 0 or start >= overlay_duration_seconds:
            return None
        end = min(end, overlay_duration_seconds)
    if end <= start:
        return None
    return start, end
