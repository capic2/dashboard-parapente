from pathlib import Path

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

    async def screenshot(self, path: str) -> None:
        Path(path).write_bytes(b"png")

    async def click(self, *args, **kwargs) -> None:
        return None


class _FakePage:
    def __init__(self, *, image_loaded: bool) -> None:
        self.image_loaded = image_loaded
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

    async def screenshot(self, *args, **kwargs) -> None:
        self.full_page_screenshot_called = True
        raise AssertionError("Meteociel should not fall back to a full-page screenshot")


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


@pytest.mark.asyncio
async def test_meteociel_screenshot_captures_visible_image_after_load_timeout(
    monkeypatch, tmp_path
) -> None:
    page = _FakePage(image_loaded=False)
    monkeypatch.setattr(emagram_screenshots, "EMAGRAM_CACHE_DIR", tmp_path)
    monkeypatch.setattr(
        emagram_screenshots,
        "async_playwright",
        lambda: _FakePlaywright(page),
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
    assert not page.full_page_screenshot_called


@pytest.mark.asyncio
async def test_meteociel_screenshot_captures_loaded_image(monkeypatch, tmp_path) -> None:
    page = _FakePage(image_loaded=True)
    monkeypatch.setattr(emagram_screenshots, "EMAGRAM_CACHE_DIR", tmp_path)
    monkeypatch.setattr(
        emagram_screenshots,
        "async_playwright",
        lambda: _FakePlaywright(page),
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
    assert not page.full_page_screenshot_called


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
