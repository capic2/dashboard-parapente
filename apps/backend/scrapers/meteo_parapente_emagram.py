"""
Scraper for Meteo-Parapente emagram images
Uses existing emagram service designed for paragliding
"""

from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright


async def fetch_meteo_parapente_emagram(
    latitude: float, longitude: float, spot_name: str, output_dir: str = "/tmp/emagram_images"
) -> dict[str, Any]:
    """
    Fetch emagram screenshot from Meteo-Parapente

    Args:
        latitude: Spot latitude
        longitude: Spot longitude
        spot_name: Name of the spot (for filename)
        output_dir: Where to save screenshot

    Returns:
        Dict with success status and image path
    """

    # Meteo-Parapente sounding URL
    url = f"https://meteo-parapente.com/#/sounding/{latitude}/{longitude}"

    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"emagram_{spot_name.replace(' ', '_')}_{timestamp}.png"
    image_path = f"{output_dir}/{filename}"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1200, "height": 800})

            # Navigate to meteo-parapente
            await page.goto(url, wait_until="networkidle", timeout=30000)

            # Wait for emagram to load
            # Meteo-Parapente uses canvas or SVG for emagram
            await page.wait_for_timeout(5000)  # Wait 5s for rendering

            # Take screenshot of emagram section
            # TODO: Find exact selector for emagram container
            await page.screenshot(path=image_path, full_page=False)

            await browser.close()

        return {
            "success": True,
            "source": "meteo-parapente",
            "image_path": image_path,
            "url": url,
            "spot_name": spot_name,
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        return {
            "success": False,
            "source": "meteo-parapente",
            "error": f"Failed to fetch emagram: {str(e)}",
            "url": url,
        }


async def fetch_topmeteo_emagram(
    latitude: float, longitude: float, spot_name: str, output_dir: str = "/tmp/emagram_images"
) -> dict[str, Any]:
    """
    Fetch emagram from TopMeteo

    TopMeteo provides ready-made emagram images for any location in Europe
    """

    url = f"https://www.topmeteo.eu/fr/emagramme/{latitude}/{longitude}"

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"emagram_{spot_name.replace(' ', '_')}_{timestamp}.png"
    image_path = f"{output_dir}/{filename}"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1400, "height": 900})

            await page.goto(url, wait_until="domcontentloaded", timeout=30000)

            # TopMeteo shows emagram immediately
            await page.wait_for_timeout(3000)

            # Screenshot the emagram
            await page.screenshot(path=image_path)

            await browser.close()

        return {
            "success": True,
            "source": "topmeteo",
            "image_path": image_path,
            "url": url,
            "spot_name": spot_name,
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        return {
            "success": False,
            "source": "topmeteo",
            "error": f"Failed to fetch emagram: {str(e)}",
            "url": url,
        }


async def fetch_windy_sounding(
    latitude: float, longitude: float, spot_name: str, output_dir: str = "/tmp/emagram_images"
) -> dict[str, Any]:
    """
    Fetch sounding from Windy

    Windy has a sounding layer with atmospheric profiles
    """

    # Windy doesn't have a direct sounding URL, need to:
    # 1. Open Windy
    # 2. Click on location
    # 3. Open "Sounding" or "Temp" detail

    url = f"https://www.windy.com/fr/{latitude}/{longitude}?temp,{latitude},{longitude},8"

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"sounding_{spot_name.replace(' ', '_')}_{timestamp}.png"
    image_path = f"{output_dir}/{filename}"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1600, "height": 1000})

            await page.goto(url, wait_until="networkidle", timeout=30000)

            # Click on map to open detail panel
            await page.click("css=canvas", position={"x": 800, "y": 500})

            # Wait for detail panel
            await page.wait_for_timeout(3000)

            # Look for "Sounding" button/tab
            try:
                await page.click("text=Sounding", timeout=5000)
                await page.wait_for_timeout(2000)
            except Exception:
                # Sounding tab might not be available for this location
                # This is expected behavior, not an error
                pass
            
            await page.screenshot(path=image_path)

            await browser.close()

        return {
            "success": True,
            "source": "windy",
            "image_path": image_path,
            "url": url,
            "spot_name": spot_name,
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        return {
            "success": False,
            "source": "windy",
            "error": f"Failed to fetch sounding: {str(e)}",
            "url": url,
        }


# Fallback strategy: try multiple sources
async def fetch_emagram_with_fallback(
    latitude: float, longitude: float, spot_name: str, output_dir: str = "/tmp/emagram_images"
) -> dict[str, Any]:
    """
    Try to fetch emagram from multiple sources with fallback

    Priority:
    1. Meteo-Parapente (best for paragliding)
    2. TopMeteo (reliable, Europe-wide)
    3. Windy (as last resort)
    """

    # Try Meteo-Parapente first
    result = await fetch_meteo_parapente_emagram(latitude, longitude, spot_name, output_dir)
    if result.get("success"):
        return result

    # Fallback to TopMeteo
    result = await fetch_topmeteo_emagram(latitude, longitude, spot_name, output_dir)
    if result.get("success"):
        return result

    # Last resort: Windy
    result = await fetch_windy_sounding(latitude, longitude, spot_name, output_dir)
    if result.get("success"):
        return result

    # All failed
    return {
        "success": False,
        "error": "All emagram sources failed",
        "sources_tried": ["meteo-parapente", "topmeteo", "windy"],
    }
