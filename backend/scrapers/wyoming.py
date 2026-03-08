"""
Wyoming University Upper Air Sounding scraper for radiosonde data
Fetches real atmospheric soundings (TEXT:LIST format) for thermal analysis
"""

import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import re
import math


# European radiosonde stations available on Wyoming (WMO codes)
# Note: French stations (07xxx) don't have data on Wyoming
# Using German stations which are closest to French paragliding spots
EUROPEAN_STATIONS = {
    # Germany - Stuttgart (closest to East France: Jura, Alps)
    "10739": {
        "name": "Stuttgart, Germany",
        "latitude": 48.83,
        "longitude": 9.20,
        "elevation_m": 314,
        "region": "Baden-Württemberg",
        "coverage": "East France (Jura, Vosges, French Alps)"
    },
    # Germany - Munich (good for French/Swiss Alps)
    "10868": {
        "name": "Munich, Germany", 
        "latitude": 48.25,
        "longitude": 11.55,
        "elevation_m": 515,
        "region": "Bavaria",
        "coverage": "French Alps, Switzerland"
    },
    # Germany - Meiningen (Central Germany, good for North-East France)
    "10548": {
        "name": "Meiningen, Germany",
        "latitude": 50.56,
        "longitude": 10.38,
        "elevation_m": 450,
        "region": "Thuringia", 
        "coverage": "North-East France, Luxembourg"
    },
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points on Earth using Haversine formula
    
    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates
    
    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth radius in km
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def find_closest_station(user_lat: float, user_lon: float) -> Dict[str, Any]:
    """
    Find the closest radiosonde station to user location
    
    Args:
        user_lat: User latitude
        user_lon: User longitude
    
    Returns:
        Dict with station code, name, and distance in km
    """
    closest_station = None
    min_distance = float('inf')
    
    for code, station in EUROPEAN_STATIONS.items():
        distance = haversine_distance(
            user_lat, user_lon,
            station['latitude'], station['longitude']
        )
        
        if distance < min_distance:
            min_distance = distance
            closest_station = {
                "code": code,
                "name": station['name'],
                "latitude": station['latitude'],
                "longitude": station['longitude'],
                "elevation_m": station['elevation_m'],
                "region": station['region'],
                "distance_km": round(distance, 1)
            }
    
    return closest_station


def parse_text_list_sounding(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Parse Wyoming TEXT:LIST format sounding data
    
    Format example:
    -----------------------------------------------------------------------------
       PRES   HGHT   TEMP   DWPT   RELH   MIXR   DRCT   SKNT   THTA   THTE   THTV
        hPa     m      C      C      %    g/kg    deg   knot     K      K      K 
    -----------------------------------------------------------------------------
     1000.0    103                                                               
      925.0    781   11.8    7.8     78   6.72    350      8  293.3  313.2  294.5
    
    Args:
        raw_text: Raw TEXT:LIST output from Wyoming
    
    Returns:
        Dict with parsed data or None if parsing fails
    """
    try:
        lines = raw_text.strip().split('\n')
        
        # Find data section (starts after header lines)
        data_start_idx = None
        for i, line in enumerate(lines):
            if 'PRES' in line and 'HGHT' in line and 'TEMP' in line:
                # Skip header line and unit line and separator
                data_start_idx = i + 3
                break
        
        if data_start_idx is None:
            return None
        
        # Parse sounding data
        pressure = []
        height = []
        temperature = []
        dewpoint = []
        wind_direction = []
        wind_speed_knots = []
        
        for line in lines[data_start_idx:]:
            line = line.strip()
            
            # Stop at end markers
            if not line or line.startswith('Station information') or line.startswith('</PRE>'):
                break
            
            # Parse data line
            parts = line.split()
            if len(parts) < 11:
                continue
            
            try:
                pres = float(parts[0])
                hght = float(parts[1]) if parts[1] != '' else None
                temp = float(parts[2]) if parts[2] != '' else None
                dwpt = float(parts[3]) if parts[3] != '' else None
                drct = float(parts[6]) if parts[6] != '' else None
                sknt = float(parts[7]) if parts[7] != '' else None
                
                pressure.append(pres)
                height.append(hght)
                temperature.append(temp)
                dewpoint.append(dwpt)
                wind_direction.append(drct)
                wind_speed_knots.append(sknt)
                
            except (ValueError, IndexError):
                continue
        
        if not pressure:
            return None
        
        return {
            "pressure_hpa": pressure,
            "height_m": height,
            "temperature_c": temperature,
            "dewpoint_c": dewpoint,
            "wind_direction_deg": wind_direction,
            "wind_speed_knots": wind_speed_knots,
            "levels": len(pressure)
        }
        
    except Exception as e:
        print(f"Error parsing sounding data: {e}")
        return None


async def fetch_wyoming_sounding(
    station_code: str,
    sounding_time: str = "12",
    date: Optional[datetime] = None,
    max_retries: int = 3,
    retry_delay: float = 2.0,
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Fetch radiosonde sounding from Wyoming University with retry logic
    
    Args:
        station_code: WMO station code (e.g., "07481" for Lyon)
        sounding_time: "00" for 00Z or "12" for 12Z (default: "12")
        date: Date for sounding (default: today)
        max_retries: Maximum number of retry attempts (default: 3)
        retry_delay: Delay between retries in seconds (default: 2.0)
        use_cache: Use Redis cache if available (default: True)
    
    Returns:
        Dict with success status, parsed data, and raw text
    """
    if date is None:
        date = datetime.utcnow()
    
    # Try cache first
    if use_cache:
        try:
            from cache_emagram.emagram_cache import get_cache
            cache = get_cache()
            
            cached_data = cache.get_sounding(station_code, sounding_time, date)
            if cached_data:
                cached_data['from_cache'] = True
                return cached_data
        except ImportError:
            pass  # Cache not available
        except Exception as e:
            print(f"Cache error: {e}")
    
    # Wyoming URL format
    base_url = "http://weather.uwyo.edu/cgi-bin/sounding"
    
    params = {
        "region": "europe",
        "TYPE": "TEXT:LIST",
        "YEAR": date.strftime("%Y"),
        "MONTH": date.strftime("%m"),
        "FROM": date.strftime("%d") + sounding_time,
        "TO": date.strftime("%d") + sounding_time,
        "STNM": station_code
    }
    
    last_error = None
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(base_url, params=params)
                response.raise_for_status()
                raw_text = response.text
            
            # Success - break retry loop
            break
            
        except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.ConnectError) as e:
            last_error = e
            
            if attempt < max_retries - 1:
                # Not last attempt, wait and retry
                import asyncio
                await asyncio.sleep(retry_delay * (attempt + 1))  # Exponential backoff
                continue
            else:
                # Last attempt failed
                if isinstance(e, httpx.HTTPStatusError):
                    return {
                        "success": False,
                        "source": "wyoming",
                        "error": f"HTTP {e.response.status_code} after {max_retries} retries: {str(e)}",
                        "station_code": station_code,
                        "sounding_time": sounding_time + "Z",
                        "timestamp": datetime.now().isoformat(),
                        "retries": max_retries
                    }
                elif isinstance(e, httpx.TimeoutException):
                    return {
                        "success": False,
                        "source": "wyoming",
                        "error": f"Timeout after {max_retries} retries (30s each)",
                        "station_code": station_code,
                        "sounding_time": sounding_time + "Z",
                        "timestamp": datetime.now().isoformat(),
                        "retries": max_retries
                    }
                else:
                    return {
                        "success": False,
                        "source": "wyoming",
                        "error": f"Connection error after {max_retries} retries: {str(e)}",
                        "station_code": station_code,
                        "sounding_time": sounding_time + "Z",
                        "timestamp": datetime.now().isoformat(),
                        "retries": max_retries
                    }
    
    # Check for "No valid sounding found" error
    if "Can't get" in raw_text or "No valid" in raw_text:
        return {
            "success": False,
            "source": "wyoming",
            "error": "No sounding data available for this date/time",
            "station_code": station_code,
            "sounding_time": sounding_time + "Z",
            "timestamp": datetime.now().isoformat(),
            "raw_text": raw_text[:500]  # Include preview for debugging
        }
    
    # Parse the sounding data
    parsed_data = parse_text_list_sounding(raw_text)
    
    if parsed_data is None:
        return {
            "success": False,
            "source": "wyoming",
            "error": "Failed to parse sounding data",
            "station_code": station_code,
            "sounding_time": sounding_time + "Z",
            "raw_text": raw_text[:500],  # First 500 chars for debugging
            "timestamp": datetime.now().isoformat()
        }
    
    station_info = FRENCH_STATIONS.get(station_code, {})
    
    result = {
        "success": True,
        "source": "wyoming",
        "station_code": station_code,
        "station_name": station_info.get("name", f"Station {station_code}"),
        "station_latitude": station_info.get("latitude"),
        "station_longitude": station_info.get("longitude"),
        "station_elevation_m": station_info.get("elevation_m"),
        "sounding_time": sounding_time + "Z",
        "sounding_date": date.strftime("%Y-%m-%d"),
        "data": parsed_data,
        "raw_text": raw_text,
        "timestamp": datetime.now().isoformat(),
        "from_cache": False
    }
    
    # Cache the result
    if use_cache and result["success"]:
        try:
            from cache_emagram.emagram_cache import get_cache
            cache = get_cache()
            cache.set_sounding(station_code, sounding_time, date, result)
        except Exception as e:
            print(f"Cache set error: {e}")
    
    return result


async def fetch_closest_sounding(
    user_lat: float,
    user_lon: float,
    sounding_time: str = "12",
    date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Fetch sounding from closest station to user location
    
    Args:
        user_lat: User latitude
        user_lon: User longitude
        sounding_time: "00" for 00Z or "12" for 12Z (default: "12")
        date: Date for sounding (default: today)
    
    Returns:
        Dict with success status, sounding data, and station info
    """
    # Find closest station
    closest = find_closest_station(user_lat, user_lon)
    
    # Fetch sounding for that station
    result = await fetch_wyoming_sounding(
        station_code=closest["code"],
        sounding_time=sounding_time,
        date=date
    )
    
    # Add distance info
    if result["success"]:
        result["distance_km"] = closest["distance_km"]
    
    return result
