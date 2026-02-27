"""Meteoblue scraper using Playwright"""

from playwright.async_api import async_playwright
from datetime import datetime
from typing import Dict, List

async def fetch_meteoblue(lat: float, lon: float, days: int = 2) -> Dict:
    """Scrape Meteoblue using Playwright for hourly table"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            url = f"https://www.meteoblue.com/en/weather/forecast/hourly/{lat}N+{lon}E"
            await page.goto(url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=10000)
            
            # Extract table data
            table_data = await page.evaluate("""
                () => {
                    const rows = document.querySelectorAll('table tbody tr');
                    const data = [];
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length > 0) {
                            data.push({
                                time: cells[0]?.textContent?.trim(),
                                temp: cells[1]?.textContent?.trim(),
                                wind: cells[2]?.textContent?.trim(),
                                gust: cells[3]?.textContent?.trim(),
                                precip: cells[4]?.textContent?.trim(),
                            });
                        }
                    });
                    return data;
                }
            """)
            
            await browser.close()
            
            return {
                "success": True,
                "source": "meteoblue",
                "data": table_data,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "success": False,
            "source": "meteoblue",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

async def extract_hourly_forecast(data: Dict, day_index: int = 0) -> List[Dict]:
    """Parse Meteoblue hourly data"""
    if not data.get("success"):
        return []
    
    forecasts = []
    for item in data.get("data", []):
        try:
            forecasts.append({
                "time": item.get("time", ""),
                "hour": int(item.get("time", "0:00").split(":")[0]),
                "temperature": float(item.get("temp", "0").replace("°C", "").strip()),
                "wind_speed": float(item.get("wind", "0").replace("km/h", "").strip()),
                "wind_gust": float(item.get("gust", "0").replace("km/h", "").strip()),
                "precipitation": float(item.get("precip", "0").replace("mm", "").strip()),
            })
        except (ValueError, AttributeError):
            continue
    
    return forecasts
