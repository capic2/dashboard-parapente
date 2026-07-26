import gzip
import io
import math
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, TypedDict

from spots.distance import haversine_distance


class TrackPoint(TypedDict, total=False):
    lat: float
    lon: float
    elevation: float
    timestamp: int
    heart_rate: int
    power: int
    segment: int


MAX_TRACK_BYTES = 100 * 1024 * 1024
MAX_XML_TRACK_BYTES = 25 * 1024 * 1024
MAX_TRACK_POINTS = 500_000


def _append_point(points: list[TrackPoint], point: TrackPoint) -> None:
    latitude = point["lat"]
    longitude = point["lon"]
    elevation = point.get("elevation", 0.0)
    if (
        not math.isfinite(latitude)
        or not -90 <= latitude <= 90
        or not math.isfinite(longitude)
        or not -180 <= longitude <= 180
        or not math.isfinite(elevation)
    ):
        raise ValueError("Activity file contains invalid track coordinates")
    timestamp = point.get("timestamp", 0)
    if timestamp < 0:
        raise ValueError("Activity file contains an invalid track timestamp")
    points.append(point)
    if len(points) > MAX_TRACK_POINTS:
        raise ValueError("Activity file exceeds the track point limit")


def _timestamp_millis(value: str | datetime | None) -> int:
    if value is None:
        return 0
    parsed = (
        value
        if isinstance(value, datetime)
        else datetime.fromisoformat(value.replace("Z", "+00:00"))
    )
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def _decompress(content: bytes) -> bytes:
    if not content.startswith(b"\x1f\x8b"):
        if len(content) > MAX_TRACK_BYTES:
            raise ValueError("Activity file exceeds the track size limit")
        return content
    with gzip.GzipFile(fileobj=io.BytesIO(content)) as compressed:
        decoded = compressed.read(MAX_TRACK_BYTES + 1)
    if len(decoded) > MAX_TRACK_BYTES:
        raise ValueError("Decompressed activity file exceeds the track size limit")
    return decoded


def _local_name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def _child_text(element: ET.Element, name: str) -> str | None:
    for child in element.iter():
        if _local_name(child) == name and child.text:
            return child.text
    return None


def _parse_gpx(content: bytes) -> list[TrackPoint]:
    root = ET.fromstring(content)
    points: list[TrackPoint] = []
    segments = [element for element in root.iter() if _local_name(element) == "trkseg"]
    for segment_index, segment in enumerate(segments):
        for element in segment.iter():
            if _local_name(element) != "trkpt":
                continue
            point: TrackPoint = {
                "lat": float(element.attrib["lat"]),
                "lon": float(element.attrib["lon"]),
                "elevation": float(_child_text(element, "ele") or 0),
                "timestamp": _timestamp_millis(_child_text(element, "time")),
                "segment": segment_index,
            }
            heart_rate = _child_text(element, "hr")
            power = _child_text(element, "power")
            if heart_rate:
                point["heart_rate"] = int(float(heart_rate))
            if power:
                point["power"] = int(float(power))
            _append_point(points, point)
    return points


def _parse_tcx(content: bytes) -> list[TrackPoint]:
    root = ET.fromstring(content)
    points: list[TrackPoint] = []
    tracks = [element for element in root.iter() if _local_name(element) == "Track"]
    for segment_index, track in enumerate(tracks):
        for element in track.iter():
            if _local_name(element) != "Trackpoint":
                continue
            latitude = _child_text(element, "LatitudeDegrees")
            longitude = _child_text(element, "LongitudeDegrees")
            if latitude is None or longitude is None:
                continue
            point: TrackPoint = {
                "lat": float(latitude),
                "lon": float(longitude),
                "elevation": float(_child_text(element, "AltitudeMeters") or 0),
                "timestamp": _timestamp_millis(_child_text(element, "Time")),
                "segment": segment_index,
            }
            heart_rate = _child_text(element, "Value")
            power = _child_text(element, "Watts")
            if heart_rate:
                point["heart_rate"] = int(float(heart_rate))
            if power:
                point["power"] = int(float(power))
            _append_point(points, point)
    return points


def _degrees(value: float) -> float:
    return value * (180.0 / 2**31) if abs(value) > 180 else value


def _parse_fit(content: bytes) -> list[TrackPoint]:
    import fitdecode

    points: list[TrackPoint] = []
    with fitdecode.FitReader(io.BytesIO(content)) as fit:
        for frame in fit:
            if not isinstance(frame, fitdecode.FitDataMessage) or frame.name != "record":
                continue
            latitude = frame.get_value("position_lat", fallback=None)
            longitude = frame.get_value("position_long", fallback=None)
            if latitude is None or longitude is None:
                continue
            elevation = frame.get_value("enhanced_altitude", fallback=None)
            if elevation is None:
                elevation = frame.get_value("altitude", fallback=0)
            point: TrackPoint = {
                "lat": _degrees(float(latitude)),
                "lon": _degrees(float(longitude)),
                "elevation": float(elevation or 0),
                "timestamp": _timestamp_millis(frame.get_value("timestamp", fallback=None)),
                "segment": 0,
            }
            heart_rate = frame.get_value("heart_rate", fallback=None)
            power = frame.get_value("power", fallback=None)
            if heart_rate is not None:
                point["heart_rate"] = int(heart_rate)
            if power is not None:
                point["power"] = int(power)
            _append_point(points, point)
    return points


def normalize_track(content: bytes, file_type: str) -> tuple[bytes, list[TrackPoint]]:
    decoded = _decompress(content)
    normalized_type = file_type.lower().removesuffix(".gz").lstrip(".")
    if normalized_type in {"gpx", "tcx"} and len(decoded) > MAX_XML_TRACK_BYTES:
        raise ValueError("XML activity file exceeds the 25 MB parsing limit")
    if normalized_type == "fit":
        points = _parse_fit(decoded)
    elif normalized_type == "gpx":
        points = _parse_gpx(decoded)
    elif normalized_type == "tcx":
        points = _parse_tcx(decoded)
    else:
        raise ValueError(f"Unsupported original activity file type: {file_type or 'unknown'}")
    if not points:
        raise ValueError("Activity file contains no positioned track points")
    return track_to_gpx(points), points


def track_to_gpx(points: list[TrackPoint]) -> bytes:
    ET.register_namespace("", "http://www.topografix.com/GPX/1/1")
    ET.register_namespace("gpxtpx", "http://www.garmin.com/xmlschemas/TrackPointExtension/v1")
    root = ET.Element(
        "{http://www.topografix.com/GPX/1/1}gpx",
        {"version": "1.1", "creator": "Dashboard Parapente"},
    )
    track = ET.SubElement(root, "{http://www.topografix.com/GPX/1/1}trk")
    segment = None
    current_segment = None
    for point in points:
        if segment is None or point.get("segment", 0) != current_segment:
            segment = ET.SubElement(track, "{http://www.topografix.com/GPX/1/1}trkseg")
            current_segment = point.get("segment", 0)
        element = ET.SubElement(
            segment,
            "{http://www.topografix.com/GPX/1/1}trkpt",
            {"lat": str(point["lat"]), "lon": str(point["lon"])},
        )
        ET.SubElement(element, "{http://www.topografix.com/GPX/1/1}ele").text = str(
            point.get("elevation", 0)
        )
        if point.get("timestamp", 0):
            timestamp = datetime.fromtimestamp(point["timestamp"] / 1000, tz=timezone.utc)
            ET.SubElement(element, "{http://www.topografix.com/GPX/1/1}time").text = (
                timestamp.isoformat().replace("+00:00", "Z")
            )
        if "heart_rate" in point or "power" in point:
            extensions = ET.SubElement(element, "{http://www.topografix.com/GPX/1/1}extensions")
            extension = ET.SubElement(
                extensions,
                "{http://www.garmin.com/xmlschemas/TrackPointExtension/v1}TrackPointExtension",
            )
            if "heart_rate" in point:
                ET.SubElement(
                    extension, "{http://www.garmin.com/xmlschemas/TrackPointExtension/v1}hr"
                ).text = str(point["heart_rate"])
            if "power" in point:
                ET.SubElement(extension, "power").text = str(point["power"])
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def calculate_track_stats(points: list[TrackPoint]) -> dict[str, Any]:
    elevations = [point.get("elevation", 0.0) for point in points]
    distance = sum(
        haversine_distance(previous["lat"], previous["lon"], current["lat"], current["lon"])
        for previous, current in zip(points, points[1:], strict=False)
        if previous.get("segment", 0) == current.get("segment", 0)
    )
    gain = sum(
        max(0.0, current.get("elevation", 0.0) - previous.get("elevation", 0.0))
        for previous, current in zip(points, points[1:], strict=False)
        if previous.get("segment", 0) == current.get("segment", 0)
    )
    valid_times = [point["timestamp"] for point in points if point.get("timestamp", 0) > 0]
    duration_seconds = (valid_times[-1] - valid_times[0]) / 1000 if len(valid_times) > 1 else 0
    max_speed = 0.0
    for previous, current in zip(points, points[1:], strict=False):
        if previous.get("segment", 0) != current.get("segment", 0):
            continue
        elapsed = current.get("timestamp", 0) - previous.get("timestamp", 0)
        if elapsed <= 0:
            continue
        segment_distance = haversine_distance(
            previous["lat"], previous["lon"], current["lat"], current["lon"]
        )
        speed = segment_distance / (elapsed / 3_600_000)
        if math.isfinite(speed) and speed < 150:
            max_speed = max(max_speed, speed)
    return {
        "max_altitude_m": round(max(elevations)),
        "elevation_gain_m": round(gain),
        "distance_km": round(distance, 2),
        "duration_minutes": round(duration_seconds / 60),
        "max_speed_kmh": round(max_speed, 2),
        "departure_time": (
            datetime.fromtimestamp(valid_times[0] / 1000, tz=timezone.utc) if valid_times else None
        ),
    }
