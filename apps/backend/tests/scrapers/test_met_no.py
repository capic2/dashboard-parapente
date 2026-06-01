from scrapers.met_no import extract_hourly_forecast


def test_extract_met_no_hourly_forecast_converts_wind_to_kmh():
    result = extract_hourly_forecast(
        {
            "success": True,
            "data": {
                "properties": {
                    "timeseries": [
                        {
                            "time": "2026-06-01T12:00:00Z",
                            "data": {
                                "instant": {
                                    "details": {
                                        "air_temperature": 18.4,
                                        "wind_speed": 5.0,
                                        "wind_speed_of_gust": 8.0,
                                        "wind_from_direction": 245,
                                        "cloud_area_fraction": 40,
                                    }
                                },
                                "next_1_hours": {"details": {"precipitation_amount": 0.2}},
                            },
                        }
                    ]
                }
            },
        },
        day_index=0,
    )

    assert result == [
        {
            "time": "2026-06-01T12:00:00Z",
            "hour": 14,
            "temperature": 18.4,
            "wind_speed": 18.0,
            "wind_gust": 28.8,
            "wind_direction": 245,
            "cloud_cover": 40,
            "precipitation": 0.2,
            "cape": None,
            "lifted_index": None,
        }
    ]
