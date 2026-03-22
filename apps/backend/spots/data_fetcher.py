"""
Data fetcher for paragliding spots from external sources

Fetches and merges data from:
- OpenAIP: Free hang gliding database (JSON format)
- ParaglidingSpots.com: Community database (JavaScript format)
"""

import hashlib
import json
import logging
import re
from datetime import datetime

import requests
from sqlalchemy.orm import Session

from .distance import haversine_distance

logger = logging.getLogger(__name__)

# Data source URLs
OPENAIP_FRANCE_URL = (
    "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/fr_hgl.json"
)
PARAGLIDINGSPOTS_URL = "https://paraglidingspots.com/online/js/pgs.siteslong.js?key=2602"

# Duplicate detection threshold (meters)
DUPLICATE_DISTANCE_THRESHOLD_M = 100


def fetch_openaip_data() -> list[dict]:
    """
    Fetch paragliding spots from OpenAIP France dataset.

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
    logger.info(f"Fetching OpenAIP data from {OPENAIP_FRANCE_URL}")

    try:
        response = requests.get(OPENAIP_FRANCE_URL, timeout=30)
        response.raise_for_status()
        data = response.json()

        if not isinstance(data, list):
            logger.error("OpenAIP response is not a list")
            return []

        spots = []
        for item in data:
            try:
                # Parse OpenAIP format
                # Type: 0=takeoff, 1=landing
                spot_type_code = item.get("type", 0)
                spot_type = "landing" if spot_type_code == 1 else "takeoff"

                # Coordinates: nested in geometry.coordinates [longitude, latitude]
                geometry = item.get("geometry", {})
                coords = geometry.get("coordinates", [])
                if len(coords) < 2:
                    logger.warning(f"Skipping spot with invalid coordinates: {item.get('name')}")
                    continue

                longitude, latitude = coords[0], coords[1]

                # Elevation: nested in elevation.value
                elevation = item.get("elevation", {})
                elevation_m = elevation.get("value") if isinstance(elevation, dict) else None

                # Generate unique ID from OpenAIP ID (use full ID, not truncated)
                openaip_id = item.get("_id", "")
                spot_id = (
                    f"openaip_{openaip_id}"
                    if openaip_id
                    else f"openaip_{hashlib.md5(item.get('name', '').encode()).hexdigest()}"
                )

                spot = {
                    "id": spot_id,
                    "name": item.get("name", "").upper(),
                    "type": spot_type,
                    "latitude": float(latitude),
                    "longitude": float(longitude),
                    "elevation_m": elevation_m,
                    "orientation": None,  # OpenAIP doesn't include orientation
                    "rating": None,  # OpenAIP doesn't include rating
                    "country": item.get("country", "FR"),
                    "source": "openaip",
                    "openaip_id": openaip_id,
                    "paraglidingspots_id": None,
                    "raw_metadata": json.dumps(item),
                }

                spots.append(spot)

            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Failed to parse OpenAIP spot: {e}")
                continue

        logger.info(f"✓ Fetched {len(spots)} spots from OpenAIP")
        return spots

    except requests.RequestException as e:
        logger.error(f"Failed to fetch OpenAIP data: {e}")
        return []


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
    openaip_spots = fetch_openaip_data()
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
