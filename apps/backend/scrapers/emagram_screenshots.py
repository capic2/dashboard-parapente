"""
Multi-Source Emagram Screenshot Scraper
Captures emagram images from Meteo-Parapente, TopMeteo, and Windy
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# Cache directory for temporary screenshots
EMAGRAM_CACHE_DIR = Path("/tmp/emagram_cache")
EMAGRAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)


async def screenshot_meteo_parapente(
    latitude: float, longitude: float, spot_name: str, timeout: int = 30000
) -> dict[str, Any]:
    """
    Screenshot emagram from Meteo-Parapente
    URL: https://meteo-parapente.com/#/sounding/{lat}/{lon}

    Process:
    1. Load the sounding page
    2. Click on "Emagramme" tab
    3. Screenshot ONLY left panel (where emagram displays)

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
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            logger.info(f"📸 Meteo-Parapente: Loading {url}")
            await page.goto(url, wait_until="networkidle", timeout=timeout)

            # Wait for page to load
            await page.wait_for_timeout(3000)

            # Click on "Sounding" tab (meteo-parapente uses English)
            logger.info("Looking for Sounding tab...")
            emagram_tab_clicked = False
            try:
                # Try different possible selectors for the sounding/emagram tab
                tab_selectors = [
                    "text=Sounding",  # English (primary)
                    "text=sounding",
                    "text=Emagramme",  # French fallback
                    "text=Émagramme",
                    "[data-tab='sounding']",
                    "[data-tab='emagram']",
                    "button:has-text('Sounding')",
                    "a:has-text('Sounding')",
                ]

                for selector in tab_selectors:
                    try:
                        element = page.locator(selector).first
                        if await element.count() > 0:
                            await element.click(timeout=3000)
                            logger.info(f"✅ Clicked sounding tab: {selector}")
                            emagram_tab_clicked = True
                            break
                    except Exception:
                        continue

            except Exception as e:
                logger.warning(f"Could not click sounding tab: {e}")

            if not emagram_tab_clicked:
                logger.warning("Sounding tab not clicked, emagram may not be visible")

            # Wait for emagram to render
            await page.wait_for_timeout(5000)

            # Take screenshot of LEFT PANEL ONLY (clip to left side of screen)
            # Assume left panel is roughly 50% of screen width
            await page.screenshot(
                path=str(image_path),
                clip={"x": 0, "y": 0, "width": 960, "height": 1080},  # Left half
            )

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
    latitude: float, longitude: float, spot_name: str, timeout: int = 20000
) -> dict[str, Any]:
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


async def screenshot_meteociel_arome(
    latitude: float, longitude: float, spot_name: str, timeout: int = 25000
) -> dict[str, Any]:
    """
    Screenshot emagram from Meteociel - AROME model (French high-res)
    URL: https://www.meteociel.fr/modeles/sondage_arome.php?lat={lat}&lon={lon}

    AROME is the French high-resolution weather model (1.3km resolution)
    """
    url = f"https://www.meteociel.fr/modeles/sondage_arome.php?lat={latitude}&lon={longitude}"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{spot_name.replace(' ', '_')}_meteociel-arome_{timestamp}.png"
    image_path = EMAGRAM_CACHE_DIR / filename

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1600, "height": 1200})

            logger.info(f"📸 Meteociel AROME: Loading {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)

            # Wait for emagram image to load
            await page.wait_for_timeout(5000)

            # Meteociel shows emagram as an image - try to screenshot just that
            try:
                # Look for the emagram image
                emagram_img = page.locator("img[src*='sondage'], img[src*='emagram']").first
                if await emagram_img.count() > 0:
                    await emagram_img.screenshot(path=str(image_path))
                    logger.info("✅ Captured emagram image directly")
                else:
                    # Fallback: screenshot the main content area
                    await page.screenshot(path=str(image_path), full_page=False)
                    logger.warning("Emagram image not found, took full screenshot")
            except Exception as e:
                logger.warning(f"Could not find emagram element: {e}, taking full screenshot")
                await page.screenshot(path=str(image_path), full_page=False)

            logger.info(f"✅ Meteociel AROME screenshot saved: {image_path}")
            await browser.close()

        return {
            "success": True,
            "source": "meteociel-arome",
            "image_path": str(image_path),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"❌ Meteociel AROME screenshot failed: {e}")
        return {
            "success": False,
            "source": "meteociel-arome",
            "error": str(e),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }


async def screenshot_meteociel_gfs(
    latitude: float, longitude: float, spot_name: str, timeout: int = 25000
) -> dict[str, Any]:
    """
    Screenshot emagram from Meteociel - GFS model
    URL: https://www.meteociel.fr/modeles/gfse_sondage.php?lat={lat}&lon={lon}
    """
    url = f"https://www.meteociel.fr/modeles/gfse_sondage.php?lat={latitude}&lon={longitude}"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{spot_name.replace(' ', '_')}_meteociel-gfs_{timestamp}.png"
    image_path = EMAGRAM_CACHE_DIR / filename

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1600, "height": 1200})

            logger.info(f"📸 Meteociel GFS: Loading {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)

            # Wait for emagram image to load
            await page.wait_for_timeout(5000)

            # Try to screenshot just the emagram
            try:
                emagram_img = page.locator("img[src*='sondage'], img[src*='emagram']").first
                if await emagram_img.count() > 0:
                    await emagram_img.screenshot(path=str(image_path))
                    logger.info("✅ Captured emagram image directly")
                else:
                    await page.screenshot(path=str(image_path), full_page=False)
                    logger.warning("Emagram image not found, took full screenshot")
            except Exception as e:
                logger.warning(f"Could not find emagram element: {e}, taking full screenshot")
                await page.screenshot(path=str(image_path), full_page=False)

            logger.info(f"✅ Meteociel GFS screenshot saved: {image_path}")
            await browser.close()

        return {
            "success": True,
            "source": "meteociel-gfs",
            "image_path": str(image_path),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"❌ Meteociel GFS screenshot failed: {e}")
        return {
            "success": False,
            "source": "meteociel-gfs",
            "error": str(e),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }


async def fetch_all_emagram_screenshots(
    spot_id: str, latitude: float, longitude: float, spot_name: str
) -> dict[str, Any]:
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

    # Fetch 3 sources in parallel
    tasks = [
        screenshot_meteo_parapente(latitude, longitude, spot_name),
        screenshot_meteociel_arome(latitude, longitude, spot_name),
        screenshot_meteociel_gfs(latitude, longitude, spot_name),
    ]

    screenshots = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle exceptions
    processed_screenshots = []
    for result in screenshots:
        if isinstance(result, Exception):
            processed_screenshots.append(
                {"success": False, "error": str(result), "timestamp": datetime.now().isoformat()}
            )
        else:
            processed_screenshots.append(result)

    # Count successes
    success_count = sum(1 for s in processed_screenshots if s.get("success"))

    logger.info(f"✅ Screenshot fetch complete: {success_count}/3 successful")

    return {
        "success": success_count > 0,  # At least one must succeed
        "spot_id": spot_id,
        "spot_name": spot_name,
        "latitude": latitude,
        "longitude": longitude,
        "screenshots": processed_screenshots,
        "sources_successful": success_count,
        "sources_total": 3,
        "timestamp": datetime.now().isoformat(),
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
