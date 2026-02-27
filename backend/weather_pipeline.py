"""
Weather Data Pipeline - Aggregation & Normalization
Fetches from all scrapers and provides normalized, consensus forecasts
"""

import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
import statistics

# Import all scrapers
from scrapers.open_meteo import fetch_open_meteo, extract_hourly_forecast as extract_om
from scrapers.weatherapi import fetch_weatherapi, extract_hourly_forecast as extract_wa
from scrapers.meteociel import fetch_meteociel
from scrapers.meteoblue import fetch_meteoblue


async def aggregate_forecasts(
    lat: float, 
    lon: float, 
    day_index: int = 0,
    sources: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Aggregate weather forecasts from all available sources
    
    Args:
        lat: Latitude
        lon: Longitude
        day_index: 0=today, 1=tomorrow, etc.
        sources: List of sources to use (default: all)
    
    Returns:
        Dict with aggregated raw data from all sources
    """
    # Default to all sources (skip meteo-parapente for now - needs spot names)
    if sources is None:
        sources = ["open-meteo", "weatherapi", "meteociel", "meteoblue"]
    
    # Fetch all data concurrently
    tasks = []
    source_map = {}
    
    if "open-meteo" in sources:
        tasks.append(fetch_open_meteo(lat, lon))
        source_map["open-meteo"] = len(tasks) - 1
    
    if "weatherapi" in sources:
        tasks.append(fetch_weatherapi(lat, lon))
        source_map["weatherapi"] = len(tasks) - 1
    
    if "meteociel" in sources:
        tasks.append(fetch_meteociel(lat, lon))
        source_map["meteociel"] = len(tasks) - 1
    
    if "meteoblue" in sources:
        tasks.append(fetch_meteoblue(lat, lon))
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
        elif source_name == "meteociel":
            # meteociel extractor is async
            from scrapers.meteociel import extract_hourly_forecast as extract_mc
            hourly = await extract_mc(result)
        elif source_name == "meteoblue":
            # meteoblue extractor is async and takes day_index
            from scrapers.meteoblue import extract_hourly_forecast as extract_mb
            hourly = await extract_mb(result, day_index)
        
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
            
            # Only flyable hours (11h-18h)
            if hour is None or hour < 11 or hour > 18:
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
            
            # Collect values (with None checks)
            if hour_data.get("temperature") is not None:
                normalized_hours[hour]["temperature"].append(hour_data["temperature"])
            
            if hour_data.get("wind_speed") is not None:
                normalized_hours[hour]["wind_speed"].append(hour_data["wind_speed"])
            
            if hour_data.get("wind_gust") is not None:
                normalized_hours[hour]["wind_gust"].append(hour_data["wind_gust"])
            
            if hour_data.get("wind_direction") is not None:
                normalized_hours[hour]["wind_direction"].append(hour_data["wind_direction"])
            
            if hour_data.get("precipitation") is not None:
                normalized_hours[hour]["precipitation"].append(hour_data["precipitation"])
            
            if hour_data.get("cloud_cover") is not None:
                normalized_hours[hour]["cloud_cover"].append(hour_data["cloud_cover"])
            
            if hour_data.get("cape") is not None:
                normalized_hours[hour]["cape"].append(hour_data["cape"])
            
            if hour_data.get("lifted_index") is not None:
                normalized_hours[hour]["lifted_index"].append(hour_data["lifted_index"])
    
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
        Consensus forecast with confidence scores
    """
    if not normalized.get("success"):
        return normalized
    
    consensus = []
    
    for hour_data in normalized.get("normalized", []):
        hour = hour_data["hour"]
        num_sources = len(hour_data["sources"])
        
        # Calculate averages and confidence
        def safe_avg(values):
            if not values:
                return None, 0
            avg = statistics.mean(values)
            # Confidence based on number of sources and variance
            if len(values) == 1:
                confidence = 0.5
            else:
                # Higher confidence with more sources and lower variance
                variance = statistics.variance(values) if len(values) > 1 else 0
                confidence = min(1.0, (len(values) / 5) * (1 - min(variance / 100, 0.5)))
            return avg, confidence
        
        temp_avg, temp_conf = safe_avg(hour_data["temperature"])
        wind_avg, wind_conf = safe_avg(hour_data["wind_speed"])
        gust_avg, gust_conf = safe_avg(hour_data["wind_gust"])
        dir_avg, dir_conf = safe_avg(hour_data["wind_direction"])
        precip_avg, precip_conf = safe_avg(hour_data["precipitation"])
        cloud_avg, cloud_conf = safe_avg(hour_data["cloud_cover"])
        cape_avg, cape_conf = safe_avg(hour_data["cape"])
        li_avg, li_conf = safe_avg(hour_data["lifted_index"])
        
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


async def get_normalized_forecast(
    lat: float,
    lon: float,
    day_index: int = 0
) -> Dict[str, Any]:
    """
    Complete pipeline: fetch → normalize → consensus
    
    Args:
        lat: Latitude
        lon: Longitude
        day_index: Day to forecast (0=today, 1=tomorrow)
    
    Returns:
        Normalized consensus forecast
    """
    # Step 1: Aggregate
    aggregated = await aggregate_forecasts(lat, lon, day_index)
    
    # Step 2: Normalize
    normalized = normalize_data(aggregated)
    
    # Step 3: Consensus
    consensus = calculate_consensus(normalized)
    
    return consensus
