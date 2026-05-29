from pathlib import Path
from datetime import datetime

import pytest

from scrapers import emagram_screenshots


class _FakeLocator:
    def __init__(self, count: int = 1) -> None:
        self._count = count

    @property
    def first(self):
        return self

    def locator(self, selector: str):
        if selector == "xpath=ancestor::td":
            return _FakeLocator(count=1)
        return _FakeLocator(count=0)

    async def count(self) -> int:
        return self._count

    async def screenshot(self, path: str, *args, **kwargs) -> None:
        Path(path).write_bytes(b"png")

    async def click(self, *args, **kwargs) -> None:
        return None


class _FakePage:
    def __init__(self, *, image_loaded: bool) -> None:
        self.image_loaded = image_loaded
        self.context = _FakeContext()
        self.full_page_screenshot_called = False

    async def goto(self, *args, **kwargs) -> None:
        return None

    async def wait_for_selector(self, *args, **kwargs) -> None:
        return None

    async def wait_for_function(self, *args, **kwargs) -> None:
        if not self.image_loaded:
            raise RuntimeError("image not loaded")

    def locator(self, selector: str):
        return _FakeLocator()

    async def evaluate(self, *args, **kwargs) -> dict[str, int]:
        return {"x": 10, "y": 20, "width": 300, "height": 400}

    async def screenshot(self, *args, **kwargs) -> None:
        self.full_page_screenshot_called = True
        raise AssertionError("Meteociel should not fall back to a full-page screenshot")


class _FakeCdpSession:
    async def send(self, *args, **kwargs) -> dict[str, str]:
        return {"data": "cG5n"}


class _FakeContext:
    async def new_cdp_session(self, *args, **kwargs) -> _FakeCdpSession:
        return _FakeCdpSession()


class _FakeKeyboard:
    def __init__(self) -> None:
        self.pressed: list[str] = []

    async def press(self, key: str) -> None:
        self.pressed.append(key)


class _FakeMeteoParapentePage:
    def __init__(self, output_path: Path) -> None:
        self.keyboard = _FakeKeyboard()
        self.output_path = output_path

    async def goto(self, *args, **kwargs) -> None:
        return None

    async def wait_for_timeout(self, *args, **kwargs) -> None:
        return None

    async def wait_for_load_state(self, *args, **kwargs) -> None:
        return None

    def locator(self, selector: str):
        return _FakeLocator(count=0)

    async def screenshot(self, path: str, *args, **kwargs) -> None:
        Path(path).write_bytes(b"png")


class _FakeBrowser:
    def __init__(self, page: _FakePage) -> None:
        self.page = page

    async def new_page(self, *args, **kwargs) -> _FakePage:
        return self.page

    async def close(self) -> None:
        return None


class _FakeChromium:
    def __init__(self, page: _FakePage) -> None:
        self.page = page

    async def launch(self, *args, **kwargs) -> _FakeBrowser:
        return _FakeBrowser(self.page)


class _FakePlaywright:
    def __init__(self, page: _FakePage) -> None:
        self.chromium = _FakeChromium(page)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


class _FakeHttpResponse:
    def __init__(self, *, text: str = "", content: bytes = b"", url: str = "https://example.test"):
        self.text = text
        self.content = content
        self.url = url

    def raise_for_status(self) -> None:
        return None


class _FakeAsyncClient:
    def __init__(self, *, page_html: str) -> None:
        self.page_html = page_html

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def get(self, url: str) -> _FakeHttpResponse:
        if url.endswith(".png"):
            return _FakeHttpResponse(content=b"png", url=url)
        return _FakeHttpResponse(text=self.page_html, url=url)


@pytest.mark.asyncio
async def test_meteociel_screenshot_downloads_emagram_image(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(emagram_screenshots, "EMAGRAM_CACHE_DIR", tmp_path)
    monkeypatch.setattr(
        emagram_screenshots.httpx,
        "AsyncClient",
        lambda **kwargs: _FakeAsyncClient(
            page_html='<html><img src="/modeles/sondagegfs/sondagegfs_6_47.2_27_0.png"></html>'
        ),
    )

    result = await emagram_screenshots.screenshot_meteociel_emagram(
        latitude=47.2,
        longitude=6.0,
        spot_name="Arguel",
        hour=12,
    )

    assert result["success"] is True
    assert result["source"] == "meteociel"
    assert Path(result["image_path"]).read_bytes() == b"png"


@pytest.mark.asyncio
async def test_meteociel_screenshot_fails_without_image(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(emagram_screenshots, "EMAGRAM_CACHE_DIR", tmp_path)
    monkeypatch.setattr(
        emagram_screenshots.httpx,
        "AsyncClient",
        lambda **kwargs: _FakeAsyncClient(page_html="<html></html>"),
    )

    result = await emagram_screenshots.screenshot_meteociel_emagram(
        latitude=47.2,
        longitude=6.0,
        spot_name="Arguel",
        hour=12,
    )

    assert result["success"] is False
    assert result["source"] == "meteociel"
    assert "image not found" in result["error"]
    assert list(tmp_path.glob("*.png")) == []


@pytest.mark.asyncio
async def test_meteo_parapente_uses_keyboard_day_fallback(monkeypatch, tmp_path) -> None:
    page = _FakeMeteoParapentePage(tmp_path)
    monkeypatch.setattr(emagram_screenshots, "EMAGRAM_CACHE_DIR", tmp_path)
    monkeypatch.setattr(
        emagram_screenshots,
        "async_playwright",
        lambda: _FakePlaywright(page),
    )

    result = await emagram_screenshots.screenshot_meteo_parapente(
        latitude=47.2,
        longitude=6.0,
        spot_name="Arguel",
        day_index=1,
    )

    assert result["success"] is True
    assert result["source"] == "meteo-parapente"
    assert page.keyboard.pressed == ["ArrowRight"]
    assert Path(result["image_path"]).read_bytes() == b"png"


@pytest.mark.asyncio
async def test_fetch_all_returns_success_when_one_source_times_out(monkeypatch) -> None:
    async def slow_meteo_parapente(*args, **kwargs) -> None:
        await emagram_screenshots.asyncio.sleep(10)

    async def successful_meteociel(*args, **kwargs) -> dict[str, str | bool]:
        return {
            "success": True,
            "source": "meteociel",
            "image_path": "/tmp/meteociel.png",
            "external_url": "https://example.test",
            "timestamp": datetime.now().isoformat(),
        }

    monkeypatch.setattr(emagram_screenshots, "screenshot_meteo_parapente", slow_meteo_parapente)
    monkeypatch.setattr(emagram_screenshots, "screenshot_meteociel_emagram", successful_meteociel)
    monkeypatch.setattr(emagram_screenshots, "METEO_PARAPENTE_SCREENSHOT_TIMEOUT_SECONDS", 0.01)

    result = await emagram_screenshots.fetch_all_emagram_screenshots(
        spot_id="site-arguel",
        latitude=47.2,
        longitude=6.0,
        spot_name="Arguel",
        day_index=1,
    )

    assert result["success"] is True
    assert result["sources_successful"] == 1
    assert result["screenshots"][0]["source"] == "meteo-parapente"
    assert "timed out" in result["screenshots"][0]["error"]
    assert result["screenshots"][0]["external_url"].startswith("https://meteo-parapente.com")
    assert result["screenshots"][1]["source"] == "meteociel"
