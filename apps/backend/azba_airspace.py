import base64
import hashlib
import html
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urljoin

import httpx

import config

logger = logging.getLogger(__name__)

AZBA_OFFICIAL_URL = "https://www.sia.aviation-civile.gouv.fr/schedules"
AZBA_PUBLIC_APP_URL = "https://www.sia.aviation-civile.gouv.fr/azbaEx/?lang=fr"
SOFIA_NOTAM_AREA_URL = "https://sofia-briefing.aviation-civile.gouv.fr/sofia"
SOFIA_NOTAM_AREA_PAGE_URL = (
    "https://sofia-briefing.aviation-civile.gouv.fr/sofia/pages/notamarea.html"
)
_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}
_AZBA_API_AUTH_SECRET_CACHE: str | None = None
_DMS_RE = re.compile(
    r"^(?P<degrees>\d{2,3})(?P<minutes>\d{2})(?P<seconds>\d{2}(?:\.\d+)?)(?P<hemisphere>[NSEW])$"
)
_AZBA_MAIN_SCRIPT_RE = re.compile(
    r'<script\s+src="(?P<src>main\.[^"]+\.js)"\s+type="module"></script>'
)
_AZBA_SHARE_SECRET_RE = re.compile(r'share_secret:"(?P<secret>[^"]+)"')
_SOFIA_MESSAGE_RE = re.compile(r'<div id="Message">(?P<message>.*?)</div>', re.DOTALL)
_NOTAM_COORDINATE_RE = re.compile(
    r"^(?P<lat_deg>\d{2})(?P<lat_min>\d{2})(?P<lat_hem>[NS])"
    r"(?P<lon_deg>\d{3})(?P<lon_min>\d{2})(?P<lon_hem>[EW])$"
)


@dataclass(frozen=True)
class AzbaActiveZone:
    id: str
    name: str
    zone_type: str | None
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


def _extract_azba_public_app_script_url(html: str) -> str | None:
    match = _AZBA_MAIN_SCRIPT_RE.search(html)
    if match is None:
        return None
    return urljoin(AZBA_PUBLIC_APP_URL, match.group("src"))


def _extract_azba_public_auth_secret(script: str) -> str | None:
    match = _AZBA_SHARE_SECRET_RE.search(script)
    if match is None:
        return None
    return match.group("secret")


async def _get_azba_api_auth_secret(client: httpx.AsyncClient) -> str:
    global _AZBA_API_AUTH_SECRET_CACHE

    if config.AZBA_API_AUTH_SECRET:
        return config.AZBA_API_AUTH_SECRET
    if _AZBA_API_AUTH_SECRET_CACHE:
        return _AZBA_API_AUTH_SECRET_CACHE

    try:
        app_response = await client.get(AZBA_PUBLIC_APP_URL)
        app_response.raise_for_status()
        script_url = _extract_azba_public_app_script_url(app_response.text)
        if script_url is None:
            raise AzbaClientError("Unable to locate SIA AZBA public app script")

        script_response = await client.get(script_url)
        script_response.raise_for_status()
        auth_secret = _extract_azba_public_auth_secret(script_response.text)
        if auth_secret is None:
            raise AzbaClientError("Unable to locate SIA AZBA public auth signature")
    except httpx.HTTPError as exc:
        raise AzbaClientError("Unable to retrieve SIA AZBA public app signature") from exc

    _AZBA_API_AUTH_SECRET_CACHE = auth_secret
    return auth_secret


def _build_auth_header(path_with_query: str, auth_secret: str | None) -> dict[str, str]:
    if not auth_secret:
        return {}
    token_uri = hashlib.sha512(f"{auth_secret}/api/{path_with_query}".encode()).hexdigest()
    token = base64.b64encode(f'{{"tokenUri":"{token_uri}"}}'.encode()).decode("ascii")
    return {"AUTH": token}


def _join_api_path(path_with_query: str) -> str:
    return f"{config.AZBA_API_BASE_URL.rstrip('/')}/{path_with_query.lstrip('/')}"


def _to_iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _to_sia_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


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


def _coordinate_to_decimal(value: Any) -> float | None:
    if isinstance(value, int | float):
        return float(value)
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        return float(stripped)
    except ValueError:
        pass
    match = _DMS_RE.match(stripped)
    if match is None:
        return None
    decimal = (
        int(match.group("degrees"))
        + int(match.group("minutes")) / 60
        + float(match.group("seconds")) / 3600
    )
    if match.group("hemisphere") in {"S", "W"}:
        decimal *= -1
    return decimal


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
        decimal_lat = _coordinate_to_decimal(lat)
        decimal_lon = _coordinate_to_decimal(lon)
        if decimal_lat is not None and decimal_lon is not None:
            coords.append((decimal_lat, decimal_lon))
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
    zone_type = _first_text(payload, ("zoneType", "codeType", "initialCodeType", "type"))
    name = (
        _first_text(payload, ("name", "txtName", "codeId", "id", "mid")) or f"Zone RTBA {zone_id}"
    )
    valid_from = _first_text(payload, ("startTime", "valid_from", "start", "dateStart"))
    valid_to = _first_text(payload, ("endTime", "valid_to", "end", "dateEnd"))
    return AzbaActiveZone(
        id=str(zone_id),
        name=name,
        zone_type=zone_type,
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


def _format_notam_coordinate(value: float, *, latitude: bool) -> str:
    absolute = abs(value)
    degrees = int(absolute)
    minutes = round((absolute - degrees) * 60)
    if minutes == 60:
        degrees += 1
        minutes = 0
    hemisphere = ("N" if value >= 0 else "S") if latitude else ("E" if value >= 0 else "W")
    return f"{degrees:0{2 if latitude else 3}d}{minutes:02d}{hemisphere}"


def _notam_coordinate_pair(value: str) -> tuple[float, float] | None:
    match = _NOTAM_COORDINATE_RE.match(value.strip().upper())
    if match is None:
        return None
    latitude = int(match.group("lat_deg")) + int(match.group("lat_min")) / 60
    longitude = int(match.group("lon_deg")) + int(match.group("lon_min")) / 60
    if match.group("lat_hem") == "S":
        latitude *= -1
    if match.group("lon_hem") == "W":
        longitude *= -1
    return latitude, longitude


def _notam_geometry(latitude: float, longitude: float, radius_km: float) -> dict[str, Any]:
    from math import cos, pi, radians, sin

    points: list[list[float]] = []
    latitude_radius = radius_km / 111.32
    longitude_radius = radius_km / (111.32 * cos(radians(latitude)))
    for index in range(33):
        angle = 2 * pi * index / 32
        points.append(
            [longitude + longitude_radius * cos(angle), latitude + latitude_radius * sin(angle)]
        )
    return {"type": "Polygon", "coordinates": [points]}


def _extract_sofia_notams(payload: dict[str, Any]) -> list[dict[str, Any]]:
    notams: list[dict[str, Any]] = []
    for item in _iter_nested_dicts(payload):
        if isinstance(item.get("qLine"), dict) and item.get("itemE"):
            notams.append(item)
    return notams


def _normalize_zrt_notam(
    payload: dict[str, Any], site_lat: float, site_lon: float
) -> AzbaActiveZone | None:
    q_line = payload.get("qLine")
    if not isinstance(q_line, dict):
        return None
    text = str(payload.get("itemE") or "")
    code45 = str(q_line.get("code45") or "").upper()
    if code45 != "RT" and "ZRT" not in text.upper():
        return None
    coordinates = _notam_coordinate_pair(str(payload.get("coordinates") or ""))
    if coordinates is None:
        return None
    latitude, longitude = coordinates
    radius_km = float(payload.get("radius") or 0) * 1.852
    center_distance_km = _haversine_km(site_lat, site_lon, latitude, longitude)
    return AzbaActiveZone(
        id=f"{payload.get('nof', 'NOTAM')}-{payload.get('series', '')}{payload.get('number', '')}/{payload.get('year', '')}",
        name=f"ZRT {payload.get('itemA') or payload.get('number') or 'NOTAM'}",
        zone_type="ZRT",
        valid_from=_first_text(payload, ("startValidity",)),
        valid_to=_first_text(payload, ("endValidity",)),
        floor=(
            _first_text(
                payload.get("itemF", {}) if isinstance(payload.get("itemF"), dict) else {},
                ("value",),
            )
            or str(payload.get("itemF"))
            if payload.get("itemF")
            else None
        ),
        ceiling=str(payload.get("itemG")) if payload.get("itemG") else None,
        geometry=_notam_geometry(latitude, longitude, radius_km) if radius_km > 0 else None,
        distance_km=max(0, center_distance_km - radius_km),
    )


async def _get_active_zrt_zones(
    start: datetime,
    end: datetime,
    site_lat: float,
    site_lon: float,
    radius_km: float,
) -> list[AzbaActiveZone]:
    duration_minutes = max(1, min(9600, int((end - start).total_seconds() // 60)))
    duration = f"{duration_minutes // 60:02d}{duration_minutes % 60:02d}"
    form_data = [
        (":operation", "postAreaPibRequest"),
        ("valid_from", _to_iso_utc(start)),
        ("duration", duration),
        ("traffic[]", "V"),
        ("traffic[]", "I"),
        ("fl_lower", "000"),
        ("fl_upper", "999"),
        ("radius", str(max(1, round(radius_km / 1.852)))),
        ("lat", _format_notam_coordinate(site_lat, latitude=True)),
        ("long", _format_notam_coordinate(site_lon, latitude=False)),
        ("isFromSofia", "true"),
    ]
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            page = await client.get(SOFIA_NOTAM_AREA_PAGE_URL)
            page.raise_for_status()
            response = await client.post(SOFIA_NOTAM_AREA_URL, data=form_data)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise AzbaClientError("Unable to retrieve SOFIA NOTAM data") from exc
    match = _SOFIA_MESSAGE_RE.search(response.text)
    if match is None:
        raise AzbaClientError("SOFIA returned an invalid NOTAM response")
    try:
        payload = json.loads(html.unescape(match.group("message")))
    except json.JSONDecodeError as exc:
        raise AzbaClientError("SOFIA returned invalid NOTAM JSON") from exc
    return [
        zone
        for item in _extract_sofia_notams(payload)
        if (zone := _normalize_zrt_notam(item, site_lat, site_lon)) is not None
        and _zone_matches_site(zone, radius_km)
    ]


async def _get_json(path_with_query: str) -> dict[str, Any]:
    global _AZBA_API_AUTH_SECRET_CACHE

    url = _join_api_path(path_with_query)
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                response = await _get_json_response(client, url, path_with_query)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in {401, 403} or config.AZBA_API_AUTH_SECRET:
                    raise
                _AZBA_API_AUTH_SECRET_CACHE = None
                response = await _get_json_response(client, url, path_with_query)
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AzbaClientError(f"Unable to retrieve SIA AZBA data from {url}") from exc
    if not isinstance(payload, dict):
        return {"items": payload}
    return payload


async def _get_json_response(
    client: httpx.AsyncClient, url: str, path_with_query: str
) -> httpx.Response:
    auth_secret = await _get_azba_api_auth_secret(client)
    response = await client.get(url, headers=_build_auth_header(path_with_query, auth_secret))
    response.raise_for_status()
    return response


async def _get_current_range() -> dict[str, Any]:
    path = f"{config.AZBA_API_VERSION.rstrip('/')}/custom/currentDate"
    return await _get_json(path)


async def _get_active_zones(
    start: datetime, end: datetime, latest_azba_date: str
) -> dict[str, Any]:
    params = urlencode(
        {
            "itemsPerPage": "600",
            "debutIntervalTemps": _to_sia_utc(start),
            "finIntervalTemps": _to_sia_utc(end),
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
    constraints: list[AzbaActiveZone] = []
    latest_azba_date: str | None = None
    azba_lookup_failed = False
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
        constraints.extend(zone for zone in active_zones if _zone_matches_site(zone, radius))
    except AzbaClientError as exc:
        azba_lookup_failed = True
        logger.warning("SIA AZBA evaluation failed for site %s: %s", site_id, exc)

    zrt_lookup_failed = False
    try:
        constraints.extend(await _get_active_zrt_zones(start, end, site_lat, site_lon, radius))
    except AzbaClientError as exc:
        zrt_lookup_failed = True
        logger.warning("SOFIA ZRT evaluation failed for site %s: %s", site_id, exc)

    status = (
        "blocking"
        if constraints
        else "unknown" if azba_lookup_failed or zrt_lookup_failed else "clear"
    )
    failed_sources = []
    if azba_lookup_failed:
        failed_sources.append("AZBA")
    if zrt_lookup_failed:
        failed_sources.append("ZRT")
    result = {
        "site_id": site_id,
        "site_name": site_name,
        "status": status,
        "source": "SIA AZBA + SOFIA NOTAM",
        "source_url": AZBA_OFFICIAL_URL,
        "retrieved_at": retrieved_at,
        "valid_from": _to_iso_utc(start),
        "valid_to": _to_iso_utc(end),
        "radius_km": radius,
        "latest_azba_date": latest_azba_date,
        "constraints": [zone.__dict__ for zone in constraints],
        "message": (
            f"Information {', '.join(failed_sources)} indisponible depuis les sources officielles."
            if failed_sources
            else None
        ),
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
