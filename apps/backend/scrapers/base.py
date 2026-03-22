"""
Base classes pour tous les scrapers - Support Playwright ET Scrapling
Architecture hybride pour maximum de flexibilité
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any


class ScraperType(Enum):
    """Type de moteur de scraping"""

    API = "api"  # Requêtes HTTP simples (httpx)
    PLAYWRIGHT = "playwright"  # Browser automation sans protection
    STEALTH = "stealth"  # Browser stealth mode (anti-bot)


class BaseScraper(ABC):
    """
    Classe abstraite pour tous les scrapers

    Responsabilités:
    - Définir l'interface commune fetch() + extract()
    - Fournir la logique de gestion d'erreurs
    - Standardiser le format de retour
    - Logger les opérations
    """

    def __init__(self, source_name: str, scraper_type: ScraperType, timeout: int = 15):
        self.source_name = source_name
        self.scraper_type = scraper_type
        self.timeout = timeout
        self.logger = logging.getLogger(f"scrapers.{source_name}")

    @abstractmethod
    async def fetch(self, lat: float, lon: float, **kwargs) -> dict[str, Any]:
        """
        Fetch raw data from source

        Args:
            lat: Latitude
            lon: Longitude
            **kwargs: Additional parameters (site_name, elevation_m, days, etc.)

        Returns:
            {
                "success": bool,
                "source": str,
                "data": Any,
                "error": Optional[str],
                "timestamp": str
            }
        """
        pass

    @abstractmethod
    def extract_hourly_forecast(
        self, data: dict[str, Any], day_index: int = 0
    ) -> list[dict[str, Any]]:
        """
        Extract standardized hourly forecast from raw data

        Args:
            data: Raw data from fetch()
            day_index: Day index (0=today, 1=tomorrow, etc.)

        Returns:
            List of dicts with keys:
            - hour: int (0-23)
            - temperature: float (°C) or None
            - wind_speed: float (m/s) or None
            - wind_gust: float (m/s) or None
            - wind_direction: float (degrees) or None
            - precipitation: float (mm) or None
            - cloud_cover: float (%) or None
        """
        pass

    def _build_response(
        self, success: bool, data: Any = None, error: str | None = None
    ) -> dict[str, Any]:
        """Build standardized response"""
        return {
            "success": success,
            "source": self.source_name,
            "data": data if success else [],
            "error": error,
            "timestamp": datetime.now().isoformat(),
        }

    async def fetch_with_retry(
        self, lat: float, lon: float, max_retries: int = 3, **kwargs
    ) -> dict[str, Any]:
        """
        Fetch with automatic retry logic

        Args:
            max_retries: Maximum number of retry attempts
        """
        import asyncio

        last_error = None

        for attempt in range(max_retries):
            try:
                self.logger.info(f"Attempt {attempt + 1}/{max_retries} for {self.source_name}")

                result = await self.fetch(lat, lon, **kwargs)

                if result["success"]:
                    return result

                # If not success but no exception, don't retry
                return result

            except Exception as e:
                last_error = str(e)
                self.logger.warning(f"Attempt {attempt + 1} failed: {e}")

                if attempt < max_retries - 1:
                    # Exponential backoff
                    wait_time = 2**attempt
                    self.logger.info(f"Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)

        # All retries failed
        return self._build_response(
            success=False, error=f"Failed after {max_retries} attempts. Last error: {last_error}"
        )


class APIScraper(BaseScraper):
    """
    Scraper for REST APIs using httpx
    Used for: open-meteo, weatherapi
    """

    def __init__(self, source_name: str, base_url: str, timeout: int = 10):
        super().__init__(source_name, ScraperType.API, timeout)
        self.base_url = base_url

    def _get_client(self):
        """Get httpx client (for use in subclasses)"""
        import httpx

        return httpx.AsyncClient(timeout=self.timeout)

    async def fetch(self, lat: float, lon: float, **kwargs) -> dict[str, Any]:
        """Implement API fetching with httpx"""
        import inspect

        import httpx

        try:
            # Support both sync and async _build_params
            build_params_method = self._build_params
            if inspect.iscoroutinefunction(build_params_method):
                params = await build_params_method(lat, lon, **kwargs)
            else:
                params = build_params_method(lat, lon, **kwargs)

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

            return self._build_response(success=True, data=data)

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}: {str(e)}"
            self.logger.error(error_msg)
            return self._build_response(success=False, error=error_msg)

        except Exception as e:
            self.logger.error(f"API fetch error: {e}", exc_info=True)
            return self._build_response(success=False, error=str(e))

    @abstractmethod
    def _build_params(self, lat: float, lon: float, **kwargs) -> dict[str, Any]:
        """
        Build API request parameters (to be implemented by subclasses)

        Note: Can be either sync or async. APIScraper.fetch() will detect and handle both.
        """
        pass


class PlaywrightScraper(BaseScraper):
    """
    Scraper using Playwright for JavaScript-heavy sites
    Used for: meteo-parapente (and other sites without anti-bot)
    """

    def __init__(self, source_name: str, base_url: str, headless: bool = True, timeout: int = 30):
        super().__init__(source_name, ScraperType.PLAYWRIGHT, timeout)
        self.base_url = base_url
        self.headless = headless

    async def fetch(self, lat: float, lon: float, **kwargs) -> dict[str, Any]:
        """Implement Playwright fetching"""
        from playwright.async_api import async_playwright

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=self.headless)
                page = await browser.new_page()

                # Set timeout
                page.set_default_timeout(self.timeout * 1000)

                # Call subclass-specific scraping logic
                data = await self._scrape_page(page, lat, lon, **kwargs)

                await browser.close()

            return self._build_response(success=True, data=data)

        except Exception as e:
            self.logger.error(f"Playwright scrape error: {e}", exc_info=True)
            return self._build_response(success=False, error=str(e))

    @abstractmethod
    async def _scrape_page(self, page, lat: float, lon: float, **kwargs) -> Any:
        """
        Scraping logic with Playwright Page object
        (to be implemented by subclasses)
        """
        pass


class StealthScraper(BaseScraper):
    """
    Scraper using Scrapling Stealth mode for protected sites
    Used for: Future sites with Cloudflare/anti-bot
    """

    def __init__(self, source_name: str, base_url: str, headless: bool = True, timeout: int = 30):
        super().__init__(source_name, ScraperType.STEALTH, timeout)
        self.base_url = base_url
        self.headless = headless

    async def fetch(self, lat: float, lon: float, **kwargs) -> dict[str, Any]:
        """Implement Scrapling Stealth fetching"""
        try:
            from scrapling.fetchers import StealthyFetcher

            url = self._build_url(lat, lon, **kwargs)

            response = await StealthyFetcher.async_fetch(
                url,
                headless=self.headless,
                network_idle=True,
                timeout=self.timeout * 1000,  # Convert to ms
            )

            # Call subclass-specific parsing logic
            data = self._parse_response(response)

            return self._build_response(success=True, data=data)

        except Exception as e:
            self.logger.error(f"Stealth scrape error: {e}", exc_info=True)
            return self._build_response(success=False, error=str(e))

    @abstractmethod
    def _build_url(self, lat: float, lon: float, **kwargs) -> str:
        """Build URL for stealth fetching"""
        pass

    @abstractmethod
    def _parse_response(self, response) -> Any:
        """Parse Scrapling response"""
        pass
