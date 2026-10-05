from math import floor
from typing import Any


def calculate_real_flight_duration_minutes(markers: list[dict[str, Any]]) -> int | None:
    """Return elapsed minutes between takeoff and landing on the shared video timeline."""
    takeoffs: list[int] = []
    landings: list[int] = []
    for marker in markers:
        timestamp = marker.get("timestamp_seconds")
        if isinstance(timestamp, int) and not isinstance(timestamp, bool) and timestamp >= 0:
            if marker.get("kind") == "takeoff":
                takeoffs.append(timestamp)
            elif marker.get("kind") == "landing":
                landings.append(timestamp)

    if not takeoffs or not landings:
        return None

    elapsed_seconds = max(landings) - min(takeoffs)
    if elapsed_seconds <= 0:
        return None
    return floor(elapsed_seconds / 60 + 0.5)
