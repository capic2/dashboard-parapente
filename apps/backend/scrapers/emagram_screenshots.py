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
    latitude: float, longitude: float, spot_name: str, timeout: int = 30000, day_index: int = 0
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
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{spot_name.replace(' ', '_')}_meteo-parapente_d{day_index}_{timestamp}.png"
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

            # Navigate to the correct day if day_index > 0
            if day_index > 0:
                logger.info(f"Navigating to day +{day_index} on Meteo-Parapente...")
                for _ in range(day_index):
                    next_day_selectors = [
                        "button.next-day",
                        "[data-action='next-day']",
                        ".day-nav-next",
                        "button:has-text('▶')",
                        "button:has-text('›')",
                        ".nav-next",
                    ]
                    clicked = False
                    for sel in next_day_selectors:
                        try:
                            el = page.locator(sel).first
                            if await el.count() > 0:
                                await el.click(timeout=2000)
                                await page.wait_for_timeout(1500)
                                clicked = True
                                logger.info(f"Clicked next-day button: {sel}")
                                break
                        except Exception:
                            continue
                    if not clicked:
                        raise RuntimeError(
                            f"Could not navigate Meteo-Parapente to day_index={day_index}"
                        )

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


async def screenshot_meteociel_emagram(
    latitude: float, longitude: float, spot_name: str, timeout: int = 25000, day_index: int = 0
) -> dict[str, Any]:
    """
    Screenshot emagram from Meteociel
    URL: https://www.meteociel.fr/modeles/sondage2.php?mode=0&lon={lon}&lat={lat}&ech=3&map=0

    mode=0 = emagram display, ech = forecast step in hours from model run
    """
    ech = 3 + (day_index * 24)
    url = f"https://www.meteociel.fr/modeles/sondage2.php?mode=0&lon={longitude}&lat={latitude}&ech={ech}&map=0"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{spot_name.replace(' ', '_')}_meteociel_d{day_index}_{timestamp}.png"
    image_path = EMAGRAM_CACHE_DIR / filename

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1600, "height": 1200})

            logger.info(f"Meteociel emagram: Loading {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)

            # Wait for emagram image to load
            await page.wait_for_timeout(5000)

            # Meteociel shows emagram as an image - try to screenshot just that
            try:
                emagram_img = page.locator("img[src*='sondage'], img[src*='emagram']").first
                if await emagram_img.count() > 0:
                    await emagram_img.screenshot(path=str(image_path))
                    logger.info("Captured emagram image directly")
                else:
                    await page.screenshot(path=str(image_path), full_page=False)
                    logger.warning("Emagram image not found, took full screenshot")
            except Exception as e:
                logger.warning(f"Could not find emagram element: {e}, taking full screenshot")
                await page.screenshot(path=str(image_path), full_page=False)

            logger.info(f"Meteociel emagram screenshot saved: {image_path}")
            await browser.close()

        return {
            "success": True,
            "source": "meteociel",
            "image_path": str(image_path),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"Meteociel emagram screenshot failed: {e}")
        return {
            "success": False,
            "source": "meteociel",
            "error": str(e),
            "external_url": url,
            "timestamp": datetime.now().isoformat(),
        }


async def fetch_all_emagram_screenshots(
    spot_id: str, latitude: float, longitude: float, spot_name: str, day_index: int = 0
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

    # Fetch sources in parallel
    tasks = [
        screenshot_meteo_parapente(latitude, longitude, spot_name, day_index=day_index),
        screenshot_meteociel_emagram(latitude, longitude, spot_name, day_index=day_index),
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
    total = len(processed_screenshots)

    logger.info(f"Screenshot fetch complete: {success_count}/{total} successful")

    return {
        "success": success_count > 0,  # At least one must succeed
        "spot_id": spot_id,
        "spot_name": spot_name,
        "latitude": latitude,
        "longitude": longitude,
        "screenshots": processed_screenshots,
        "sources_successful": success_count,
        "sources_total": total,
        "timestamp": datetime.now().isoformat(),
    }


def cleanup_old_screenshots(max_age_hours: int = 1, cache_dir: Path | None = None):
    """
    Delete screenshot images that are no longer needed.
    Protects screenshots referenced by the latest completed analysis per site.
    Files younger than max_age_hours are never deleted (race-condition guard).

    Args:
        max_age_hours: Minimum age (in hours) before a file can be deleted
        cache_dir: Override cache directory (for testing)
    """
    import json
    from datetime import timedelta

    from database import get_db_context
    from models import EmagramAnalysis

    target_dir = cache_dir or EMAGRAM_CACHE_DIR

    # Build set of protected file paths from latest analysis per site
    protected_paths: set[str] = set()
    try:
        with get_db_context() as db:
            from sqlalchemy import func

            latest_subq = (
                db.query(
                    EmagramAnalysis.station_code,
                    func.max(EmagramAnalysis.analysis_datetime).label("max_dt"),
                )
                .filter(EmagramAnalysis.analysis_status == "completed")
                .group_by(EmagramAnalysis.station_code)
                .subquery()
            )

            latest_analyses = (
                db.query(EmagramAnalysis)
                .join(
                    latest_subq,
                    (EmagramAnalysis.station_code == latest_subq.c.station_code)
                    & (EmagramAnalysis.analysis_datetime == latest_subq.c.max_dt),
                )
                .all()
            )

            for analysis in latest_analyses:
                if analysis.screenshot_paths:
                    try:
                        paths = json.loads(analysis.screenshot_paths)
                        protected_paths.update(paths.values())
                    except (json.JSONDecodeError, AttributeError):
                        pass
    except Exception as e:
        logger.warning(f"Could not query DB for protected paths, skipping cleanup: {e}")
        return 0

    # Delete unprotected old files
    cutoff = datetime.now() - timedelta(hours=max_age_hours)
    deleted = 0

    for file_path in target_dir.glob("*.png"):
        if str(file_path) in protected_paths:
            continue
        try:
            file_age = datetime.fromtimestamp(file_path.stat().st_mtime)
            if file_age < cutoff:
                file_path.unlink()
                deleted += 1
        except Exception as e:
            logger.warning(f"Failed to delete {file_path}: {e}")

    if deleted > 0:
        logger.info(
            f"🗑️ Cleaned up {deleted} old emagram screenshots ({len(protected_paths)} protected)"
        )

    return deleted
