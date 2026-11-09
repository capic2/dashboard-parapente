import pytest

import weather_pipeline


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("precipitation_values", "expected_total"),
    [([0.8, 0.2, 0.5, 0.8], 2.3), ([None, None, None, None], None)],
)
async def test_daily_aggregate_uses_full_day_precipitation_and_preserves_missing(
    monkeypatch: pytest.MonkeyPatch,
    precipitation_values: list[float | None],
    expected_total: float | None,
) -> None:
    consensus = [
        {
            "hour": hour,
            "temperature": 10.0 + hour,
            "wind_speed": 5.0,
            "wind_direction": 90.0,
            "precipitation": precipitation,
        }
        for hour, precipitation in zip([4, 9, 16, 22], precipitation_values, strict=True)
    ]

    async def fake_get_normalized_forecast(*args: object, **kwargs: object) -> dict[str, object]:
        return {
            "success": True,
            "consensus": consensus,
            "sunrise": "06:00",
            "sunset": "20:00",
        }

    monkeypatch.setattr(weather_pipeline, "get_normalized_forecast", fake_get_normalized_forecast)
    monkeypatch.setattr(
        weather_pipeline,
        "calculate_para_index",
        lambda _hours: {"para_index": 75, "verdict": "GOOD", "emoji": "🟢"},
    )
    monkeypatch.setattr(weather_pipeline, "analyze_hourly_slots", lambda _hours: [])

    result = await weather_pipeline.get_daily_aggregate(
        lat=47.2,
        lon=6.0,
        day_index=1,
        min_wind=2.8,
        max_wind=8.3,
        optimal_directions="N,NE,E,SE,S,SW,W,NW",
    )

    assert result is not None
    assert result["precip_total"] == expected_total
