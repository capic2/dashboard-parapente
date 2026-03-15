"""
Weather Data Pipeline - Aggregation & Normalization
Fetches from all scrapers and provides normalized, consensus forecasts
"""

import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
import statistics
import math
import time
import logging
from contextlib import contextmanager

# Import all scrapers
from scrapers.open_meteo import fetch_open_meteo, extract_hourly_forecast as extract_om
from scrapers.weatherapi import fetch_weatherapi, extract_hourly_forecast as extract_wa
from scrapers.meteociel import fetch_meteociel, extract_hourly_forecast as extract_mc
from scrapers.meteoblue import fetch_meteoblue, extract_hourly_forecast as extract_mb
from scrapers.meteo_parapente import fetch_meteo_parapente, extract_hourly_forecast as extract_mp
from para_index import calculate_para_index

logger = logging.getLogger(__name__)


# ============================================================================
# INSTRUMENTATION HELPERS FOR WEATHER SOURCE STATISTICS
# ============================================================================

@contextmanager
def instrument_source_call(source_name: str, db_session):
    """
    Context manager to instrument weather source calls
    
    Usage:
        with instrument_source_call("open-meteo", db):
            result = await fetch_open_meteo(...)
    
    Automatically logs:
    - Response time
    - Success/failure
    - Error message if applicable
    - Updates counters in weather_source_config table
    """
    start_time = time.time()
    source = None
    success = False
    error_message = None
    
    try:
        # Import here to avoid circular dependencies
        from models import WeatherSourceConfig
        
        # Get source config
        source = db_session.query(WeatherSourceConfig).filter(
            WeatherSourceConfig.source_name == source_name
        ).first()
        
        yield  # Execute wrapped code
        
        success = True  # If no exception, it's a success
        
    except Exception as e:
        success = False
        error_message = str(e)
        raise  # Re-raise to not hide the error
        
    finally:
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Update stats in DB
        if source:
            if success:
                source.success_count += 1
                source.total_response_time_ms += response_time_ms
                source.last_success_at = datetime.utcnow()
            else:
                source.error_count += 1
                source.last_error_at = datetime.utcnow()
                source.last_error_message = error_message[:500] if error_message else None  # Limit length
            
            source.updated_at = datetime.utcnow()
            
            try:
                db_session.commit()
            except Exception as commit_error:
                logger.error(f"Failed to update source stats for '{source_name}': {commit_error}")
                db_session.rollback()


async def fetch_from_enabled_sources(
    lat: float,
    lon: float,
    day_index: int = 0,
    site_name: Optional[str] = None,
    elevation_m: Optional[int] = None
) -> Dict[str, Any]:
    """
    Fetch weather only from enabled sources in DB
    
    This replaces the hardcoded logic in aggregate_forecasts()
    Sources are filtered by is_enabled=True from weather_source_config table
    """
    from database import SessionLocal
    from models import WeatherSourceConfig
    
    db = SessionLocal()
    
    try:
        # Get enabled sources
        enabled_sources = db.query(WeatherSourceConfig).filter(
            WeatherSourceConfig.is_enabled == True
        ).order_by(WeatherSourceConfig.priority.desc()).all()
        
        if not enabled_sources:
            logger.warning("No enabled weather sources found! Using fallback.")
            # Fallback: enable open-meteo by default
            fallback = db.query(WeatherSourceConfig).filter(
                WeatherSourceConfig.source_name == "open-meteo"
            ).first()
            if fallback:
                fallback.is_enabled = True
                db.commit()
                enabled_sources = [fallback]
        
        logger.info(f"Fetching weather from {len(enabled_sources)} enabled sources: "
                   f"{[s.source_name for s in enabled_sources]}")
        
        # Map sources to fetch functions
        fetch_map = {
            "open-meteo": fetch_open_meteo,
            "weatherapi": fetch_weatherapi,
            "meteo-parapente": fetch_meteo_parapente,
            "meteociel": fetch_meteociel,
            "meteoblue": fetch_meteoblue
        }
        
        # Create instrumented tasks
        async def instrumented_fetch(src_name, func):
            """Wrapper to instrument each fetch call"""
            result = None
            try:
                # Clean site name for scrapers (remove suffixes like "Test", "Nord", etc. for better matching)
                clean_site_name = site_name.split()[0] if site_name else site_name
                
                # Adapt arguments per source
                if src_name == "open-meteo":
                    result = await func(lat, lon, days=7)
                elif src_name == "meteo-parapente":
                    result = await func(lat, lon, site_name=site_name, elevation_m=elevation_m, days=1)
                elif src_name == "meteociel":
                    result = await func(lat, lon, site_name=clean_site_name)
                elif src_name == "meteoblue":
                    result = await func(lat, lon, city_name=site_name)
                else:
                    result = await func(lat, lon)
                
                # Update stats based on result
                from models import WeatherSourceConfig
                source = db.query(WeatherSourceConfig).filter(
                    WeatherSourceConfig.source_name == src_name
                ).first()
                
                if source and result:
                    if result.get("success"):
                        source.success_count += 1
                        source.last_success_at = datetime.utcnow()
                    else:
                        source.error_count += 1
                        source.last_error_at = datetime.utcnow()
                        source.last_error_message = result.get("error", "Unknown error")[:500]
                    
                    source.updated_at = datetime.utcnow()
                    db.commit()
                
                # CRITICAL FIX: Transform raw data to hourly format
                # Scrapers return {'success': True, 'data': {...}} 
                # but normalize_data() expects {'success': True, 'hourly': [...]}
                if result and result.get("success") and "data" in result:
                    # Extract hourly data for the requested day
                    if src_name == "open-meteo":
                        result["hourly"] = extract_om(result, day_index)
                    elif src_name == "weatherapi":
                        result["hourly"] = extract_wa(result, day_index)
                    elif src_name == "meteo-parapente":
                        result["hourly"] = extract_mp(result, day_index)
                    elif src_name == "meteociel":
                        result["hourly"] = extract_mc(result, day_index)
                    elif src_name == "meteoblue":
                        result["hourly"] = extract_mb(result, day_index)
                
                return result
                
            except Exception as e:
                logger.error(f"Error fetching from {src_name}: {e}")
                # Update error stats
                from models import WeatherSourceConfig
                source = db.query(WeatherSourceConfig).filter(
                    WeatherSourceConfig.source_name == src_name
                ).first()
                
                if source:
                    source.error_count += 1
                    source.last_error_at = datetime.utcnow()
                    source.last_error_message = str(e)[:500]
                    source.updated_at = datetime.utcnow()
                    db.commit()
                
                return {
                    "success": False,
                    "source": src_name,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
        
        # Create tasks
        tasks = []
        source_names = []
        
        for source in enabled_sources:
            fetch_func = fetch_map.get(source.source_name)
            if not fetch_func:
                logger.warning(f"No fetch function for source '{source.source_name}', skipping")
                continue
            
            tasks.append(instrumented_fetch(source.source_name, fetch_func))
            source_names.append(source.source_name)
        
        # Execute all fetches in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build aggregated response
        aggregated = {
            "timestamp": datetime.now().isoformat(),
            "day_index": day_index,
            "sources": {}
        }
        
        for i, result in enumerate(results):
            source_name = source_names[i]
            
            if isinstance(result, Exception):
                aggregated["sources"][source_name] = {
                    "success": False,
                    "error": str(result)
                }
            else:
                aggregated["sources"][source_name] = result
        
        return aggregated
        
    finally:
        db.close()


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
    
    UPDATED: Now uses weather_source_config table to filter enabled sources
    
    Args:
        lat: Latitude
        lon: Longitude
        day_index: 0=today, 1=tomorrow, etc.
        sources: DEPRECATED - Ignored. Enabled sources from DB are used instead.
        site_name: Site name (required for meteo_parapente)
        elevation_m: Site elevation in meters (required for meteo_parapente)
    
    Returns:
        Dict with aggregated raw data from all sources
    """
    # Warn if deprecated parameter is used
    if sources is not None:
        logger.warning("Parameter 'sources' is deprecated and ignored. Using enabled sources from database instead.")
    
    # Delegate to new instrumented function
    return await fetch_from_enabled_sources(
        lat=lat,
        lon=lon,
        day_index=day_index,
        site_name=site_name,
        elevation_m=elevation_m
    )
    
    # OLD CODE REMOVED - Now uses fetch_from_enabled_sources() which reads from DB
    # This ensures only enabled sources are queried and stats are automatically logged


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
    
    # Debug write to file
    with open("/tmp/extract_sunrise_sunset_debug.log", "a") as f:
        f.write(f"\n=== extract_sunrise_sunset START: day_index={day_index} ===\n")
        f.write(f"aggregated sources keys: {list(aggregated.get('sources', {}).keys())}\n")
        f.write(f"open_meteo_data keys: {list(open_meteo_data.keys())}\n")
        f.write(f"open_meteo success: {open_meteo_data.get('success')}\n")
    
    if not open_meteo_data.get("success"):
        with open("/tmp/extract_sunrise_sunset_debug.log", "a") as f:
            f.write(f"No successful open-meteo data\n")
        return None, None
    
    # Open-Meteo data is in the "data" field (not "raw")
    api_data = open_meteo_data.get("data", {})
    daily = api_data.get("daily", {})
    sunrises = daily.get("sunrise", [])
    sunsets = daily.get("sunset", [])
    
    with open("/tmp/extract_sunrise_sunset_debug.log", "a") as f:
        f.write(f"api_data keys: {list(api_data.keys())}\n")
        f.write(f"daily keys: {list(daily.keys())}\n")
        f.write(f"sunrises (len={len(sunrises)}): {sunrises[:2] if sunrises else 'EMPTY'}\n")
        f.write(f"sunsets (len={len(sunsets)}): {sunsets[:2] if sunsets else 'EMPTY'}\n")
    
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
    Complete pipeline: fetch -> normalize -> consensus (with Redis cache)
    
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
            # Only return cache if it has sunrise/sunset data
            if cached_result.get("sunrise") is not None:
                logger.info(f"✅ Cache HIT for forecast: {cache_key}")
                return cached_result
            else:
                # Stale cache without sunrise/sunset - invalidate it
                logger.warning(f"⚠️ Stale cache detected (missing sunrise/sunset) for {cache_key}, refetching...")
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
    print(f"DEBUG get_normalized_forecast: sunrise={sunrise}, sunset={sunset}")
    
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
