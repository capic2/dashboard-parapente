import base64
import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

import config

logger = logging.getLogger(__name__)

AZBA_OFFICIAL_URL = "https://www.sia.aviation-civile.gouv.fr/schedules"
_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}


@dataclass(frozen=True)
class AzbaActiveZone:
    id: str
    name: str
    valid_from: str | None
    valid_to: str | None
    floor: str | None
    ceiling: str | None
    geometry: dict[str, Any] | None
    distance_km: float | None


class AzbaClientError(RuntimeError):
    """Raised when official SIA AZBA data cannot be retrieved."""


def _cache_get(key: str) -> dict[str, Any] | None:
    cached = _CACHE.get(key)
    if cached is None:
        return None
    cached_at, payload = cached
    if datetime.now(timezone.utc) - cached_at > timedelta(seconds=config.AZBA_CACHE_TTL_SECONDS):
        _CACHE.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    _CACHE[key] = (datetime.now(timezone.utc), payload)


def _build_auth_header(path_with_query: str) -> dict[str, str]:
    if not config.AZBA_API_AUTH_SECRET:
        return {}
    token_uri = hashlib.sha512(
        f"{config.AZBA_API_AUTH_SECRET}/api/{path_with_query}".encode()
    ).hexdigest()
    token = base64.b64encode(f'{{"tokenUri":"{token_uri}"}}'.encode()).decode("ascii")
    return {"AUTH": token}


def _join_api_path(path_with_query: str) -> str:
    return f"{config.AZBA_API_BASE_URL.rstrip('/')}/{path_with_query.lstrip('/')}"


def _to_iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _first_text(payload: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, int | float):
            return str(value)
    return None


def _iter_nested_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from _iter_nested_dicts(nested)
    elif isinstance(value, list):
        for item in value:
            yield from _iter_nested_dicts(item)


def _extract_collection(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("hydra:member", "member", "items", "data", "results", "features"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return [payload]


def _extract_coordinates(payload: dict[str, Any]) -> list[tuple[float, float]]:
    coords: list[tuple[float, float]] = []
    for item in _iter_nested_dicts(payload):
        lat = item.get("lat", item.get("latitude"))
        lon = item.get("lon", item.get("lng", item.get("longitude")))
        if isinstance(lat, int | float) and isinstance(lon, int | float):
            coords.append((float(lat), float(lon)))
    return coords


def _extract_geometry(payload: dict[str, Any]) -> dict[str, Any] | None:
    geometry = payload.get("geometry")
    if isinstance(geometry, dict):
        return geometry
    coordinates = _extract_coordinates(payload)
    if not coordinates:
        return None
    ring = [[lon, lat] for lat, lon in coordinates]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    earth_radius_km = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(a))


def _distance_to_payload_km(
    payload: dict[str, Any], site_lat: float, site_lon: float
) -> float | None:
    distances = [
        _haversine_km(site_lat, site_lon, lat, lon) for lat, lon in _extract_coordinates(payload)
    ]
    return min(distances) if distances else None


def _normalize_active_zone(
    payload: dict[str, Any], site_lat: float, site_lon: float
) -> AzbaActiveZone:
    zone_id = _first_text(payload, ("id", "mid", "uuid", "codeId", "name", "txtName")) or "unknown"
    name = (
        _first_text(payload, ("name", "txtName", "codeId", "id", "mid")) or f"Zone RTBA {zone_id}"
    )
    valid_from = _first_text(payload, ("startTime", "valid_from", "start", "dateStart"))
    valid_to = _first_text(payload, ("endTime", "valid_to", "end", "dateEnd"))
    return AzbaActiveZone(
        id=str(zone_id),
        name=name,
        valid_from=valid_from,
        valid_to=valid_to,
        floor=_first_text(payload, ("floor", "lower", "plancher", "lowerLimit", "valDistVerLower")),
        ceiling=_first_text(
            payload, ("ceiling", "upper", "plafond", "upperLimit", "valDistVerUpper")
        ),
        geometry=_extract_geometry(payload),
        distance_km=_distance_to_payload_km(payload, site_lat, site_lon),
    )


def _zone_matches_site(zone: AzbaActiveZone, radius_km: float) -> bool:
    if zone.distance_km is None:
        return False
    return zone.distance_km <= radius_km


async def _get_json(path_with_query: str) -> dict[str, Any]:
    url = _join_api_path(path_with_query)
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=_build_auth_header(path_with_query))
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AzbaClientError(f"Unable to retrieve SIA AZBA data from {url}") from exc
    if not isinstance(payload, dict):
        return {"items": payload}
    return payload


async def _get_current_range() -> dict[str, Any]:
    path = f"{config.AZBA_API_VERSION.rstrip('/')}/custom/currentDate"
    return await _get_json(path)


async def _get_active_zones(
    start: datetime, end: datetime, latest_azba_date: str
) -> dict[str, Any]:
    params = urlencode(
        {
            "itemsPerPage": "600",
            "date": latest_azba_date,
            "timeSlots.startTime[before]": _to_iso_utc(end),
            "timeSlots.endTime[after]": _to_iso_utc(start),
        }
    )
    path = f"{config.AZBA_API_VERSION.rstrip('/')}/r_t_b_as?{params}"
    return await _get_json(path)


async def evaluate_site_azba_constraints(
    *,
    site_id: str,
    site_name: str,
    site_lat: float,
    site_lon: float,
    start: datetime,
    end: datetime,
    radius_km: float | None = None,
) -> dict[str, Any]:
    radius = radius_km if radius_km is not None else config.AZBA_SITE_RADIUS_KM
    cache_key = ":".join(
        [
            "azba",
            site_id,
            _to_iso_utc(start),
            _to_iso_utc(end),
            f"{site_lat:.5f}",
            f"{site_lon:.5f}",
            f"{radius:.1f}",
        ]
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    retrieved_at = _to_iso_utc(datetime.now(timezone.utc))
    try:
        current_range = await _get_current_range()
        latest_azba_date = str(
            current_range.get("rtba")
            or current_range.get("latest_azba_date")
            or current_range.get("date")
            or start.date().isoformat()
        )
        active_payload = await _get_active_zones(start, end, latest_azba_date)
        active_zones = [
            _normalize_active_zone(item, site_lat, site_lon)
            for item in _extract_collection(active_payload)
        ]
        constraints = [zone for zone in active_zones if _zone_matches_site(zone, radius)]
        status = "blocking" if constraints else "clear"
        result = {
            "site_id": site_id,
            "site_name": site_name,
            "status": status,
            "source": "SIA AZBA",
            "source_url": AZBA_OFFICIAL_URL,
            "retrieved_at": retrieved_at,
            "valid_from": _to_iso_utc(start),
            "valid_to": _to_iso_utc(end),
            "radius_km": radius,
            "latest_azba_date": latest_azba_date,
            "constraints": [zone.__dict__ for zone in constraints],
            "message": None,
        }
    except AzbaClientError as exc:
        logger.warning("SIA AZBA evaluation failed for site %s: %s", site_id, exc)
        result = {
            "site_id": site_id,
            "site_name": site_name,
            "status": "unknown",
            "source": "SIA AZBA",
            "source_url": AZBA_OFFICIAL_URL,
            "retrieved_at": retrieved_at,
            "valid_from": _to_iso_utc(start),
            "valid_to": _to_iso_utc(end),
            "radius_km": radius,
            "latest_azba_date": None,
            "constraints": [],
            "message": "Information AZBA indisponible depuis le SIA.",
        }
    if result["status"] != "unknown":
        _cache_set(cache_key, result)
    return result


def get_default_azba_window(day_index: int) -> tuple[datetime, datetime]:
    today = datetime.now(timezone.utc).date() + timedelta(days=day_index)
    start = datetime.combine(today, time(6, 0), tzinfo=timezone.utc)
    end = datetime.combine(today, time(20, 0), tzinfo=timezone.utc)
    return start, end


def parse_optional_window(
    start: str | None, end: str | None, day_index: int
) -> tuple[datetime, datetime]:
    default_start, default_end = get_default_azba_window(day_index)
    parsed_start = _parse_datetime(start) if start else default_start
    parsed_end = _parse_datetime(end) if end else default_end
    if parsed_end <= parsed_start:
        raise ValueError("end must be after start")
    return parsed_start, parsed_end
