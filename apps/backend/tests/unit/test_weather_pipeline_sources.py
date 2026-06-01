from weather_pipeline import calculate_consensus


def test_calculate_consensus_preserves_registered_source_details():
    result = calculate_consensus(
        {
            "success": True,
            "normalized": [
                {
                    "hour": 12,
                    "sources": ["open-meteo", "met-no"],
                    "temperature": [18.0, 20.0],
                    "wind_speed": [12.0, 16.0],
                    "wind_gust": [20.0, 24.0],
                    "wind_direction": [250.0, 260.0],
                    "precipitation": [0.0, 0.2],
                    "cloud_cover": [30.0, 40.0],
                    "cape": [None, None],
                    "lifted_index": [None, None],
                }
            ],
        }
    )

    assert result["success"] is True
    assert result["total_sources"] == 2
    assert result["consensus"][0]["sources"]["met-no"]["wind_speed"] == 16.0
    assert result["consensus"][0]["sources"]["open-meteo"]["wind_speed"] == 12.0
    assert result["consensus"][0]["sources"]["open-meteo-icon"]["wind_speed"] is None
