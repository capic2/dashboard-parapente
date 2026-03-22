"""
Site updater module

Links existing user sites to external paragliding spots database
for enhanced data (precise GPS, elevation, ratings, etc.)
"""

import logging

from sqlalchemy.orm import Session

from models import ParaglidingSpot, Site

from .distance import haversine_distance

logger = logging.getLogger(__name__)

# Distance threshold for considering a match (in km)
MATCH_DISTANCE_THRESHOLD_KM = 0.5  # 500 meters


def link_sites_to_spots(db: Session) -> dict:
    """
    Link existing Site records to ParaglidingSpot records.

    For each Site:
    - Search for nearby ParaglidingSpots within 500m
    - Link to closest match if found
    - Optionally update Site coordinates to precise GPS

    Args:
        db: Database session

    Returns:
        Dictionary with linking statistics
    """
    logger.info("Starting site linking process...")

    # Get all user sites
    sites = db.query(Site).all()

    stats = {"total_sites": len(sites), "linked": 0, "not_found": 0, "updated_coords": 0}

    for site in sites:
        if not site.latitude or not site.longitude:
            logger.warning(f"Site {site.name} has no coordinates, skipping")
            stats["not_found"] += 1
            continue

        # Find nearby spots (within 500m)
        candidates = (
            db.query(ParaglidingSpot)
            .filter(
                ParaglidingSpot.latitude.between(
                    site.latitude - 0.01, site.latitude + 0.01  # ~1km buffer
                ),
                ParaglidingSpot.longitude.between(site.longitude - 0.01, site.longitude + 0.01),
            )
            .all()
        )

        if not candidates:
            logger.info(f"No nearby spots found for {site.name}")
            stats["not_found"] += 1
            continue

        # Calculate distances and find closest match
        closest_spot = None
        closest_distance = float("inf")

        for spot in candidates:
            distance = haversine_distance(
                site.latitude, site.longitude, spot.latitude, spot.longitude
            )

            if distance < closest_distance:
                closest_distance = distance
                closest_spot = spot

        # Link if within threshold
        if closest_spot and closest_distance <= MATCH_DISTANCE_THRESHOLD_KM:
            logger.info(
                f"Linking {site.name} to {closest_spot.name} "
                f"(distance: {closest_distance:.2f}km)"
            )

            site.linked_spot_id = closest_spot.id
            site.site_type = "official_spot"

            # Update coordinates to precise GPS if different
            if (
                abs(site.latitude - closest_spot.latitude) > 0.0001
                or abs(site.longitude - closest_spot.longitude) > 0.0001
            ):

                # Store old coords in description
                old_coords = f"Original coords: {site.latitude}, {site.longitude}"
                if site.description:
                    if "Original coords:" not in site.description:
                        site.description = f"{site.description}\n\n{old_coords}"
                else:
                    site.description = old_coords

                # Update to precise coords
                site.latitude = closest_spot.latitude
                site.longitude = closest_spot.longitude

                # Update elevation if available
                if closest_spot.elevation_m:
                    site.elevation_m = closest_spot.elevation_m

                stats["updated_coords"] += 1
                logger.info(f"Updated {site.name} coordinates to precise GPS")

            stats["linked"] += 1
        else:
            logger.warning(
                f"No close match for {site.name} " f"(closest: {closest_distance:.2f}km away)"
            )
            stats["not_found"] += 1

    # Commit changes
    try:
        db.commit()
        logger.info(f"✓ Linking complete: {stats}")
        return stats
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to commit site links: {e}")
        stats["error"] = str(e)
        return stats


def unlink_all_sites(db: Session) -> dict:
    """
    Remove all site-to-spot links (for testing/reset).

    Args:
        db: Database session

    Returns:
        Statistics about unlinked sites
    """
    logger.info("Unlinking all sites from spots...")

    sites = db.query(Site).filter(Site.linked_spot_id.isnot(None)).all()

    for site in sites:
        site.linked_spot_id = None
        site.site_type = "user_spot"

    try:
        db.commit()
        count = len(sites)
        logger.info(f"✓ Unlinked {count} sites")
        return {"unlinked": count}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to unlink sites: {e}")
        return {"unlinked": 0, "error": str(e)}
