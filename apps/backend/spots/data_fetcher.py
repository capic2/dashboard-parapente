"""
Data fetcher for paragliding spots from external sources

Fetches and merges data from:
- OpenAIP: Hang gliding sites via the official API
- ParaglidingSpots.com: Community database (JavaScript format)
"""

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any

import requests
from sqlalchemy.orm import Session

from config import OPENAIP_API_KEY
from .distance import haversine_distance

logger = logging.getLogger(__name__)

# Data source URLs
OPENAIP_HANG_GLIDINGS_URL = "https://api.core.openaip.net/api/hang-glidings"
OPENAIP_PAGE_SIZE = 1000
PARAGLIDINGSPOTS_URL = "https://paraglidingspots.com/online/js/pgs.siteslong.js?key=2602"

# Duplicate detection threshold (meters)
DUPLICATE_DISTANCE_THRESHOLD_M = 100


class OpenAIPFetchError(RuntimeError):
    """Raised when OpenAIP data cannot be fetched completely."""


def fetch_openaip_data(*, fail_on_error: bool = False) -> list[dict]:
    """
    Fetch French paragliding sites from the official OpenAIP API.

    Returns:
        List of spots in standardized format

    Example spot structure:
        {
            "id": "openaip_6293a4af...",
            "name": "DÉCOLLAGE LA MALTOURNÉE NORD",
            "type": "takeoff",  # or "landing"
            "latitude": 47.1944,
            "longitude": 5.9896,
            "elevation_m": 462,
            "country": "FR",
            "source": "openaip",
            "openaip_id": "6293a4af...",
            "raw_metadata": "{...}"
        }
    """
    if not OPENAIP_API_KEY:
        logger.warning("Skipping OpenAIP fetch because BACKEND_OPENAIP_API_KEY is not configured")
        return []

    try:
        spots = []
        page = 1
        headers = {"x-openaip-api-key": OPENAIP_API_KEY}

        while True:
            data = None
            for attempt in range(2):
                try:
                    response = requests.get(
                        OPENAIP_HANG_GLIDINGS_URL,
                        headers=headers,
                        params=[
                            ("country", "FR"),
                            ("page", str(page)),
                            ("limit", str(OPENAIP_PAGE_SIZE)),
                            ("type", "0"),  # Take-off
                            ("type", "1"),  # Landing
                            ("category", "0"),  # Paraglider
                        ],
                        timeout=30,
                    )
                    response.raise_for_status()
                    page_data = response.json()
                    if not isinstance(page_data, dict) or not isinstance(
                        page_data.get("items"), list
                    ):
                        raise OpenAIPFetchError("OpenAIP response does not contain an items list")
                    data = page_data
                    break
                except (OpenAIPFetchError, requests.RequestException) as e:
                    if attempt == 0:
                        logger.warning("OpenAIP page %s failed; retrying: %s", page, e)
                        continue
                    message = f"Failed to fetch OpenAIP page {page} after retry: {e}"
                    if fail_on_error:
                        raise OpenAIPFetchError(message) from e
                    logger.error(message)
                    return []

            if data is None:
                raise OpenAIPFetchError(f"OpenAIP page {page} returned no data")

            for item in data["items"]:
                try:
                    spot = _parse_openaip_spot(item)
                    if spot is not None:
                        spots.append(spot)
                except (AttributeError, KeyError, TypeError, ValueError) as e:
                    logger.warning("Failed to parse OpenAIP spot: %s", e)

            next_page = data.get("nextPage")
            if not isinstance(next_page, int) or next_page <= page:
                break
            page = next_page

        logger.info(f"✓ Fetched {len(spots)} spots from OpenAIP")
        return spots
    except OpenAIPFetchError as e:
        if fail_on_error:
            raise
        logger.error("Failed to fetch OpenAIP data: %s", e)
        return []


def _parse_openaip_spot(item: dict[str, Any]) -> dict[str, Any] | None:
    """Convert an OpenAIP hang-gliding site to the internal spot shape."""
    geometry = item.get("geometry") or {}
    coords = geometry.get("coordinates") or []
    if len(coords) < 2:
        logger.warning("Skipping OpenAIP spot with invalid coordinates: %s", item.get("name"))
        return None

    longitude, latitude = coords[0], coords[1]
    elevation = item.get("elevation")
    elevation_m = elevation.get("value") if isinstance(elevation, dict) else None
    openaip_id = item.get("_id") or ""
    name = str(item.get("name") or "")
    spot_type = "landing" if item.get("type") == 1 else "takeoff"

    country = item.get("country", "FR")
    if isinstance(country, list):
        country = country[0] if country else "FR"

    spot_id = (
        f"openaip_{openaip_id}"
        if openaip_id
        else f"openaip_{hashlib.md5(name.encode()).hexdigest()}"
    )

    return {
        "id": spot_id,
        "name": name.upper(),
        "type": spot_type,
        "latitude": float(latitude),
        "longitude": float(longitude),
        "elevation_m": elevation_m,
        "orientation": None,
        "rating": None,
        "country": country,
        "source": "openaip",
        "openaip_id": openaip_id,
        "paraglidingspots_id": None,
        "raw_metadata": json.dumps(item),
    }


def fetch_paraglidingspots_data() -> list[dict]:
    """
    Fetch paragliding spots from ParaglidingSpots.com JavaScript file.

    Format: JavaScript array with structure:
    [ID, Lon, Lat, "Name", Type, Rating, _, "FR", _, Flags]

    Returns:
        List of spots in standardized format
    """
    logger.info(f"Fetching ParaglidingSpots data from {PARAGLIDINGSPOTS_URL}")

    try:
        response = requests.get(PARAGLIDINGSPOTS_URL, timeout=30)
        response.raise_for_status()

        # Parse JavaScript variable assignment
        # Format: var pgsSites = [[ID, Lon, Lat, "Name", ...], ...]
        js_content = response.text

        # Extract array content using regex
        # Look for: var someName = [...]
        match = re.search(r"var\s+\w+\s*=\s*(\[[\s\S]*\]);", js_content)
        if not match:
            logger.error("Failed to parse ParaglidingSpots JavaScript")
            return []

        array_str = match.group(1)

        # The array is already valid JSON (uses double quotes), just parse it
        data = json.loads(array_str)

        if not isinstance(data, list):
            logger.error("ParaglidingSpots data is not a list")
            return []

        spots = []
        for item in data:
            try:
                # Parse array format: [ID, Lon, Lat, "Name", Type, Rating, _, "FR", _, Flags]
                if len(item) < 8:
                    continue

                pgs_id = int(item[0])
                longitude = float(item[1])
                latitude = float(item[2])
                name = str(item[3])
                type_code = int(item[4])  # 1=TO, 2=LZ
                rating = int(item[5]) if item[5] is not None else None
                country = str(item[7])

                # Filter France only
                if country != "FR":
                    continue

                # Type conversion
                spot_type = "takeoff" if type_code == 1 else "landing" if type_code == 2 else "both"

                # Extract orientation from name if present
                # Format: "TO (NNW) Arguel_Les Grands Pres_Pugey"
                orientation = None
                orientation_match = re.search(r"\(([NSEW]+)\)", name)
                if orientation_match:
                    orientation = orientation_match.group(1)

                spot = {
                    "id": f"pgs_{pgs_id}",
                    "name": name.upper(),
                    "type": spot_type,
                    "latitude": latitude,
                    "longitude": longitude,
                    "elevation_m": None,  # Not available in JS file
                    "orientation": orientation,
                    "rating": rating,
                    "country": country,
                    "source": "paraglidingspots",
                    "openaip_id": None,
                    "paraglidingspots_id": pgs_id,
                    "raw_metadata": json.dumps(item),
                }

                spots.append(spot)

            except (IndexError, ValueError, TypeError) as e:
                logger.warning(f"Failed to parse ParaglidingSpots item: {e}")
                continue

        logger.info(f"✓ Fetched {len(spots)} spots from ParaglidingSpots")
        return spots

    except requests.RequestException as e:
        logger.error(f"Failed to fetch ParaglidingSpots data: {e}")
        return []
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse ParaglidingSpots JSON: {e}")
        return []


def merge_duplicate_spots(openaip_spots: list[dict], pgs_spots: list[dict]) -> list[dict]:
    """
    Merge duplicate spots from both sources.

    Strategy:
    - Use haversine distance <100m to identify duplicates
    - For duplicates: prefer OpenAIP coords, merge metadata
    - Keep unique spots from both sources

    Args:
        openaip_spots: List of spots from OpenAIP
        pgs_spots: List of spots from ParaglidingSpots

    Returns:
        Merged list with duplicates resolved
    """
    logger.info(f"Merging {len(openaip_spots)} OpenAIP + {len(pgs_spots)} PGS spots...")

    merged = []
    pgs_matched_indices = set()

    # For each OpenAIP spot, look for PGS matches
    for oa_spot in openaip_spots:
        matched_pgs = None
        matched_pgs_idx = None

        for idx, pgs_spot in enumerate(pgs_spots):
            if idx in pgs_matched_indices:
                continue

            # Calculate distance
            distance_m = (
                haversine_distance(
                    oa_spot["latitude"],
                    oa_spot["longitude"],
                    pgs_spot["latitude"],
                    pgs_spot["longitude"],
                )
                * 1000
            )  # Convert km to m

            if distance_m < DUPLICATE_DISTANCE_THRESHOLD_M:
                matched_pgs = pgs_spot
                matched_pgs_idx = idx
                break

        if matched_pgs:
            # Merge the two spots
            # Generate new merged ID
            # Extract IDs first for Python 3.11 compatibility (f-string syntax)
            oa_id = oa_spot["id"]
            pgs_id = matched_pgs["id"]
            merged_id = f"merged_{hashlib.md5(f'{oa_id}_{pgs_id}'.encode()).hexdigest()[:16]}"

            merged_spot = {
                "id": merged_id,
                "name": oa_spot["name"],  # Prefer OpenAIP name
                "type": oa_spot["type"],  # Should be same
                "latitude": oa_spot["latitude"],  # Prefer OpenAIP coords
                "longitude": oa_spot["longitude"],
                "elevation_m": oa_spot["elevation_m"],  # OpenAIP has elevation
                "orientation": matched_pgs["orientation"],  # PGS has orientation
                "rating": matched_pgs["rating"],  # PGS has rating
                "country": oa_spot["country"],
                "source": "merged",
                "openaip_id": oa_spot["openaip_id"],
                "paraglidingspots_id": matched_pgs["paraglidingspots_id"],
                "raw_metadata": json.dumps(
                    {
                        "openaip": json.loads(oa_spot["raw_metadata"]),
                        "paraglidingspots": json.loads(matched_pgs["raw_metadata"]),
                    }
                ),
            }

            merged.append(merged_spot)
            pgs_matched_indices.add(matched_pgs_idx)

        else:
            # No match, keep OpenAIP spot as-is
            merged.append(oa_spot)

    # Add unmatched PGS spots
    for idx, pgs_spot in enumerate(pgs_spots):
        if idx not in pgs_matched_indices:
            merged.append(pgs_spot)

    stats = {
        "openaip_only": len([s for s in merged if s["source"] == "openaip"]),
        "pgs_only": len([s for s in merged if s["source"] == "paraglidingspots"]),
        "merged": len([s for s in merged if s["source"] == "merged"]),
        "total": len(merged),
    }

    logger.info(
        f"✓ Merge complete: {stats['merged']} merged, {stats['openaip_only']} OA-only, {stats['pgs_only']} PGS-only → {stats['total']} total"
    )

    return merged


def sync_to_database(db: Session) -> dict[str, int]:
    """
    Sync paragliding spots to database.

    Process:
    1. Fetch from both sources
    2. Merge duplicates
    3. Upsert to database
    4. Update last_synced timestamp

    Args:
        db: SQLAlchemy database session

    Returns:
        Stats dictionary with counts
    """
    from models import ParaglidingSpot  # Import here to avoid circular dependency

    logger.info("Starting spots sync...")

    # Fetch data
    openaip_spots = fetch_openaip_data(fail_on_error=True)
    pgs_spots = fetch_paraglidingspots_data()

    if not openaip_spots and not pgs_spots:
        logger.error("No data fetched from any source")
        return {"added": 0, "updated": 0, "total": 0, "error": "No data fetched"}

    # Merge duplicates
    all_spots = merge_duplicate_spots(openaip_spots, pgs_spots)

    # Sync to database
    added = 0
    updated = 0
    now = datetime.utcnow()

    for spot_data in all_spots:
        try:
            # Check if spot exists
            existing = (
                db.query(ParaglidingSpot).filter(ParaglidingSpot.id == spot_data["id"]).first()
            )

            if existing:
                # Update existing
                for key, value in spot_data.items():
                    if key != "id":  # Don't update primary key
                        setattr(existing, key, value)
                existing.last_synced = now
                existing.updated_at = now
                updated += 1
            else:
                # Create new
                spot_data["last_synced"] = now
                spot_data["created_at"] = now
                spot_data["updated_at"] = now
                new_spot = ParaglidingSpot(**spot_data)
                db.add(new_spot)
                added += 1

        except Exception as e:
            logger.error(f"Failed to sync spot {spot_data.get('id')}: {e}")
            continue

    # Commit all changes
    try:
        db.commit()
        logger.info(f"✓ Sync complete: {added} added, {updated} updated, {added + updated} total")

        return {
            "added": added,
            "updated": updated,
            "total": added + updated,
            "openaip_fetched": len(openaip_spots),
            "pgs_fetched": len(pgs_spots),
            "merged_total": len(all_spots),
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Database commit failed: {e}")
        return {"added": 0, "updated": 0, "total": 0, "error": str(e)}
