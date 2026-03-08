"""
Multi-Source Emagram Screenshot Scraper
Captures emagram images from Meteo-Parapente, TopMeteo, and Windy
"""

import asyncio
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Cache directory for temporary screenshots
EMAGRAM_CACHE_DIR = Path("/tmp/emagram_cache")
EMAGRAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)


async def screenshot_meteo_parapente(
    latitude: float,
    longitude: float,
    spot_name: str,
    timeout: int = 20000
) -> Dict[str, Any]:
    """
    Screenshot emagram from Meteo-Parapente
    URL: https://meteo-parapente.com/#/sounding/{lat}/{lon}
    
    Returns:
        {
            "success": True/False,
            "source": "meteo-parapente",
            "image_path": "/tmp/emagram_cache/...",
            "external_url": "https://...",
            "timestamp": "...",
            "error": "..." (if failed)
        }
    """
    url = f"https://meteo-parapente.com/#/sounding/{latitude}/{longitude}"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{spot_name.replace(' ', '_')}_meteo-parapente_{timestamp}.png"
    image_path = EMAGRAM_CACHE_DIR / filename
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1400, "height": 900})
            
            logger.info(f"📸 Meteo-Parapente: Loading {url}")
            await page.goto(url, wait_until="networkidle", timeout=timeout)
            
            # Wait for emagram to render (Meteo-Parapente uses canvas/SVG)
            await page.wait_for_timeout(6000)
            
            # Try to find emagram container, fallback to full page
            try:
                # Look for common emagram containers
                emagram_selector = "canvas, svg, .emagram, .sounding-chart"
                await page.wait_for_selector(emagram_selector, timeout=5000)
            except PlaywrightTimeout:
                logger.warning("Emagram container not found, taking full screenshot")
            
            await page.screenshot(path=str(image_path), full_page=False)
            logger.info(f"✅ Meteo-Parapente screenshot saved: {image_path}")
            
            await browser.close()
        
        return {
            "success": True,
            "source": "meteo-parapente",
            "image_path": str(image_path),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"❌ Meteo-Parapente screenshot failed: {e}")
        return {
            "success": False,
            "source": "meteo-parapente",
            "error": str(e),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }


async def screenshot_topmeteo(
    latitude: float,
    longitude: float,
    spot_name: str,
    timeout: int = 20000
) -> Dict[str, Any]:
    """
    Screenshot emagram from TopMeteo
    URL: https://www.topmeteo.eu/fr/emagramme/{lat}/{lon}
    """
    url = f"https://www.topmeteo.eu/fr/emagramme/{latitude}/{longitude}"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{spot_name.replace(' ', '_')}_topmeteo_{timestamp}.png"
    image_path = EMAGRAM_CACHE_DIR / filename
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1400, "height": 900})
            
            logger.info(f"📸 TopMeteo: Loading {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            
            # TopMeteo shows emagram quickly
            await page.wait_for_timeout(4000)
            
            await page.screenshot(path=str(image_path), full_page=False)
            logger.info(f"✅ TopMeteo screenshot saved: {image_path}")
            
            await browser.close()
        
        return {
            "success": True,
            "source": "topmeteo",
            "image_path": str(image_path),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"❌ TopMeteo screenshot failed: {e}")
        return {
            "success": False,
            "source": "topmeteo",
            "error": str(e),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }


async def screenshot_windy(
    latitude: float,
    longitude: float,
    spot_name: str,
    timeout: int = 25000
) -> Dict[str, Any]:
    """
    Screenshot sounding from Windy
    URL: https://www.windy.com/fr/{lat}/{lon}?temp,{lat},{lon},8
    
    Note: Windy requires clicking on map point to open sounding panel
    """
    # Windy URL format with temp layer
    url = f"https://www.windy.com/fr/{latitude}/{longitude}?temp,{latitude},{longitude},8"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{spot_name.replace(' ', '_')}_windy_{timestamp}.png"
    image_path = EMAGRAM_CACHE_DIR / filename
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1600, "height": 1000})
            
            logger.info(f"📸 Windy: Loading {url}")
            await page.goto(url, wait_until="networkidle", timeout=timeout)
            
            # Wait for Windy to load
            await page.wait_for_timeout(5000)
            
            # Try to click on sounding tab/button if visible
            try:
                # Look for sounding button (text may vary by language)
                sounding_button = page.locator("text=/sounding/i, text=/sondage/i")
                if await sounding_button.count() > 0:
                    await sounding_button.first.click(timeout=3000)
                    await page.wait_for_timeout(2000)
                    logger.info("Clicked Windy sounding button")
            except Exception as e:
                logger.warning(f"Could not click sounding button: {e}")
            
            await page.screenshot(path=str(image_path), full_page=False)
            logger.info(f"✅ Windy screenshot saved: {image_path}")
            
            await browser.close()
        
        return {
            "success": True,
            "source": "windy",
            "image_path": str(image_path),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"❌ Windy screenshot failed: {e}")
        return {
            "success": False,
            "source": "windy",
            "error": str(e),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }


async def fetch_all_emagram_screenshots(
    spot_id: str,
    latitude: float,
    longitude: float,
    spot_name: str
) -> Dict[str, Any]:
    """
    Fetch emagram screenshots from all 3 sources in parallel
    
    Args:
        spot_id: Site ID (e.g., "arguel")
        latitude: Spot coordinates
        longitude: Spot coordinates
        spot_name: Display name
    
    Returns:
        {
            "success": True/False,
            "spot_id": "arguel",
            "spot_name": "Arguel",
            "screenshots": [
                {"source": "meteo-parapente", "success": True, "image_path": "...", ...},
                {"source": "topmeteo", "success": True, "image_path": "...", ...},
                {"source": "windy", "success": False, "error": "...", ...}
            ],
            "sources_successful": 2,
            "sources_total": 3,
            "timestamp": "2024-03-07T20:00:00"
        }
    """
    
    logger.info(f"🎬 Starting screenshot fetch for {spot_name} ({spot_id})")
    logger.info(f"   Coordinates: {latitude}, {longitude}")
    
    # Fetch 2 sources in parallel (TopMeteo removed - doesn't work anymore)
    tasks = [
        screenshot_meteo_parapente(latitude, longitude, spot_name),
        screenshot_windy(latitude, longitude, spot_name),
    ]
    
    screenshots = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle exceptions
    processed_screenshots = []
    for result in screenshots:
        if isinstance(result, Exception):
            processed_screenshots.append({
                "success": False,
                "error": str(result),
                "timestamp": datetime.now().isoformat()
            })
        else:
            processed_screenshots.append(result)
    
    # Count successes
    success_count = sum(1 for s in processed_screenshots if s.get("success"))
    
    logger.info(f"✅ Screenshot fetch complete: {success_count}/2 successful")
    
    return {
        "success": success_count > 0,  # At least one must succeed
        "spot_id": spot_id,
        "spot_name": spot_name,
        "latitude": latitude,
        "longitude": longitude,
        "screenshots": processed_screenshots,
        "sources_successful": success_count,
        "sources_total": 2,
        "timestamp": datetime.now().isoformat()
    }


def cleanup_old_screenshots(max_age_hours: int = 3):
    """
    Delete screenshot images older than max_age_hours
    Called by background task scheduler
    """
    from datetime import timedelta
    
    cutoff = datetime.now() - timedelta(hours=max_age_hours)
    deleted = 0
    
    for file_path in EMAGRAM_CACHE_DIR.glob("*.png"):
        try:
            file_age = datetime.fromtimestamp(file_path.stat().st_mtime)
            if file_age < cutoff:
                file_path.unlink()
                deleted += 1
        except Exception as e:
            logger.warning(f"Failed to delete {file_path}: {e}")
    
    if deleted > 0:
        logger.info(f"🗑️ Cleaned up {deleted} old emagram screenshots")
    
    return deleted
