"""
Weather Data Pipeline - Aggregation & Normalization
Fetches from all scrapers and provides normalized, consensus forecasts
"""

import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
import statistics
import math

# Import all scrapers
from scrapers.open_meteo import fetch_open_meteo, extract_hourly_forecast as extract_om
from scrapers.weatherapi import fetch_weatherapi, extract_hourly_forecast as extract_wa
from scrapers.meteociel import fetch_meteociel
from scrapers.meteoblue import fetch_meteoblue
from scrapers.meteo_parapente import fetch_meteo_parapente
from para_index import calculate_para_index


async def aggregate_forecasts(
    lat: float, 
    lon: float, 
    day_index: int = 0,
    sources: Optional[List[str]] = None,
    site_name: Optional[str] = None,
    elevation_m: Optional[int] = None
) -> Dict[str, Any]:
    """
    Aggregate weather forecasts from available sources
    
    Args:
        lat: Latitude
        lon: Longitude
        day_index: 0=today, 1=tomorrow, etc.
        sources: List of sources to use (default: reliable sources only)
                 NOTE: meteo_parapente, meteociel, meteoblue are disabled due to
                 website structure changes. See SCRAPER_STATUS.md for details.
        site_name: Site name (required for meteo_parapente)
        elevation_m: Site elevation in meters (required for meteo_parapente)
    
    Returns:
        Dict with aggregated raw data from all sources
    """
    # Default to sources that reliably return data
    # Active: ["open-meteo", "weatherapi", "meteo-parapente", "meteociel", "meteoblue"] - All working!
    if sources is None:
        sources = ["open-meteo", "weatherapi", "meteo-parapente", "meteociel", "meteoblue"]
    
    # Fetch all data concurrently
    tasks = []
    source_map = {}
    
    if "open-meteo" in sources:
        tasks.append(fetch_open_meteo(lat, lon, days=7))  # Fetch 7 days for sunrise/sunset
        source_map["open-meteo"] = len(tasks) - 1
    
    if "weatherapi" in sources:
        tasks.append(fetch_weatherapi(lat, lon))
        source_map["weatherapi"] = len(tasks) - 1
    
    if "meteo-parapente" in sources:
        tasks.append(fetch_meteo_parapente(
            lat, lon,
            site_name=site_name,
            elevation_m=elevation_m,
            days=1  # Un jour par appel (pour compatibilité avec day_index)
        ))
        source_map["meteo-parapente"] = len(tasks) - 1
    
    if "meteociel" in sources:
        tasks.append(fetch_meteociel(
            lat, lon,
            site_name=site_name
        ))
        source_map["meteociel"] = len(tasks) - 1
    
    if "meteoblue" in sources:
        tasks.append(fetch_meteoblue(lat, lon, city_name=site_name))
        source_map["meteoblue"] = len(tasks) - 1
    
    # Execute all fetches in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Parse results
    aggregated = {
        "timestamp": datetime.now().isoformat(),
        "day_index": day_index,
        "sources": {}
    }
    
    for source_name, idx in source_map.items():
        result = results[idx]
        
        # Handle exceptions
        if isinstance(result, Exception):
            aggregated["sources"][source_name] = {
                "success": False,
                "error": str(result)
            }
            continue
        
        # Extract hourly data for the specific day
        hourly = None
        if source_name == "open-meteo":
            hourly = extract_om(result, day_index)
        elif source_name == "weatherapi":
            hourly = extract_wa(result, day_index)
        elif source_name == "meteo-parapente":
            # meteo-parapente extractor
            from scrapers.meteo_parapente import extract_hourly_forecast as extract_mp
            hourly = extract_mp(result)
        elif source_name == "meteociel":
            # meteociel extractor
            from scrapers.meteociel import extract_hourly_forecast as extract_mc
            hourly = extract_mc(result, day_index)
        elif source_name == "meteoblue":
            # meteoblue extractor takes day_index
            from scrapers.meteoblue import extract_hourly_forecast as extract_mb
            hourly = extract_mb(result, day_index)
        
        aggregated["sources"][source_name] = {
            "success": result.get("success", False),
            "hourly": hourly,
            "raw": result
        }
    
    return aggregated


def normalize_data(aggregated: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize weather data from different sources to a standard format
    
    Args:
        aggregated: Output from aggregate_forecasts()
    
    Returns:
        Normalized hourly forecast with standardized field names
    """
    # Collect all hourly data
    all_hourly = []
    
    for source_name, source_data in aggregated.get("sources", {}).items():
        if not source_data.get("success"):
            continue
        
        hourly = source_data.get("hourly", [])
        if hourly:
            all_hourly.append({
                "source": source_name,
                "data": hourly
            })
    
    if not all_hourly:
        return {
            "success": False,
            "error": "No successful data from any source"
        }
    
    # Group by hour (11h-18h)
    normalized_hours = {}
    
    for source_info in all_hourly:
        source = source_info["source"]
        for hour_data in source_info["data"]:
            hour = hour_data.get("hour")
            
            # Include all available hours
            if hour is None:
                continue
            
            if hour not in normalized_hours:
                normalized_hours[hour] = {
                    "hour": hour,
                    "sources": [],
                    "temperature": [],
                    "wind_speed": [],
                    "wind_gust": [],
                    "wind_direction": [],
                    "precipitation": [],
                    "cloud_cover": [],
                    "cape": [],
                    "lifted_index": []
                }
            
            # Add source data
            normalized_hours[hour]["sources"].append(source)
            
            # Collect values - ALWAYS append (even None) to maintain alignment with sources list
            # This is critical for the mapping in calculate_consensus()
            normalized_hours[hour]["temperature"].append(hour_data.get("temperature"))
            normalized_hours[hour]["wind_speed"].append(hour_data.get("wind_speed"))
            normalized_hours[hour]["wind_gust"].append(hour_data.get("wind_gust"))
            normalized_hours[hour]["wind_direction"].append(hour_data.get("wind_direction"))
            normalized_hours[hour]["precipitation"].append(hour_data.get("precipitation"))
            normalized_hours[hour]["cloud_cover"].append(hour_data.get("cloud_cover"))
            normalized_hours[hour]["cape"].append(hour_data.get("cape"))
            normalized_hours[hour]["lifted_index"].append(hour_data.get("lifted_index"))
    
    return {
        "success": True,
        "normalized": sorted(normalized_hours.values(), key=lambda x: x["hour"])
    }


def calculate_consensus(normalized: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate consensus forecast by averaging values from multiple sources
    
    Args:
        normalized: Output from normalize_data()
    
    Returns:
        Consensus forecast with confidence scores and per-source data
    """
    if not normalized.get("success"):
        return normalized
    
    consensus = []
    
    for hour_data in normalized.get("normalized", []):
        hour = hour_data["hour"]
        num_sources = len(hour_data["sources"])
        sources_list = hour_data["sources"]
        
        # Calculate averages and confidence
        def safe_avg(values):
            # Filter out None values
            valid_values = [v for v in values if v is not None]
            
            if not valid_values:
                return None, 0
            
            avg = statistics.mean(valid_values)
            # Confidence based on number of sources and variance
            if len(valid_values) == 1:
                confidence = 0.5
            else:
                # Higher confidence with more sources and lower variance
                variance = statistics.variance(valid_values) if len(valid_values) > 1 else 0
                confidence = min(1.0, (len(valid_values) / 5) * (1 - min(variance / 100, 0.5)))
            return avg, confidence
        
        temp_avg, temp_conf = safe_avg(hour_data["temperature"])
        wind_avg, wind_conf = safe_avg(hour_data["wind_speed"])
        gust_avg, gust_conf = safe_avg(hour_data["wind_gust"])
        
        # Calculate wind direction using vector averaging (correct for circular data)
        # Cannot simply average degrees (e.g., avg of 350° and 10° should be 0°, not 180°)
        wind_direction_raw = hour_data["wind_direction"].copy() if hour_data["wind_direction"] else []
        valid_directions = [d for d in wind_direction_raw if d is not None]
        
        if valid_directions:
            # Convert to radians and calculate sin/cos components
            sin_sum = sum(math.sin(math.radians(d)) for d in valid_directions)
            cos_sum = sum(math.cos(math.radians(d)) for d in valid_directions)
            
            # Check if directions cancel out (e.g., E + W)
            magnitude = math.sqrt(sin_sum**2 + cos_sum**2)
            
            if magnitude < 0.1:  # Directions effectively cancel out
                dir_avg = None
                dir_conf = 0
            else:
                # Calculate mean direction using atan2
                dir_avg = math.degrees(math.atan2(sin_sum, cos_sum))
                
                # Normalize to 0-360
                dir_avg = (dir_avg + 360) % 360
                
                # Apply 180° flip to show where wind COMES FROM (not goes to)
                # Convention in paragliding: wind direction = origin of wind
                dir_avg = (dir_avg + 180) % 360
                
                # Calculate confidence based on number of sources and vector magnitude
                # magnitude close to 1.0 = all sources agree, close to 0 = sources disagree
                source_factor = len(valid_directions) / 5
                agreement_factor = magnitude / len(valid_directions)  # Normalize by count
                dir_conf = min(1.0, source_factor * agreement_factor)
        else:
            dir_avg = None
            dir_conf = 0
        
        precip_avg, precip_conf = safe_avg(hour_data["precipitation"])
        cloud_avg, cloud_conf = safe_avg(hour_data["cloud_cover"])
        cape_avg, cape_conf = safe_avg(hour_data["cape"])
        li_avg, li_conf = safe_avg(hour_data["lifted_index"])
        
        # Build per-source data mapping
        # Note: this requires we have the original aggregated data
        # For now, we'll preserve the per-source indices during normalization
        sources_data = {}
        
        # Build initial per-source structure for all known sources
        for source in ["open-meteo", "weatherapi", "meteo-parapente", "meteociel", "meteoblue"]:
            sources_data[source] = {
                "wind_speed": None,
                "temperature": None,
                "wind_gust": None,
                "wind_direction": None,
                "precipitation": None,
                "cloud_cover": None,
                "cape": None,
                "lifted_index": None
            }
        
        # Map values to sources (using index position)
        # The lists in hour_data are parallel - same index corresponds to same source order
        for i, source in enumerate(sources_list):
            if i < len(hour_data["temperature"]):
                sources_data[source]["temperature"] = round(hour_data["temperature"][i], 1) if hour_data["temperature"][i] is not None else None
            if i < len(hour_data["wind_speed"]):
                sources_data[source]["wind_speed"] = round(hour_data["wind_speed"][i], 1) if hour_data["wind_speed"][i] is not None else None
            if i < len(hour_data["wind_gust"]):
                sources_data[source]["wind_gust"] = round(hour_data["wind_gust"][i], 1) if hour_data["wind_gust"][i] is not None else None
            if i < len(hour_data["wind_direction"]):
                sources_data[source]["wind_direction"] = round(hour_data["wind_direction"][i], 1) if hour_data["wind_direction"][i] is not None else None
            if i < len(hour_data["precipitation"]):
                sources_data[source]["precipitation"] = round(hour_data["precipitation"][i], 2) if hour_data["precipitation"][i] is not None else None
            if i < len(hour_data["cloud_cover"]):
                sources_data[source]["cloud_cover"] = round(hour_data["cloud_cover"][i], 1) if hour_data["cloud_cover"][i] is not None else None
            if i < len(hour_data["cape"]):
                sources_data[source]["cape"] = round(hour_data["cape"][i], 1) if hour_data["cape"][i] is not None else None
            if i < len(hour_data["lifted_index"]):
                sources_data[source]["lifted_index"] = round(hour_data["lifted_index"][i], 1) if hour_data["lifted_index"][i] is not None else None
        
        consensus.append({
            "hour": hour,
            "num_sources": num_sources,
            "temperature": round(temp_avg, 1) if temp_avg else None,
            "temperature_confidence": round(temp_conf, 2),
            "wind_speed": round(wind_avg, 1) if wind_avg else None,
            "wind_confidence": round(wind_conf, 2),
            "wind_gust": round(gust_avg, 1) if gust_avg else None,
            "gust_confidence": round(gust_conf, 2),
            "wind_direction": round(dir_avg, 1) if dir_avg else None,
            "direction_confidence": round(dir_conf, 2),
            "precipitation": round(precip_avg, 2) if precip_avg else None,
            "precipitation_confidence": round(precip_conf, 2),
            "cloud_cover": round(cloud_avg, 1) if cloud_avg else None,
            "cloud_confidence": round(cloud_conf, 2),
            "cape": round(cape_avg, 1) if cape_avg else None,
            "cape_confidence": round(cape_conf, 2),
            "lifted_index": round(li_avg, 1) if li_avg else None,
            "li_confidence": round(li_conf, 2),
            "sources": sources_data
        })
    
    return {
        "success": True,
        "consensus": consensus,
        "total_sources": len(set(
            source 
            for hour in normalized.get("normalized", []) 
            for source in hour.get("sources", [])
        ))
    }


def extract_sunrise_sunset(aggregated: Dict[str, Any], day_index: int) -> tuple:
    """
    Extract sunrise and sunset times from Open-Meteo data
    
    Args:
        aggregated: Output from aggregate_forecasts()
        day_index: Which day to extract (0=today, 1=tomorrow)
    
    Returns:
        Tuple of (sunrise_HH:MM, sunset_HH:MM) strings, or (None, None)
    """
    open_meteo_data = aggregated.get("sources", {}).get("open-meteo", {})
    
    if not open_meteo_data.get("success"):
        return None, None
    
    raw_wrapper = open_meteo_data.get("raw", {})
    # The raw data is wrapped in {"success": True, "source": "open-meteo", "data": {...}, "timestamp": ...}
    api_data = raw_wrapper.get("data", {})
    daily = api_data.get("daily", {})
    sunrises = daily.get("sunrise", [])
    sunsets = daily.get("sunset", [])
    
    if day_index >= len(sunrises) or day_index >= len(sunsets):
        return None, None
    
    try:
        # Parse ISO format datetime strings (e.g., "2026-03-01T07:15")
        sunrise_str = sunrises[day_index]
        sunset_str = sunsets[day_index]
        
        # Extract HH:MM from ISO format
        sunrise_time = sunrise_str.split("T")[1][:5] if "T" in sunrise_str else None
        sunset_time = sunset_str.split("T")[1][:5] if "T" in sunset_str else None
        
        return sunrise_time, sunset_time
    except (IndexError, AttributeError, TypeError):
        return None, None


async def get_normalized_forecast(
    lat: float,
    lon: float,
    day_index: int = 0,
    sources: Optional[List[str]] = None,
    site_name: Optional[str] = None,
    elevation_m: Optional[int] = None
) -> Dict[str, Any]:
    """
    Complete pipeline: fetch → normalize → consensus (with Redis cache)
    
    Args:
        lat: Latitude
        lon: Longitude
        day_index: Day to forecast (0=today, 1=tomorrow)
        sources: List of sources to use (default: all active sources)
        site_name: Site name (required for meteo_parapente)
        elevation_m: Site elevation in meters (required for meteo_parapente)
    
    Returns:
        Normalized consensus forecast with sunrise/sunset times
    """
    import logging
    from cache import get_cached, set_cached, CACHE_TTL, generate_cache_key
    
    logger = logging.getLogger(__name__)
    
    # Generate cache key based on location and day
    cache_key = generate_cache_key(
        "forecast",
        lat=round(lat, 4),
        lon=round(lon, 4),
        day_index=day_index
    )
    
    # Try cache first
    try:
        cached_result = await get_cached(cache_key)
        if cached_result is not None:
            logger.info(f"✅ Cache HIT for forecast: {cache_key}")
            return cached_result
    except Exception as e:
        logger.warning(f"Cache get error: {e}, falling back to live fetch")
    
    logger.info(f"❌ Cache MISS for forecast: {cache_key}, fetching live...")
    
    # Step 1: Aggregate
    aggregated = await aggregate_forecasts(
        lat, lon, day_index,
        sources=sources,
        site_name=site_name,
        elevation_m=elevation_m
    )
    
    # Step 2: Normalize
    normalized = normalize_data(aggregated)
    
    # Step 3: Consensus
    consensus = calculate_consensus(normalized)
    
    # Step 4: Extract sunrise/sunset
    sunrise, sunset = extract_sunrise_sunset(aggregated, day_index)
    
    # Add sunrise/sunset to response
    result = consensus.copy()
    result["sunrise"] = sunrise
    result["sunset"] = sunset
    
    # Cache result
    try:
        await set_cached(cache_key, result, CACHE_TTL["forecast"])
        logger.info(f"💾 Cached forecast: {cache_key}")
    except Exception as e:
        logger.warning(f"Cache set error: {e}, continuing without cache")
    
    return result


async def get_daily_aggregate(
    lat: float,
    lon: float,
    day_index: int,
    min_wind: float,
    max_wind: float,
    optimal_directions: str,
    sources: Optional[List[str]] = None,
    site_name: Optional[str] = None,
    elevation_m: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Get daily aggregate data (SIMPLIFIED - reuses get_normalized_forecast).
    
    This function extracts daily summary from the full forecast:
    - Calls get_normalized_forecast (which already works)
    - Extracts daily min/max temps and avg wind from consensus
    - Calculates simplified para_index from daily averages
    - Returns lightweight summary for 7-day cards
    
    Args:
        lat: Latitude
        lon: Longitude
        day_index: Day to forecast (0=today, 1=tomorrow, etc.)
        min_wind: Minimum acceptable wind speed (m/s)
        max_wind: Maximum acceptable wind speed (m/s)
        optimal_directions: Optimal wind directions (not used in simplified version)
        sources: List of sources to use (default: all active)
        site_name: Site name (for meteo_parapente)
        elevation_m: Site elevation (for meteo_parapente)
    
    Returns:
        Dict with daily summary or None if failed
    """
    # Reuse get_normalized_forecast (already working and tested)
    forecast_result = await get_normalized_forecast(
        lat, lon, day_index,
        sources=sources,
        site_name=site_name,
        elevation_m=elevation_m
    )
    
    if not forecast_result.get("success"):
        return None
    
    consensus = forecast_result.get("consensus", [])
    if not consensus:
        return None
    
    # Calculate target date
    target_date = (datetime.now() + timedelta(days=day_index)).strftime("%Y-%m-%d")
    
    # Filter to flyable hours BEFORE calculating para_index (same as /weather endpoint)
    # This ensures consistency between daily-summary cards and hourly view
    sunrise_time = forecast_result.get("sunrise")
    sunset_time = forecast_result.get("sunset")
    flyable_consensus = consensus
    
    if sunrise_time and sunset_time:
        try:
            sunrise_hour = int(sunrise_time.split(':')[0])
            sunset_hour = int(sunset_time.split(':')[0])
            flyable_consensus = [h for h in consensus if sunrise_hour <= h.get('hour', 0) <= sunset_hour]
        except (ValueError, IndexError, AttributeError):
            pass  # Keep all hours if parsing fails
    
    if not flyable_consensus:
        return None
    
    # Extract daily aggregates from flyable hours only
    temps = [h.get("temperature") for h in flyable_consensus if h.get("temperature") is not None]
    winds = [h.get("wind_speed") for h in flyable_consensus if h.get("wind_speed") is not None]
    precips = [h.get("precipitation") for h in flyable_consensus if h.get("precipitation") is not None]
    
    if not temps or not winds:
        return None
    
    temp_min = round(min(temps))
    temp_max = round(max(temps))
    wind_avg = round(sum(winds) / len(winds), 1)
    precip_total = round(sum(precips), 1) if precips else 0.0
    
    # Use the SAME para_index calculation as /weather endpoint for consistency
    # Calculate on flyable hours only (same filtering as /weather)
    para_result = calculate_para_index(flyable_consensus)
    
    para_index = para_result["para_index"]
    verdict = para_result["verdict"]
    emoji = para_result["emoji"]
    
    return {
        "date": target_date,
        "para_index": para_index,
        "verdict": verdict,
        "emoji": emoji,
        "temp_min": temp_min,
        "temp_max": temp_max,
        "wind_avg": wind_avg,
        "precip_total": precip_total,
    }


def calculate_daily_para_index(
    wind_avg: float,
    precip_total: float,
    min_wind: float,
    max_wind: float
) -> int:
    """
    Calculate simplified para_index from daily averages.
    
    This is a simplified version that works with daily aggregates
    instead of hourly consensus data.
    
    Args:
        wind_avg: Average wind speed for the day (km/h)
        precip_total: Total precipitation for the day (mm)
        min_wind: Minimum acceptable wind (m/s) - convert to km/h
        max_wind: Maximum acceptable wind (m/s) - convert to km/h
    
    Returns:
        Para-flying index (0-100)
    """
    score = 50  # Base score
    
    # Convert min/max wind from m/s to km/h
    min_wind_kmh = min_wind * 3.6
    max_wind_kmh = max_wind * 3.6
    
    # Wind scoring (wider range since it's an average)
    optimal_min = min_wind_kmh * 0.8  # 20% tolerance below
    optimal_max = max_wind_kmh * 1.2  # 20% tolerance above
    
    if optimal_min <= wind_avg <= optimal_max:
        score += 30  # Good wind conditions
    elif wind_avg < optimal_min:
        # Too light
        deficit = (optimal_min - wind_avg) / optimal_min
        score -= int(deficit * 30)
    else:
        # Too strong
        excess = (wind_avg - optimal_max) / optimal_max
        score -= int(excess * 40)
    
    # Precipitation penalty
    if precip_total > 5:
        score -= 40  # Heavy rain
    elif precip_total > 2:
        score -= 30  # Moderate rain
    elif precip_total > 0.5:
        score -= 15  # Light rain
    
    return max(0, min(100, score))
