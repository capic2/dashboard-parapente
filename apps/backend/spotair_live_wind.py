from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any

import httpx

SPOTAIR_BALISES_URL = "https://data.spotair.mobi/balises/releves-get.php"
SPOTAIR_BALISES_API_KEY = "dMK0l++8QOSZtBKr4zpq6w=="
SPOTAIR_STALE_MINUTES = 30


def build_bbox(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    """Build a simple lat/lon bounding box from center+radius."""
    lat_delta = radius_km / 111.0
    cos_lat = max(0.01, math.cos(math.radians(lat)))
    lon_delta = radius_km / (111.32 * cos_lat)
    return (lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance in kilometers."""
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _build_source_url(provider_key: str | None, balise_id: str | None) -> str | None:
    if not provider_key or not balise_id:
        return None
    provider = provider_key.lower()
    if provider == "ffvl":
        return f"https://balisemeteo.com/balise.php?idBalise={balise_id}"
    if provider == "pioupiou":
        return f"https://www.openwindmap.org/PP{balise_id}"
    if provider == "romma":
        return f"https://www.romma.fr/station_24.php?id={balise_id}"
    if provider == "holfuy":
        return f"https://holfuy.com/fr/weather/{balise_id}"
    return None


async def fetch_live_wind_stations(
    *,
    site_lat: float,
    site_lon: float,
    radius_km: float,
) -> list[dict[str, Any]]:
    """Fetch and normalize SpotAiR live wind stations around a site."""
    south, north, west, east = build_bbox(site_lat, site_lon, radius_km)

    headers = {
        "X-Spotair-Apikey": SPOTAIR_BALISES_API_KEY,
        "User-Agent": "Mozilla/5.0 (dashboard-parapente)",
        "Accept": "application/json,text/plain,*/*",
    }
    form_data = {
        "sud": f"{south:.6f}",
        "nord": f"{north:.6f}",
        "ouest": f"{west:.6f}",
        "est": f"{east:.6f}",
        "histo": "390",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(SPOTAIR_BALISES_URL, headers=headers, data=form_data)
        response.raise_for_status()

    payload = response.json()
    if payload.get("code") != 0:
        msg = payload.get("msg", "Unknown SpotAiR error")
        raise ValueError(f"SpotAiR error: {msg}")

    stations_raw = payload.get("data") or []
    now_ts = int(datetime.now(timezone.utc).timestamp())
    stations: list[dict[str, Any]] = []

    for station in stations_raw:
        lat = station.get("latitude")
        lon = station.get("longitude")
        if lat is None or lon is None:
            continue

        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (TypeError, ValueError):
            continue

        releves = station.get("releves") or []
        latest = releves[0] if releves else {}
        report_ts = latest.get("date_releve")

        try:
            report_ts_int = int(report_ts) if report_ts is not None else None
        except (TypeError, ValueError):
            report_ts_int = None

        age_minutes = None
        reported_at = None
        if report_ts_int is not None:
            age_minutes = max(0, int((now_ts - report_ts_int) / 60))
            reported_at = datetime.fromtimestamp(report_ts_int, tz=timezone.utc).isoformat()

        distance_km = haversine_distance_km(site_lat, site_lon, lat_f, lon_f)

        provider_key = station.get("provider_key")
        balise_id = station.get("balise_id")
        name = station.get("nom") or f"{provider_key} #{balise_id}"

        stations.append(
            {
                "id": f"{provider_key}_{balise_id}",
                "provider": provider_key,
                "provider_id": str(balise_id) if balise_id is not None else None,
                "name": name,
                "latitude": lat_f,
                "longitude": lon_f,
                "altitude_m": station.get("altitude"),
                "distance_km": round(distance_km, 2),
                "last_report_at": reported_at,
                "age_minutes": age_minutes,
                "is_outdated": age_minutes is None or age_minutes > SPOTAIR_STALE_MINUTES,
                "wind_avg_kmh": latest.get("vmoy"),
                "wind_min_kmh": latest.get("vmin"),
                "wind_max_kmh": latest.get("vmax"),
                "wind_direction_deg": latest.get("direction"),
                "temperature_c": latest.get("temperature"),
                "cloud_ceiling_m": latest.get("plafond_nuages"),
                "source_url": _build_source_url(
                    str(provider_key) if provider_key is not None else None,
                    str(balise_id) if balise_id is not None else None,
                ),
            }
        )

    stations.sort(key=lambda s: (s["distance_km"], s["age_minutes"] or 10_000))
    return stations
