import httpx
import pytest

from scrapers import openweathermap
from scrapers.openweathermap import extract_hourly_forecast


def test_extract_openweathermap_distributes_three_hour_precipitation_and_splits_midnight():
    result = extract_hourly_forecast(
        {
            "success": True,
            "data": {
                "list": [
                    {
                        "dt_txt": "2026-06-01 00:00:00",
                        "main": {"temp": 12.0},
                        "rain": {"3h": 3.0},
                    },
                    {
                        "dt_txt": "2026-06-01 03:00:00",
                        "main": {"temp": 15.0},
                        "wind": {"speed": 4.0, "gust": 7.5, "deg": 260},
                        "clouds": {"all": 35},
                        "rain": {"3h": 3.0},
                        "snow": {"3h": 0.6},
                    },
                ]
            },
        },
        day_index=0,
    )

    precipitation_by_hour = {item["hour"]: item["precipitation"] for item in result}
    assert precipitation_by_hour == {0: 1.0, 1: 1.0, 2: 1.2, 3: 1.2, 4: 1.2, 5: None}
    assert sum(
        value for value in precipitation_by_hour.values() if value is not None
    ) == pytest.approx(5.6)
    assert all("+02:00" in item["time"] for item in result)
    forecast_at_five = next(item for item in result if item["hour"] == 5)
    assert forecast_at_five["temperature"] == 15.0
    assert forecast_at_five["wind_speed"] == 14.4
    assert forecast_at_five["wind_gust"] == 27.0
    assert forecast_at_five["wind_direction"] == 260
    assert forecast_at_five["cloud_cover"] == 35


def test_extract_openweathermap_handles_null_rain_and_snow_values():
    result = extract_hourly_forecast(
        {
            "success": True,
            "data": {
                "list": [
                    {
                        "dt_txt": "2026-06-01 15:00:00",
                        "main": {"temp": 21.2},
                        "rain": None,
                        "snow": None,
                    }
                ]
            },
        },
        day_index=0,
    )

    assert [item["precipitation"] for item in result] == [0.0, 0.0, 0.0, None]


def test_extract_openweathermap_keeps_later_point_for_repeated_dst_hour():
    result = extract_hourly_forecast(
        {
            "success": True,
            "data": {
                "list": [
                    {
                        "dt_txt": "2026-10-25 01:00:00",
                        "main": {"temp": 15.0},
                        "wind": {"speed": 4.0},
                        "rain": {"3h": 3.0},
                    },
                    {
                        "dt_txt": "2026-10-25 00:00:00",
                        "main": {"temp": 12.0},
                        "rain": None,
                        "snow": None,
                    },
                ]
            },
        },
        day_index=0,
    )

    hour_two = next(item for item in result if item["hour"] == 2)
    assert hour_two["temperature"] == 15.0
    assert hour_two["wind_speed"] == 14.4
    assert hour_two["precipitation"] == 1.0


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

    monkeypatch.setattr(openweathermap, "OPENWEATHERMAP_API_KEY", None)
    monkeypatch.setattr(openweathermap.httpx, "AsyncClient", lambda **kwargs: _FakeClient())

    result = await openweathermap.fetch_openweathermap(47.2, 6.0, days=0, api_key="database-key")

    assert result["success"] is True
    assert captured["params"]["cnt"] == 8
    assert captured["params"]["appid"] == "database-key"


@pytest.mark.asyncio
async def test_fetch_openweathermap_does_not_expose_api_key_in_http_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    secret_key = "secret-database-key"

    class _FakeResponse:
        status_code = 401

        def raise_for_status(self) -> None:
            request = httpx.Request(
                "GET",
                f"https://api.openweathermap.org/data/2.5/forecast?appid={secret_key}",
            )
            response = httpx.Response(401, request=request)
            raise httpx.HTTPStatusError("unauthorized", request=request, response=response)

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params):
            return _FakeResponse()

    monkeypatch.setattr(openweathermap.httpx, "AsyncClient", lambda **kwargs: _FakeClient())

    result = await openweathermap.fetch_openweathermap(47.2, 6.0, api_key=secret_key)

    assert result["success"] is False
    assert result["status_code"] == 401
    assert secret_key not in result["error"]
