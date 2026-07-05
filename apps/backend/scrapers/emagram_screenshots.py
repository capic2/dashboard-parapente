"""
Multi-Source Emagram Screenshot Scraper
Captures emagram images from Meteo-Parapente, TopMeteo, and Windy
"""

import asyncio
import base64
import logging
import os
from contextlib import suppress
from datetime import datetime
from datetime import timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# Cache directory for temporary screenshots
EMAGRAM_CACHE_DIR = Path(os.getenv("BACKEND_EMAGRAM_CACHE_DIR", "/tmp/emagram_cache"))
EMAGRAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
METEO_PARAPENTE_SCREENSHOT_TIMEOUT_SECONDS = 35
METEOCIEL_SCREENSHOT_TIMEOUT_SECONDS = 30
OPEN_METEO_EMAGRAM_TIMEOUT_SECONDS = 35


def _meteo_parapente_day_labels(day_index: int) -> list[str]:
    target_date = datetime.now() + timedelta(days=day_index)
    day = target_date.day
    month = target_date.month
    return [
        target_date.strftime("%Y-%m-%d"),
        target_date.strftime("%d/%m"),
        f"{day}/{month}",
        f"{day:02d}/{month:02d}",
    ]


async def _click_first_available(page: Any, selectors: list[str], timeout: int) -> str | None:
    for selector in selectors:
        try:
            element = page.locator(selector).first
            if await element.count() > 0:
                await element.click(timeout=timeout)
                return selector
        except Exception:
            continue
    return None


async def _capture_page_png(
    page: Any, image_path: Path, clip: dict[str, float] | None = None
) -> None:
    params: dict[str, Any] = {"format": "png", "captureBeyondViewport": False}
    if clip:
        params["clip"] = {
            "x": clip["x"],
            "y": clip["y"],
            "width": clip["width"],
            "height": clip["height"],
            "scale": 1,
        }

    try:
        cdp = await page.context.new_cdp_session(page)
        result = await cdp.send("Page.captureScreenshot", params)
        image_path.write_bytes(base64.b64decode(result["data"]))
        return
    except Exception as cdp_error:
        logger.warning("CDP screenshot failed, using Playwright screenshot: %s", cdp_error)

    screenshot_kwargs: dict[str, Any] = {"path": str(image_path), "timeout": 8000}
    if clip:
        screenshot_kwargs["clip"] = clip
    else:
        screenshot_kwargs["full_page"] = False
    await page.screenshot(**screenshot_kwargs)


def _write_image_atomically(image_path: Path, content: bytes) -> None:
    if not content:
        raise RuntimeError("Downloaded image is empty")

    image_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = image_path.with_suffix(f"{image_path.suffix}.tmp")
    tmp_path.write_bytes(content)
    if tmp_path.stat().st_size == 0:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError("Downloaded image was written as an empty file")
    tmp_path.replace(image_path)


async def screenshot_meteo_parapente(
    latitude: float,
    longitude: float,
    spot_name: str,
    timeout: int = 30000,
    day_index: int = 0,
    hour: int | None = None,
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
    hour_suffix = f"_h{hour}" if hour is not None else ""
    filename = (
        f"{spot_name.replace(' ', '_')}_meteo-parapente_d{day_index}{hour_suffix}_{timestamp}.png"
    )
    image_path = EMAGRAM_CACHE_DIR / filename

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})

            logger.info(f"📸 Meteo-Parapente: Loading {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception as e:
                logger.warning("Meteo-Parapente network did not become idle, continuing: %s", e)

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

                clicked_selector = await _click_first_available(page, tab_selectors, timeout=3000)
                if clicked_selector:
                    logger.info(f"✅ Clicked sounding tab: {clicked_selector}")
                    emagram_tab_clicked = True

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
                        "[aria-label*='Next']",
                        "[aria-label*='next']",
                        "[aria-label*='suivant']",
                        "[title*='Next']",
                        "[title*='Suivant']",
                        "button:has-text('▶')",
                        "button:has-text('›')",
                        "button:has-text('>')",
                        "a:has-text('›')",
                        "a:has-text('>')",
                        ".nav-next",
                    ]
                    clicked_selector = await _click_first_available(
                        page, next_day_selectors, timeout=2000
                    )
                    clicked = clicked_selector is not None
                    if clicked_selector:
                        await page.wait_for_timeout(1500)
                        logger.info(f"Clicked next-day button: {clicked_selector}")

                    if not clicked:
                        day_selectors = []
                        for label in _meteo_parapente_day_labels(day_index):
                            day_selectors.extend(
                                [
                                    f"button:has-text('{label}')",
                                    f"a:has-text('{label}')",
                                    f"[role='button']:has-text('{label}')",
                                ]
                            )
                        clicked_selector = await _click_first_available(
                            page, day_selectors, timeout=2000
                        )
                        clicked = clicked_selector is not None
                        if clicked_selector:
                            await page.wait_for_timeout(1500)
                            logger.info(f"Clicked target-day selector: {clicked_selector}")

                    if not clicked:
                        try:
                            await page.keyboard.press("ArrowRight")
                            await page.wait_for_timeout(1500)
                            clicked = True
                            logger.info("Navigated to next day with ArrowRight fallback")
                        except Exception as e:
                            logger.warning(f"ArrowRight day navigation fallback failed: {e}")

                    if not clicked:
                        raise RuntimeError(
                            f"Could not navigate Meteo-Parapente to day_index={day_index}"
                        )

            # Navigate to the correct hour if specified
            hour_navigated = hour is None
            if hour is not None:
                logger.info(f"Navigating to hour {hour}h on Meteo-Parapente...")
                hour_navigated = False
                try:
                    # Strategy 1: Try clicking hour buttons/labels
                    hour_selectors = [
                        f"[data-hour='{hour}']",
                        f"button:has-text('{hour}h')",
                        f"button:has-text('{hour}:00')",
                        f".hour-label:has-text('{hour}')",
                    ]
                    clicked_selector = await _click_first_available(
                        page, hour_selectors, timeout=2000
                    )
                    if clicked_selector:
                        hour_navigated = True
                        logger.info(f"Clicked hour selector: {clicked_selector}")

                    # Strategy 2: Try to set a range slider via JS
                    if not hour_navigated:
                        slider_selectors = [
                            "input[type='range']",
                            ".time-slider input",
                            ".slider input",
                        ]
                        for sel in slider_selectors:
                            try:
                                slider = page.locator(sel).first
                                if await slider.count() > 0:
                                    await slider.evaluate(
                                        f"el => {{ el.value = {hour}; el.dispatchEvent(new Event('input', {{bubbles: true}})); el.dispatchEvent(new Event('change', {{bubbles: true}})); }}"
                                    )
                                    hour_navigated = True
                                    logger.info(f"Set hour via slider: {sel}")
                                    break
                            except Exception:
                                continue

                    if not hour_navigated:
                        raise RuntimeError(
                            f"Could not navigate Meteo-Parapente to requested hour {hour}"
                        )
                except Exception as e:
                    raise RuntimeError(f"Hour navigation failed: {e}") from e

            # Wait for emagram to render
            await page.wait_for_timeout(5000)

            # Take screenshot of LEFT PANEL ONLY (clip to left side of screen)
            # Assume left panel is roughly 50% of screen width
            await _capture_page_png(
                page,
                image_path,
                clip={"x": 0, "y": 0, "width": 960, "height": 1080},  # Left half
            )

            logger.info(f"✅ Meteo-Parapente screenshot saved: {image_path}")
            await browser.close()

        return {
            "success": True,
            "source": "meteo-parapente",
            "image_path": str(image_path),
            "external_url": url,
            "requested_hour": hour,
            "hour_confirmed": hour is None or hour_navigated,
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
    latitude: float,
    longitude: float,
    spot_name: str,
    timeout: int = 25000,
    day_index: int = 0,
    hour: int | None = None,
) -> dict[str, Any]:
    """
    Screenshot emagram from Meteociel
    URL: https://www.meteociel.fr/modeles/sondage2.php?mode=0&lon={lon}&lat={lat}&ech=3&map=0

    mode=0 = emagram display, ech = forecast step in hours from model run
    """
    if hour is not None:
        ech = hour + (day_index * 24)
    else:
        ech = 3 + (day_index * 24)
    url = f"https://www.meteociel.fr/modeles/sondage2.php?mode=0&lon={longitude}&lat={latitude}&ech={ech}&map=0"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    hour_suffix = f"_h{hour}" if hour is not None else ""
    filename = f"{spot_name.replace(' ', '_')}_meteociel_d{day_index}{hour_suffix}_{timestamp}.png"
    image_path = EMAGRAM_CACHE_DIR / filename

    try:
        logger.info(f"Meteociel emagram: Loading {url}")
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout / 1000) as client:
            response = await client.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            image_src = None
            for img in soup.find_all("img"):
                src = str(img.get("src") or "")
                if "sondage" in src or "emagram" in src:
                    image_src = urljoin(str(response.url), src)
                    break

            if not image_src:
                raise RuntimeError("Meteociel emagram image not found in page")

            image_response = await client.get(image_src)
            image_response.raise_for_status()
            content_type = image_response.headers.get("content-type", "")
            if content_type and not content_type.startswith("image/"):
                logger.warning(
                    "Meteociel emagram image response has unexpected content-type: %s",
                    content_type,
                )
            _write_image_atomically(image_path, image_response.content)

        if not image_path.exists() or image_path.stat().st_size == 0:
            raise RuntimeError("Meteociel emagram image was not written")

        logger.info(f"Meteociel emagram image saved: {image_path}")

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


async def generate_open_meteo_emagram_image(
    latitude: float,
    longitude: float,
    spot_name: str,
    model: str,
    day_index: int = 0,
    hour: int | None = None,
) -> dict[str, Any]:
    """Generate an emagram image from Open-Meteo pressure-level model data."""
    from scrapers.emagram_generator import generate_emagram_from_openmeteo
    from scrapers.open_meteo_sounding import fetch_sounding_for_spot

    sounding = await fetch_sounding_for_spot(
        spot_latitude=latitude,
        spot_longitude=longitude,
        spot_name=spot_name,
        model=model,
        day_index=day_index,
        hour=hour,
    )
    source = str(sounding.get("source") or f"open-meteo-{model}")
    if not sounding.get("success"):
        return {
            "success": False,
            "source": source,
            "error": str(sounding.get("error") or "Open-Meteo sounding fetch failed"),
            "external_url": sounding.get("external_url", "https://open-meteo.com/"),
            "timestamp": datetime.now().isoformat(),
        }

    image_result = generate_emagram_from_openmeteo(
        sounding_data=sounding,
        output_dir=str(EMAGRAM_CACHE_DIR),
    )
    if not image_result.get("success"):
        return {
            "success": False,
            "source": source,
            "error": str(image_result.get("error") or "Open-Meteo emagram generation failed"),
            "external_url": sounding.get("external_url", "https://open-meteo.com/"),
            "timestamp": datetime.now().isoformat(),
        }

    return {
        "success": True,
        "source": source,
        "image_path": image_result["image_path"],
        "external_url": sounding.get("external_url", "https://open-meteo.com/"),
        "timestamp": datetime.now().isoformat(),
    }


async def _run_screenshot_with_timeout(
    source: str, screenshot_coro: Any, timeout_seconds: float, external_url: str
) -> dict[str, Any]:
    task = asyncio.create_task(screenshot_coro)
    try:
        return await asyncio.wait_for(task, timeout=timeout_seconds)
    except TimeoutError:
        task.cancel()
        with suppress(BaseException):
            await task
        return {
            "success": False,
            "source": source,
            "error": f"{source} screenshot timed out after {timeout_seconds}s",
            "external_url": external_url,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {
            "success": False,
            "source": source,
            "error": str(e),
            "external_url": external_url,
            "timestamp": datetime.now().isoformat(),
        }


async def fetch_all_emagram_screenshots(
    spot_id: str,
    latitude: float,
    longitude: float,
    spot_name: str,
    day_index: int = 0,
    hour: int | None = None,
) -> dict[str, Any]:
    """
    Fetch emagram images from screenshot and model-generated sources in parallel

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
                {"source": "meteociel", "success": True, "image_path": "...", ...},
                {"source": "open-meteo-arome", "success": True, "image_path": "...", ...},
                {"source": "open-meteo-icon", "success": True, "image_path": "...", ...}
            ],
            "sources_successful": 4,
            "sources_total": 4,
            "timestamp": "2024-03-07T20:00:00"
        }
    """

    logger.info(f"🎬 Starting screenshot fetch for {spot_name} ({spot_id})")
    logger.info(f"   Coordinates: {latitude}, {longitude}")
    meteo_parapente_url = f"https://meteo-parapente.com/#/sounding/{latitude}/{longitude}"
    if hour is not None:
        meteociel_ech = hour + (day_index * 24)
    else:
        meteociel_ech = 3 + (day_index * 24)
    meteociel_url = (
        "https://www.meteociel.fr/modeles/sondage2.php"
        f"?mode=0&lon={longitude}&lat={latitude}&ech={meteociel_ech}&map=0"
    )

    # Fetch sources in parallel
    tasks = [
        _run_screenshot_with_timeout(
            "meteo-parapente",
            screenshot_meteo_parapente(
                latitude, longitude, spot_name, day_index=day_index, hour=hour
            ),
            timeout_seconds=METEO_PARAPENTE_SCREENSHOT_TIMEOUT_SECONDS,
            external_url=meteo_parapente_url,
        ),
        _run_screenshot_with_timeout(
            "meteociel",
            screenshot_meteociel_emagram(
                latitude, longitude, spot_name, day_index=day_index, hour=hour
            ),
            timeout_seconds=METEOCIEL_SCREENSHOT_TIMEOUT_SECONDS,
            external_url=meteociel_url,
        ),
        _run_screenshot_with_timeout(
            "open-meteo-arome",
            generate_open_meteo_emagram_image(
                latitude, longitude, spot_name, model="arome", day_index=day_index, hour=hour
            ),
            timeout_seconds=OPEN_METEO_EMAGRAM_TIMEOUT_SECONDS,
            external_url="https://open-meteo.com/en/docs/meteofrance-api",
        ),
        _run_screenshot_with_timeout(
            "open-meteo-icon",
            generate_open_meteo_emagram_image(
                latitude, longitude, spot_name, model="icon", day_index=day_index, hour=hour
            ),
            timeout_seconds=OPEN_METEO_EMAGRAM_TIMEOUT_SECONDS,
            external_url="https://open-meteo.com/en/docs/dwd-api",
        ),
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
    Protects screenshots referenced by fresh completed analyses.
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

    # Build set of protected file paths from analyses the UI can still display.
    protected_paths: set[str] = set()
    try:
        with get_db_context() as db:
            from emagram_freshness import get_emagram_cutoff_utc

            fresh_analyses = (
                db.query(EmagramAnalysis)
                .filter(
                    EmagramAnalysis.analysis_status.in_(["completed", "partial"]),
                    EmagramAnalysis.analysis_datetime >= get_emagram_cutoff_utc(db=db),
                    EmagramAnalysis.screenshot_paths.isnot(None),
                )
                .all()
            )

            for analysis in fresh_analyses:
                try:
                    paths = json.loads(analysis.screenshot_paths)
                    protected_paths.update(paths.values())
                except (json.JSONDecodeError, AttributeError, TypeError):
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
