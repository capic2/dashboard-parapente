import pytest

from scrapers import openweathermap
from scrapers.openweathermap import extract_hourly_forecast


def test_extract_openweathermap_hourly_forecast_normalizes_utc_and_precipitation():
    result = extract_hourly_forecast(
        {
            "success": True,
            "data": {
                "list": [
                    {
                        "dt_txt": "2026-06-01 15:00:00",
                        "main": {"temp": 21.2},
                        "wind": {"speed": 4.0, "gust": 7.5, "deg": 260},
                        "clouds": {"all": 35},
                        "rain": {"3h": 0.4},
                    }
                ]
            },
        },
        day_index=0,
    )

    assert result == [
        {
            "time": "2026-06-01 15:00:00",
            "hour": 17,
            "temperature": 21.2,
            "wind_speed": 14.4,
            "wind_gust": 27.0,
            "wind_direction": 260,
            "cloud_cover": 35,
            "precipitation": 0.13,
            "cape": None,
            "lifted_index": None,
        }
    ]


def test_extract_openweathermap_returns_empty_when_dt_txt_is_missing():
    result = extract_hourly_forecast({"success": True, "data": {"list": [{"main": {}}]}})

    assert result == []


@pytest.mark.asyncio
async def test_fetch_openweathermap_clamps_days_to_minimum_of_one(monkeypatch):
    captured: dict[str, object] = {}

    class _FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"list": []}

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params):
            captured["url"] = url
            captured["params"] = params
            return _FakeResponse()

    monkeypatch.setattr(openweathermap, "OPENWEATHERMAP_API_KEY", "test-key")
    monkeypatch.setattr(openweathermap.httpx, "AsyncClient", lambda **kwargs: _FakeClient())

    result = await openweathermap.fetch_openweathermap(47.2, 6.0, days=0)

    assert result["success"] is True
    assert captured["params"]["cnt"] == 8
