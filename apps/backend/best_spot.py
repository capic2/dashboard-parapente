"""
Best Spot Calculator - Backend logic for determining the best flying spot

This module provides functions to:
1. Calculate the best spot based on Para-Index and wind conditions
2. Cache results in Redis for fast access
3. Integrate with the scheduler for automatic updates
"""

import logging
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from models import EmagramAnalysis as EmagramAnalysisModel
from models import Site, WeatherForecast

logger = logging.getLogger(__name__)


def _get_cache_functions():
    """Lazy import of cache module to handle missing Redis gracefully"""
    try:
        from cache import CACHE_TTL, get_cached, set_cached

        return get_cached, set_cached, CACHE_TTL
    except (ImportError, ModuleNotFoundError) as e:
        logger.warning(f"Redis not available, caching disabled: {e}")
        return None, None, None


# Wind direction mappings (8 cardinal directions)
WIND_DIRECTIONS = {
    "N": 0,
    "NNE": 22.5,
    "NE": 45,
    "ENE": 67.5,
    "E": 90,
    "ESE": 112.5,
    "SE": 135,
    "SSE": 157.5,
    "S": 180,
    "SSW": 202.5,
    "SW": 225,
    "WSW": 247.5,
    "W": 270,
    "WNW": 292.5,
    "NW": 315,
    "NNW": 337.5,
}


def parse_wind_direction(wind_dir: str) -> float | None:
    """Convert wind direction string to degrees (0-360)"""
    if not wind_dir:
        return None
    wind_dir = wind_dir.strip().upper()
    return WIND_DIRECTIONS.get(wind_dir)


def calculate_angle_difference(angle1: float, angle2: float) -> float:
    """Calculate smallest angle difference between two directions (0-180)"""
    diff = abs(angle1 - angle2)
    if diff > 180:
        diff = 360 - diff
    return diff


def get_wind_favorability(
    wind_direction: str | None, site_orientation: str | None, wind_speed: float | None
) -> str:
    """
    Determine wind favorability for a site

    Returns:
        - 'good': Wind aligned with site orientation (±45°)
        - 'moderate': Wind somewhat aligned (45-90°)
        - 'bad': Wind opposed or too strong/weak
    """
    if not wind_direction or not site_orientation or wind_speed is None:
        return "moderate"

    # Check wind speed limits
    if wind_speed < 5 or wind_speed > 30:
        return "bad"

    # Parse directions
    wind_deg = parse_wind_direction(wind_direction)
    site_deg = parse_wind_direction(site_orientation)

    if wind_deg is None or site_deg is None:
        return "moderate"

    # Calculate angle difference
    angle_diff = calculate_angle_difference(wind_deg, site_deg)

    # Determine favorability
    if angle_diff <= 45:
        return "good"
    elif angle_diff <= 90:
        return "moderate"
    else:
        return "bad"


def get_wind_score_multiplier(favorability: str) -> float:
    """Get score multiplier based on wind favorability"""
    multipliers = {"good": 1.0, "moderate": 0.7, "bad": 0.3}
    return multipliers.get(favorability, 0.7)


async def calculate_best_spot_from_cache(db: Session, day_index: int = 0) -> dict[str, Any] | None:
    """
    Calculate the best spot based on cached weather data (from Redis)

    This function reads weather data from Redis cache (populated by scheduler)
    and calculates which site has the best flying conditions.

    Algorithm:
    1. Get all sites from database
    2. For each site, fetch weather forecast from cache
    3. Calculate Para-Index from hourly data
    4. Calculate score = Para-Index × wind_multiplier
    5. Return the site with highest score

    Args:
        db: Database session
        day_index: Day index (0=today, 1=tomorrow, ..., 6=in 6 days)

    Returns:
        Dict with best spot info or None if no data available
    """
    import statistics

    from para_index import analyze_hourly_slots, calculate_para_index, get_best_slot
    from weather_pipeline import get_normalized_forecast

    logger.info(f"Calculating best spot from cached weather data for day {day_index}...")

    try:
        # Get all sites
        sites = db.query(Site).all()

        if not sites:
            logger.warning("No sites found in database")
            return None

        # Fetch weather for each site from cache
        scored_sites = []

        for site in sites:
            try:
                # Fetch forecast for the specified day from cache
                forecast = await get_normalized_forecast(
                    lat=site.latitude,
                    lon=site.longitude,
                    day_index=day_index,
                    site_name=site.name,
                    elevation_m=site.elevation_m,
                    db=db,
                )

                if not forecast.get("success"):
                    logger.warning(f"No cached forecast for {site.name}")
                    continue

                consensus_hours = forecast.get("consensus", [])
                if not consensus_hours:
                    continue

                # Filter to flyable hours (sunrise/sunset) for consistent para_index
                sunrise_time = forecast.get("sunrise")
                sunset_time = forecast.get("sunset")
                flyable_hours = consensus_hours
                if sunrise_time and sunset_time:
                    try:
                        sunrise_hour = int(sunrise_time.split(":")[0])
                        sunset_hour = int(sunset_time.split(":")[0])
                        flyable_hours = [
                            h
                            for h in consensus_hours
                            if sunrise_hour <= h.get("hour", 0) <= sunset_hour
                        ]
                    except (ValueError, IndexError, AttributeError):
                        pass
                if not flyable_hours:
                    continue

                # Calculate Para-Index on flyable hours only
                para_result = calculate_para_index(flyable_hours)
                para_index = para_result.get("para_index", 0)

                # Get current or average wind data
                # Use middle of day (12h) for wind analysis
                midday_hours = [h for h in consensus_hours if 10 <= h.get("hour", 0) <= 14]
                if midday_hours:
                    avg_wind_speed = sum(h.get("wind_speed", 0) for h in midday_hours) / len(
                        midday_hours
                    )
                    # Get most common wind direction
                    wind_dirs = [
                        h.get("wind_direction") for h in midday_hours if h.get("wind_direction")
                    ]
                    wind_direction = wind_dirs[0] if wind_dirs else None
                else:
                    avg_wind_speed = None
                    wind_direction = None

                # Convert wind direction from degrees to cardinal
                if wind_direction is not None:
                    wind_dir_str = degrees_to_cardinal(wind_direction)
                else:
                    wind_dir_str = None

                # Calculate wind favorability
                wind_favorability = get_wind_favorability(
                    wind_dir_str, site.orientation, avg_wind_speed
                )

                # Calculate final score
                wind_multiplier = get_wind_score_multiplier(wind_favorability)
                final_score = para_index * wind_multiplier

                # Calculate best flyable slot
                slots = analyze_hourly_slots(flyable_hours)
                best_slot = get_best_slot(slots)
                if not best_slot:
                    flyable_slot = None
                elif best_slot["start_hour"] == best_slot["end_hour"]:
                    flyable_slot = f"{best_slot['start_hour']}h"
                else:
                    flyable_slot = f"{best_slot['start_hour']}h-{best_slot['end_hour']}h"

                # Build enriched reason text
                metrics = para_result.get("metrics", {})
                parts = []

                if para_index >= 70:
                    parts.append(f"Excellentes conditions (Para-Index {para_index})")
                elif para_index >= 50:
                    parts.append(f"Bonnes conditions (Para-Index {para_index})")
                elif para_index >= 30:
                    parts.append(f"Conditions moyennes (Para-Index {para_index})")
                else:
                    parts.append(f"Conditions limites (Para-Index {para_index})")

                avg_temp = metrics.get("avg_temp_c")
                if avg_temp is not None:
                    parts.append(f"{avg_temp}°C")

                cloud_values = [
                    h.get("cloud_cover") for h in flyable_hours if h.get("cloud_cover") is not None
                ]
                if cloud_values:
                    avg_cloud = statistics.mean(cloud_values)
                    if avg_cloud < 30:
                        parts.append("ciel dégagé")
                    elif avg_cloud < 60:
                        parts.append(f"nuageux {int(avg_cloud)}%")
                    else:
                        parts.append(f"très couvert {int(avg_cloud)}%")

                max_gust = metrics.get("max_gust_kmh", 0)
                if max_gust and max_gust >= 20:
                    parts.append(f"rafales {int(max_gust)}km/h")

                avg_li = metrics.get("avg_lifted_index")
                if avg_li is not None and avg_li < -3:
                    parts.append("atmosphère instable")
                elif avg_li is not None and avg_li > 2:
                    parts.append("atmosphère stable")

                if wind_dir_str and avg_wind_speed:
                    if wind_favorability == "good":
                        parts.append(f"vent favorable {wind_dir_str} {int(avg_wind_speed)}km/h")
                    elif wind_favorability == "bad":
                        parts.append(f"vent défavorable {wind_dir_str} {int(avg_wind_speed)}km/h")

                reason = ", ".join(parts)

                scored_sites.append(
                    {
                        "site": {
                            "id": site.id,
                            "code": site.code,
                            "name": site.name,
                            "latitude": site.latitude,
                            "longitude": site.longitude,
                            "orientation": site.orientation,
                            "rating": site.rating,
                        },
                        "paraIndex": para_index,
                        "windDirection": wind_dir_str,
                        "windSpeed": avg_wind_speed,
                        "windFavorability": wind_favorability,
                        "score": final_score,
                        "flyableSlot": flyable_slot,
                        "reason": reason,
                        "verdict": para_result.get("verdict"),
                    }
                )

            except Exception as e:
                logger.warning(f"Error processing site {site.name}: {e}")
                continue

        if not scored_sites:
            logger.warning("No valid forecasts found for any site")
            return None

        # Sort by score (highest first)
        scored_sites.sort(key=lambda x: x["score"], reverse=True)
        best_site = scored_sites[0]

        # Prepend warning if score is too low (keep enriched reason)
        if best_site["score"] < 20:
            best_site["reason"] = f"⚠️ Conditions défavorables — {best_site['reason']}"

        # Fetch thermal ceiling from nearest emagram analysis for the winning site
        try:
            from spots.distance import haversine_distance

            target_date = date.today() + timedelta(days=day_index)
            window_start = datetime.combine(target_date, datetime.min.time()) - timedelta(hours=12)
            window_end = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=36)

            site_lat = best_site["site"].get("latitude")
            site_lon = best_site["site"].get("longitude")

            analyses = (
                db.query(EmagramAnalysisModel)
                .filter(
                    EmagramAnalysisModel.analysis_datetime >= window_start,
                    EmagramAnalysisModel.analysis_datetime <= window_end,
                    EmagramAnalysisModel.analysis_status == "completed",
                )
                .order_by(EmagramAnalysisModel.analysis_datetime.desc())
                .all()
            )

            # Pick the closest analysis within 200km of the winning site
            best_emagram = None
            if site_lat is not None and site_lon is not None:
                max_distance_km = 200
                best_dist = float("inf")
                for analysis in analyses:
                    if (
                        analysis.station_latitude is None
                        or analysis.station_longitude is None
                        or analysis.plafond_thermique_m is None
                    ):
                        continue
                    dist = haversine_distance(
                        site_lat,
                        site_lon,
                        analysis.station_latitude,
                        analysis.station_longitude,
                    )
                    if dist <= max_distance_km and dist < best_dist:
                        best_dist = dist
                        best_emagram = analysis

            thermal = best_emagram.plafond_thermique_m if best_emagram else None
            best_site["thermalCeiling"] = thermal
        except Exception as e:
            logger.warning(f"Could not fetch thermal ceiling: {e}")
            best_site["thermalCeiling"] = None

        logger.info(
            f"✅ Best spot: {best_site['site']['name']} (score: {best_site['score']:.1f}, Para-Index: {best_site['paraIndex']})"
        )

        return best_site

    except Exception as e:
        logger.error(f"Error calculating best spot: {e}", exc_info=True)
        return None


def degrees_to_cardinal(degrees: float) -> str:
    """Convert wind direction in degrees to cardinal direction"""
    dirs = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ]
    ix = round(degrees / (360.0 / len(dirs)))
    return dirs[ix % len(dirs)]


async def calculate_best_spot_from_db(db: Session, day_index: int = 0) -> dict[str, Any] | None:
    """
    Calculate the best spot based on database forecasts

    Algorithm:
    1. Get all sites with weather forecasts for the specified day
    2. For each site, calculate score = Para-Index × wind_multiplier
    3. Return the site with highest score

    Args:
        db: Database session
        day_index: Day index (0=today, 1=tomorrow, ..., 6=in 6 days)

    Returns:
        Dict with best spot info or None if no data available
    """
    forecast_date = date.today() + timedelta(days=day_index)

    logger.info(f"Calculating best spot for day {day_index} ({forecast_date})...")

    try:
        # Get all sites with forecasts for the given date
        sites_with_forecasts = (
            db.query(Site, WeatherForecast)
            .join(WeatherForecast, Site.id == WeatherForecast.site_id)
            .filter(WeatherForecast.forecast_date == forecast_date)
            .all()
        )

        if not sites_with_forecasts:
            logger.warning(f"No forecast data found for {forecast_date}")
            return None

        # Calculate scores for each site
        scored_sites = []

        for site, forecast in sites_with_forecasts:
            # Get para_index (base score)
            para_index = forecast.para_index or 0

            # Get wind data - we'll need to extract this from hourly data
            # For now, use average wind from forecast
            wind_speed = forecast.wind_avg_kmh

            # We need wind direction - let's get it from the first hour of consensus
            # This is a simplification; in production we'd want current hour's wind
            wind_direction = None  # TODO: Extract from hourly consensus

            # Calculate wind favorability
            wind_favorability = get_wind_favorability(wind_direction, site.orientation, wind_speed)

            # Calculate final score
            wind_multiplier = get_wind_score_multiplier(wind_favorability)
            final_score = para_index * wind_multiplier

            # Generate reason text
            if para_index >= 70:
                reason = f"Excellentes conditions (Para-Index {para_index})"
            elif para_index >= 50:
                reason = f"Bonnes conditions (Para-Index {para_index})"
            elif para_index >= 30:
                reason = f"Conditions moyennes (Para-Index {para_index})"
            else:
                reason = f"Conditions limites (Para-Index {para_index})"

            # Add wind info if available
            if wind_direction and wind_speed:
                if wind_favorability == "good":
                    reason += f", vent favorable {wind_direction} {int(wind_speed)}km/h"
                elif wind_favorability == "bad":
                    reason += f", vent défavorable {wind_direction} {int(wind_speed)}km/h"

            scored_sites.append(
                {
                    "site": {
                        "id": site.id,
                        "code": site.code,
                        "name": site.name,
                        "latitude": site.latitude,
                        "longitude": site.longitude,
                        "orientation": site.orientation,
                        "rating": site.rating,
                    },
                    "paraIndex": para_index,
                    "windDirection": wind_direction,
                    "windSpeed": wind_speed,
                    "windFavorability": wind_favorability,
                    "score": final_score,
                    "flyableSlot": None,
                    "thermalCeiling": None,
                    "reason": reason,
                    "verdict": forecast.verdict,
                }
            )

        # Sort by score (highest first)
        scored_sites.sort(key=lambda x: x["score"], reverse=True)

        # Get the best site
        best_site = scored_sites[0]

        # Prepend warning if score is too low (keep enriched reason)
        if best_site["score"] < 20:
            best_site["reason"] = f"⚠️ Conditions défavorables — {best_site['reason']}"

        logger.info(f"✅ Best spot: {best_site['site']['name']} (score: {best_site['score']:.1f})")

        return best_site

    except Exception as e:
        logger.error(f"Error calculating best spot: {e}", exc_info=True)
        return None


async def get_best_spot_cached(db: Session, day_index: int = 0) -> dict[str, Any] | None:
    """
    Get best spot from cache or calculate if not cached

    This function:
    1. Checks Redis cache first (if available)
    2. If not in cache or Redis unavailable, calculates from database
    3. Stores result in cache with TTL (if Redis available)

    Args:
        db: Database session
        day_index: Day index (0=today, 1=tomorrow, ..., 6=in 6 days)

    Returns:
        Best spot data or None
    """
    cache_key = f"best_spot:day_{day_index}"
    get_cached_func, set_cached_func, cache_ttl = _get_cache_functions()

    # If cache module is not available, just calculate directly
    if get_cached_func is None:
        logger.info(f"Redis not available, calculating best spot for day {day_index} directly...")
        return await calculate_best_spot_from_cache(db, day_index)

    try:
        # Try to get from cache
        cached_data = await get_cached_func(cache_key)

        if cached_data is not None:
            logger.info(f"✅ Best spot for day {day_index} retrieved from cache")
            return cached_data

        # Not in cache, calculate
        logger.info(f"Cache miss, calculating best spot for day {day_index}...")
        best_spot = await calculate_best_spot_from_cache(db, day_index)

        if best_spot and cache_ttl:
            ttl = cache_ttl.get("summary", 3600)  # 60 minutes
            await set_cached_func(cache_key, best_spot, ttl)
            logger.info(f"✅ Best spot for day {day_index} cached for {ttl}s")

        return best_spot

    except Exception as e:
        logger.error(f"Error in get_best_spot_cached for day {day_index}: {e}", exc_info=True)
        # Fallback: try to calculate without caching
        return await calculate_best_spot_from_cache(db, day_index)


async def refresh_best_spot_cache(db: Session):
    """
    Refresh the best spot cache for today only (called by scheduler)

    This should be called every hour when weather data is refreshed.
    Only day 0 (today) is pre-calculated and cached by the scheduler.
    Other days (1-6) are calculated on-demand when requested via the API.
    """
    logger.info("♻️ Refreshing best spot cache for today (day 0)...")

    get_cached_func, set_cached_func, cache_ttl = _get_cache_functions()

    try:
        # Calculate best spot for today only (day_index=0)
        best_spot = await calculate_best_spot_from_cache(db, day_index=0)

        if best_spot:
            # Store in cache if cache module is available
            if set_cached_func and cache_ttl:
                cache_key = "best_spot:day_0"
                ttl = cache_ttl.get("summary", 3600)

                await set_cached_func(cache_key, best_spot, ttl)
                logger.info(f"✅ Best spot cache refreshed for today: {best_spot['site']['name']}")
            else:
                logger.info(
                    f"✅ Best spot calculated for today (no cache): {best_spot['site']['name']}"
                )
        else:
            logger.warning("⚠️ No best spot calculated for today (no forecast data?)")

    except Exception as e:
        logger.error(f"Error refreshing best spot cache: {e}", exc_info=True)
