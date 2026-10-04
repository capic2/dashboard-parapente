from collections import defaultdict
from math import floor
from typing import Any


def calculate_real_flight_duration_minutes(markers: list[dict[str, Any]]) -> int | None:
    """Return elapsed minutes between takeoff and landing markers on one video."""
    markers_by_video: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for marker in markers:
        video_id = marker.get("youtube_video_id")
        timestamp = marker.get("timestamp_seconds")
        if (
            isinstance(video_id, str)
            and isinstance(timestamp, int)
            and not isinstance(timestamp, bool)
            and timestamp >= 0
            and marker.get("kind") in {"takeoff", "landing"}
        ):
            markers_by_video[video_id].append(marker)

    durations_seconds = []
    for video_markers in markers_by_video.values():
        takeoffs = [m["timestamp_seconds"] for m in video_markers if m["kind"] == "takeoff"]
        landings = [m["timestamp_seconds"] for m in video_markers if m["kind"] == "landing"]
        if not takeoffs or not landings:
            continue

        takeoff = min(takeoffs)
        landing = max(landings)
        if landing > takeoff:
            durations_seconds.append(landing - takeoff)

    if not durations_seconds:
        return None

    # When more than one associated video contains a complete flight, use the
    # longest interval, which is the most likely to show the full flight.
    return floor(max(durations_seconds) / 60 + 0.5)
