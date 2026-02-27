"""Meteoblue scraper using Playwright with improved error handling"""

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from datetime import datetime
from typing import Dict, List, Any


async def fetch_meteoblue(lat: float, lon: float, days: int = 2) -> Dict[str, Any]:
    """
    Scrape Meteoblue using Playwright for hourly table data
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        days: Number of forecast days (not used by Meteoblue URL, but kept for API consistency)
    
    Returns:
        Dict with success status, data, source, and timestamp
    """
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Meteoblue URL format
            url = f"https://www.meteoblue.com/en/weather/forecast/hourly/{lat}N{lon}E"
            
            await page.goto(url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            
            # Extract table data using JavaScript
            table_data = await page.evaluate("""
                () => {
                    const rows = document.querySelectorAll('table tbody tr');
                    const data = [];
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length > 0) {
                            data.push({
                                time: cells[0]?.textContent?.trim() || '',
                                temp: cells[1]?.textContent?.trim() || '',
                                wind: cells[2]?.textContent?.trim() || '',
                                gust: cells[3]?.textContent?.trim() || '',
                                precip: cells[4]?.textContent?.trim() || '',
                            });
                        }
                    });
                    return data;
                }
            """)
            
            await browser.close()
            
            return {
                "success": bool(table_data),
                "source": "meteoblue",
                "data": table_data,
                "timestamp": datetime.now().isoformat()
            }
    except PlaywrightTimeout as e:
        return {
            "success": False,
            "source": "meteoblue",
            "error": f"Timeout: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "source": "meteoblue",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


async def extract_hourly_forecast(data: Dict[str, Any], day_index: int = 0) -> List[Dict[str, Any]]:
    """
    Parse Meteoblue hourly data
    
    Args:
        data: Raw response from fetch_meteoblue
        day_index: Which day to extract (0=today, 1=tomorrow)
    
    Returns:
        List of parsed hourly forecasts
    """
    if not data.get("success"):
        return []
    
    forecasts = []
    for item in data.get("data", []):
        try:
            # Parse time string (e.g., "14:00")
            time_str = item.get("time", "0:00")
            hour = int(time_str.split(":")[0]) if ":" in time_str else 0
            
            # Parse temperature (remove °C symbol)
            temp_str = item.get("temp", "0").replace("°C", "").replace("°", "").strip()
            temperature = float(temp_str) if temp_str else 0.0
            
            # Parse wind speed (remove km/h)
            wind_str = item.get("wind", "0").replace("km/h", "").strip()
            wind_speed = float(wind_str) if wind_str else 0.0
            
            # Parse gust
            gust_str = item.get("gust", "0").replace("km/h", "").strip()
            wind_gust = float(gust_str) if gust_str else 0.0
            
            # Parse precipitation
            precip_str = item.get("precip", "0").replace("mm", "").strip()
            precipitation = float(precip_str) if precip_str else 0.0
            
            forecasts.append({
                "time": time_str,
                "hour": hour,
                "temperature": temperature,
                "wind_speed": wind_speed,
                "wind_gust": wind_gust,
                "precipitation": precipitation,
            })
        except (ValueError, AttributeError):
            continue
    
    return forecasts
