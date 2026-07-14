"""
Live tests for Meteoblue scraper
"""

import pytest
import httpx

from config import METEOBLUE_API_KEY
from scrapers import meteoblue
from scrapers.meteoblue import MeteoblueScraper, fetch_meteoblue

ARGUEL_LAT = 47.2
ARGUEL_LON = 6.0


@pytest.mark.asyncio
@pytest.mark.xfail(reason="API key may be missing or API down", strict=False)
@pytest.mark.skipif(not METEOBLUE_API_KEY, reason="METEOBLUE_API_KEY not configured")
async def test_fetch_meteoblue_success():
    result = await fetch_meteoblue(ARGUEL_LAT, ARGUEL_LON)
    assert "success" in result
    assert "source" in result
    assert result["source"] == "meteoblue"
    if result["success"]:
        assert "data" in result


@pytest.mark.asyncio
@pytest.mark.skipif(not METEOBLUE_API_KEY, reason="METEOBLUE_API_KEY not configured")
async def test_fetch_meteoblue_timeout():
    import time

    start = time.time()
    result = await fetch_meteoblue(ARGUEL_LAT, ARGUEL_LON)
    duration = time.time() - start
    assert duration < 20.0
    assert "success" in result


def test_meteoblue_city_code_handles_missing_city_name() -> None:
    scraper = MeteoblueScraper()

    assert scraper._get_city_code(None) is None


def test_meteoblue_parses_server_rendered_three_hour_table() -> None:
    html = """
    <table class="picto three-hourly-view">
      <tr class="times"><th></th><td><time datetime="2026-07-14T12:00:00+02:00">12</time></td></tr>
      <tr class="icons"><th></th><td><img src="/assets/images/picto/02_day.svg"></td></tr>
      <tr class="temperatures"><th></th><td>24°</td></tr>
      <tr class="windspeeds"><th></th><td><div class="glyph winddir WSW">OSO</div>13-29</td></tr>
      <tr class="precips"><th></th><td><div class="precip">0.4</div></td></tr>
    </table>
    """

    result = MeteoblueScraper()._parse_html(html)

    assert result == [
        {
            "datetime": "2026-07-14T12:00:00+02:00",
            "temperature": 24,
            "wind_speed": 13,
            "wind_gust": 29,
            "wind_direction": 247,
            "precipitation": 0.4,
            "clouds": 25,
            "humidity": None,
            "picto": "/assets/images/picto/02_day.svg",
        }
    ]


def test_meteoblue_builds_selected_day_url() -> None:
    scraper = MeteoblueScraper()

    assert (
        scraper._build_forecast_url(46.9693, 5.8747, day_index=2)
        == "https://www.meteoblue.com/fr/meteo/semaine/46.97N5.87E?day=3"
    )


@pytest.mark.asyncio
async def test_meteoblue_fetch_uses_browser_user_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_headers: dict[str, str] = {}

    class FakeResponse:
        text = "<html>forecast</html>"

        def raise_for_status(self) -> None:
            return None

    class FakeAsyncClient:
        def __init__(self, **kwargs: object) -> None:
            captured_headers.update(kwargs["headers"])

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
            return None

        async def get(self, url: str) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(meteoblue.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        MeteoblueScraper,
        "_parse_html",
        lambda self, html: [{"datetime": "2026-07-14T12:00:00+02:00"}],
    )

    result = await MeteoblueScraper().fetch(46.9693, 5.8747)

    assert result["success"] is True
    assert captured_headers["User-Agent"].startswith("Mozilla/5.0")


@pytest.mark.asyncio
async def test_meteoblue_fetch_fails_when_response_has_no_forecast_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponse:
        text = "<html></html>"

        def raise_for_status(self) -> None:
            return None

    class FakeAsyncClient:
        def __init__(self, **kwargs: object) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
            return None

        async def get(self, url: str) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(meteoblue.httpx, "AsyncClient", FakeAsyncClient)

    result = await MeteoblueScraper().fetch(46.9693, 5.8747)

    assert result["success"] is False
    assert result["error"] == "No forecast table data found in Meteoblue response"


@pytest.mark.asyncio
async def test_meteoblue_fetch_returns_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            request = httpx.Request("GET", "https://www.meteoblue.com/blocked")
            response = httpx.Response(403, request=request)
            raise httpx.HTTPStatusError("blocked", request=request, response=response)

    class FakeAsyncClient:
        def __init__(self, **kwargs: object) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
            return None

        async def get(self, url: str) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr(meteoblue.httpx, "AsyncClient", FakeAsyncClient)

    result = await MeteoblueScraper().fetch(46.9693, 5.8747)

    assert result["success"] is False
    assert result["error"].startswith("HTTP 403:")
