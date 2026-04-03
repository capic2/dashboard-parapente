"""
Tests for Best Spot Calculator (best_spot.py)

Coverage:
- Wind direction parsing and conversion
- Angle difference calculation
- Wind favorability determination
- Score multiplier calculation
- Best spot calculation from cache
- Best spot calculation from database
- Cache refresh functionality

Strategy:
- Test helper functions (parse, convert, calculate)
- Mock weather forecasts and database queries
- Test scoring algorithm with various scenarios
- Test cache integration
"""

from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from best_spot import (
    calculate_angle_difference,
    calculate_best_spot_from_cache,
    calculate_best_spot_from_db,
    degrees_to_cardinal,
    get_wind_favorability,
    get_wind_score_multiplier,
    parse_wind_direction,
    refresh_best_spot_cache,
)
from models import Site, WeatherForecast

# ============================================================================
# HELPER FUNCTION TESTS
# ============================================================================


def test_parse_wind_direction_valid():
    """Test parsing valid wind directions"""
    assert parse_wind_direction("N") == 0
    assert parse_wind_direction("E") == 90
    assert parse_wind_direction("S") == 180
    assert parse_wind_direction("W") == 270
    assert parse_wind_direction("NE") == 45
    assert parse_wind_direction("SW") == 225


def test_parse_wind_direction_case_insensitive():
    """Test wind direction parsing is case insensitive"""
    assert parse_wind_direction("n") == 0
    assert parse_wind_direction("Ne") == 45
    assert parse_wind_direction("sw") == 225


def test_parse_wind_direction_with_whitespace():
    """Test wind direction parsing handles whitespace"""
    assert parse_wind_direction("  N  ") == 0
    assert parse_wind_direction(" SW ") == 225


def test_parse_wind_direction_invalid():
    """Test parsing invalid wind directions"""
    assert parse_wind_direction("INVALID") is None
    assert parse_wind_direction("") is None
    assert parse_wind_direction(None) is None


def test_calculate_angle_difference():
    """Test angle difference calculation"""
    # Same direction
    assert calculate_angle_difference(0, 0) == 0
    assert calculate_angle_difference(90, 90) == 0

    # Opposite directions
    assert calculate_angle_difference(0, 180) == 180
    assert calculate_angle_difference(90, 270) == 180

    # 90 degrees apart
    assert calculate_angle_difference(0, 90) == 90
    assert calculate_angle_difference(180, 270) == 90

    # Crossing 0/360 boundary
    assert calculate_angle_difference(350, 10) == 20
    assert calculate_angle_difference(10, 350) == 20

    # 45 degrees apart
    assert calculate_angle_difference(0, 45) == 45
    assert calculate_angle_difference(315, 0) == 45


def test_degrees_to_cardinal():
    """Test degrees to cardinal direction conversion"""
    assert degrees_to_cardinal(0) == "N"
    assert degrees_to_cardinal(90) == "E"
    assert degrees_to_cardinal(180) == "S"
    assert degrees_to_cardinal(270) == "W"

    # Test intermediate directions
    assert degrees_to_cardinal(45) == "NE"
    assert degrees_to_cardinal(135) == "SE"
    assert degrees_to_cardinal(225) == "SW"
    assert degrees_to_cardinal(315) == "NW"

    # Test wrapping
    assert degrees_to_cardinal(360) == "N"
    assert degrees_to_cardinal(361) == "N"


# ============================================================================
# WIND FAVORABILITY TESTS
# ============================================================================


def test_get_wind_favorability_good():
    """Test wind favorability calculation - good conditions"""
    # Wind aligned with site (0-45 degrees difference)
    assert get_wind_favorability("SW", "SW", 15.0) == "good"
    assert get_wind_favorability("N", "N", 20.0) == "good"

    # Within 45 degrees
    assert get_wind_favorability("W", "SW", 15.0) == "good"


def test_get_wind_favorability_moderate():
    """Test wind favorability - moderate conditions"""
    # 45-90 degrees difference
    assert get_wind_favorability("N", "E", 15.0) == "moderate"
    assert get_wind_favorability("S", "W", 20.0) == "moderate"


def test_get_wind_favorability_bad():
    """Test wind favorability - bad conditions"""
    # More than 90 degrees difference (opposite wind)
    assert get_wind_favorability("N", "S", 15.0) == "bad"
    assert get_wind_favorability("E", "W", 20.0) == "bad"

    # Wind too weak
    assert get_wind_favorability("SW", "SW", 3.0) == "bad"

    # Wind too strong
    assert get_wind_favorability("SW", "SW", 35.0) == "bad"


def test_get_wind_favorability_missing_data():
    """Test wind favorability with missing data"""
    # Missing wind direction
    assert get_wind_favorability(None, "SW", 15.0) == "moderate"

    # Missing site orientation
    assert get_wind_favorability("SW", None, 15.0) == "moderate"

    # Missing wind speed
    assert get_wind_favorability("SW", "SW", None) == "moderate"


def test_get_wind_score_multiplier():
    """Test wind score multiplier"""
    assert get_wind_score_multiplier("good") == 1.0
    assert get_wind_score_multiplier("moderate") == 0.7
    assert get_wind_score_multiplier("bad") == 0.3

    # Unknown favorability defaults to moderate
    assert get_wind_score_multiplier("unknown") == 0.7


# ============================================================================
# BEST SPOT FROM CACHE TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_calculate_best_spot_from_cache_success(db_session, arguel_site, chalais_site):
    """Test calculating best spot from cache with multiple sites"""

    # Mock weather forecasts for both sites (with sunrise/sunset for realistic filtering)
    mock_arguel_forecast = {
        "success": True,
        "sunrise": "07:00",
        "sunset": "19:00",
        "consensus": [
            {"hour": 10, "wind_speed": 15, "wind_direction": 225},  # SW
            {"hour": 11, "wind_speed": 18, "wind_direction": 225},
            {"hour": 12, "wind_speed": 20, "wind_direction": 225},
        ],
    }

    mock_chalais_forecast = {
        "success": True,
        "sunrise": "07:00",
        "sunset": "19:00",
        "consensus": [
            {"hour": 10, "wind_speed": 25, "wind_direction": 90},  # E - bad for SW site
            {"hour": 11, "wind_speed": 28, "wind_direction": 90},
            {"hour": 12, "wind_speed": 30, "wind_direction": 90},
        ],
    }

    # Mock para_index results
    mock_arguel_para = {"para_index": 75, "verdict": "Excellent"}
    mock_chalais_para = {"para_index": 60, "verdict": "Bon"}

    async def mock_get_forecast(lat, lon, day_index, site_name=None, elevation_m=None, db=None):
        if site_name == "Arguel":
            return mock_arguel_forecast
        elif site_name == "Chalais":
            return mock_chalais_forecast
        return {"success": False}

    def mock_calculate_para_index(consensus_hours):
        if consensus_hours == mock_arguel_forecast["consensus"]:
            return mock_arguel_para
        elif consensus_hours == mock_chalais_forecast["consensus"]:
            return mock_chalais_para
        return {"para_index": 0}

    with (
        patch("weather_pipeline.get_normalized_forecast", new=mock_get_forecast),
        patch("para_index.calculate_para_index", side_effect=mock_calculate_para_index),
    ):

        result = await calculate_best_spot_from_cache(db_session)

    assert result is not None
    assert result["site"]["name"] == "Arguel"  # Should win due to better wind favorability
    assert result["paraIndex"] == 75
    assert result["windFavorability"] == "good"
    assert result["score"] > 0


@pytest.mark.asyncio
async def test_calculate_best_spot_from_cache_no_sites(db_session):
    """Test best spot calculation with no sites in database"""

    # Clear all sites
    db_session.query(Site).delete()
    db_session.commit()

    result = await calculate_best_spot_from_cache(db_session)

    assert result is None


@pytest.mark.asyncio
async def test_calculate_best_spot_from_cache_no_forecasts(db_session, arguel_site):
    """Test best spot calculation with no cached forecasts"""

    async def mock_get_forecast(*args, **kwargs):
        return {"success": False, "error": "No cache"}

    with patch("weather_pipeline.get_normalized_forecast", new=mock_get_forecast):
        result = await calculate_best_spot_from_cache(db_session)

    assert result is None


@pytest.mark.asyncio
async def test_calculate_best_spot_from_cache_low_scores(db_session, arguel_site):
    """Test best spot with low scores adds warning"""

    mock_forecast = {
        "success": True,
        "sunrise": "07:00",
        "sunset": "19:00",
        "consensus": [{"hour": 12, "wind_speed": 5, "wind_direction": 0}],  # Too weak
    }

    mock_para = {"para_index": 10, "verdict": "Mauvais"}

    with (
        patch(
            "weather_pipeline.get_normalized_forecast", new=AsyncMock(return_value=mock_forecast)
        ),
        patch("para_index.calculate_para_index", return_value=mock_para),
    ):

        result = await calculate_best_spot_from_cache(db_session)

    assert result is not None
    assert "défavorables" in result["reason"].lower()


@pytest.mark.asyncio
async def test_calculate_best_spot_filters_night_hours(db_session, arguel_site):
    """Test that best spot calculation filters out night hours using sunrise/sunset"""

    # Forecast with night hours (bad weather) and day hours (good weather)
    # Without filtering, the night hours would drag the score down
    mock_forecast = {
        "success": True,
        "sunrise": "07:00",
        "sunset": "19:00",
        "consensus": [
            {"hour": 3, "wind_speed": 40, "wind_direction": 0, "precipitation": 10},  # Night: bad
            {"hour": 5, "wind_speed": 35, "wind_direction": 0, "precipitation": 8},  # Night: bad
            {"hour": 10, "wind_speed": 12, "wind_direction": 225},  # Day: good
            {"hour": 12, "wind_speed": 15, "wind_direction": 225},  # Day: good
            {"hour": 14, "wind_speed": 14, "wind_direction": 225},  # Day: good
            {"hour": 22, "wind_speed": 50, "wind_direction": 0, "precipitation": 15},  # Night: bad
        ],
    }

    captured_hours = []

    def mock_calculate_para_index(hours):
        captured_hours.extend(hours)
        return {"para_index": 80, "verdict": "Bon"}

    with (
        patch(
            "weather_pipeline.get_normalized_forecast",
            new=AsyncMock(return_value=mock_forecast),
        ),
        patch("para_index.calculate_para_index", side_effect=mock_calculate_para_index),
    ):
        result = await calculate_best_spot_from_cache(db_session)

    assert result is not None
    # Verify only daylight hours (7-19) were passed to calculate_para_index
    hours_used = [h["hour"] for h in captured_hours]
    assert 3 not in hours_used, "Night hour 3 should be filtered out"
    assert 5 not in hours_used, "Night hour 5 should be filtered out"
    assert 22 not in hours_used, "Night hour 22 should be filtered out"
    assert 10 in hours_used, "Day hour 10 should be included"
    assert 12 in hours_used, "Day hour 12 should be included"
    assert 14 in hours_used, "Day hour 14 should be included"


# ============================================================================
# BEST SPOT FROM DATABASE TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_calculate_best_spot_from_db_success(db_session, arguel_site):
    """Test calculating best spot from database forecasts"""

    # Create forecast for Arguel
    forecast = WeatherForecast(
        id="test-forecast",
        site_id=arguel_site.id,
        forecast_date=date.today(),
        para_index=80,
        wind_avg_kmh=15.0,
        verdict="Excellent",
        created_at=datetime.now(),
    )
    db_session.add(forecast)
    db_session.commit()

    result = await calculate_best_spot_from_db(db_session)

    assert result is not None
    assert result["site"]["name"] == "Arguel"
    assert result["paraIndex"] == 80


@pytest.mark.asyncio
async def test_calculate_best_spot_from_db_specific_date(db_session, arguel_site):
    """Test best spot calculation for specific date"""

    tomorrow = date.today()

    forecast = WeatherForecast(
        id="test-forecast",
        site_id=arguel_site.id,
        forecast_date=tomorrow,
        para_index=70,
        wind_avg_kmh=12.0,
        verdict="Bon",
        created_at=datetime.now(),
    )
    db_session.add(forecast)
    db_session.commit()

    result = await calculate_best_spot_from_db(db_session, day_index=0)

    assert result is not None
    assert result["paraIndex"] == 70


@pytest.mark.asyncio
async def test_calculate_best_spot_from_db_no_forecasts(db_session):
    """Test best spot from DB with no forecasts"""

    result = await calculate_best_spot_from_db(db_session)

    assert result is None


@pytest.mark.asyncio
async def test_calculate_best_spot_from_db_multiple_sites(db_session, arguel_site, chalais_site):
    """Test best spot selection with multiple sites"""

    # Create forecasts with different para_index values
    forecast1 = WeatherForecast(
        id="forecast-1",
        site_id=arguel_site.id,
        forecast_date=date.today(),
        para_index=60,
        wind_avg_kmh=15.0,
        verdict="Bon",
        created_at=datetime.now(),
    )

    forecast2 = WeatherForecast(
        id="forecast-2",
        site_id=chalais_site.id,
        forecast_date=date.today(),
        para_index=85,  # Higher - should be selected
        wind_avg_kmh=18.0,
        verdict="Excellent",
        created_at=datetime.now(),
    )

    db_session.add_all([forecast1, forecast2])
    db_session.commit()

    result = await calculate_best_spot_from_db(db_session)

    assert result is not None
    assert result["site"]["name"] == "Chalais"  # Higher para_index
    assert result["paraIndex"] == 85


# ============================================================================
# CACHE REFRESH TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_refresh_best_spot_cache_success(db_session):
    """Test refreshing best spot cache"""

    mock_best_spot = {
        "site": {"name": "Arguel", "id": "site-arguel"},
        "paraIndex": 75,
        "score": 75.0,
    }

    mock_set_cached = AsyncMock()

    def mock_cache_ttl():
        return {"summary": 3600}

    with (
        patch(
            "best_spot.calculate_best_spot_from_cache", new=AsyncMock(return_value=mock_best_spot)
        ),
        patch(
            "best_spot._get_cache_functions",
            return_value=(AsyncMock(), mock_set_cached, mock_cache_ttl),
        ),
    ):

        await refresh_best_spot_cache(db_session)

        # Verify cache was set
        mock_set_cached.assert_called_once()


@pytest.mark.asyncio
async def test_refresh_best_spot_cache_no_redis(db_session):
    """Test cache refresh when Redis is not available"""

    mock_best_spot = {"site": {"name": "Arguel"}, "paraIndex": 75}

    with (
        patch(
            "best_spot.calculate_best_spot_from_cache", new=AsyncMock(return_value=mock_best_spot)
        ),
        patch("best_spot._get_cache_functions", return_value=(None, None, None)),
    ):

        # Should not crash when Redis unavailable
        await refresh_best_spot_cache(db_session)


@pytest.mark.asyncio
async def test_refresh_best_spot_cache_no_data(db_session):
    """Test cache refresh when no best spot data available"""

    mock_set_cached = AsyncMock()

    def mock_get_ttl():
        return {"summary": 3600}

    with (
        patch("best_spot.calculate_best_spot_from_cache", new=AsyncMock(return_value=None)),
        patch(
            "best_spot._get_cache_functions",
            return_value=(AsyncMock(), mock_set_cached, mock_get_ttl),
        ),
    ):

        await refresh_best_spot_cache(db_session)

        # Should not set cache when no data
        mock_set_cached.assert_not_called()


# ============================================================================
# EDGE CASES AND ERROR HANDLING
# ============================================================================


def test_parse_wind_direction_all_cardinals():
    """Test all 16 cardinal directions"""
    expected = {
        "N": 0,
        "NNE": 22.5,
        "NE": 45,
        "ENE": 67.5,
        "E": 90,
        "ESE": 112.5,
        "SE": 135,
        "SSE": 157.5,
        "S": 180,
        "SSW": 202.5,
        "SW": 225,
        "WSW": 247.5,
        "W": 270,
        "WNW": 292.5,
        "NW": 315,
        "NNW": 337.5,
    }

    for direction, degrees in expected.items():
        assert parse_wind_direction(direction) == degrees


def test_calculate_angle_difference_extreme_values():
    """Test angle difference with extreme values"""
    # Very small differences
    assert calculate_angle_difference(0, 1) == 1
    assert calculate_angle_difference(359, 0) == 1

    # Maximum difference (180)
    assert calculate_angle_difference(0, 180) == 180
    assert calculate_angle_difference(45, 225) == 180


def test_get_wind_favorability_boundary_speeds():
    """Test wind favorability at speed boundaries"""
    # Just below minimum (bad)
    assert get_wind_favorability("SW", "SW", 4.9) == "bad"

    # Just at minimum (good)
    assert get_wind_favorability("SW", "SW", 5.0) == "good"

    # Just at maximum (good)
    assert get_wind_favorability("SW", "SW", 30.0) == "good"

    # Just above maximum (bad)
    assert get_wind_favorability("SW", "SW", 30.1) == "bad"


def test_get_wind_favorability_boundary_angles():
    """Test wind favorability at angle boundaries"""
    # Just within good range (45 degrees)
    assert get_wind_favorability("N", "NE", 15.0) == "good"

    # Just within moderate range (90 degrees)
    assert get_wind_favorability("N", "E", 15.0) == "moderate"

    # Just outside moderate range (bad)
    # Note: This depends on exact implementation of angle difference


# ============================================================================
# DAY INDEX TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_get_best_spot_cached_day_0():
    """Test fetching best spot for today (day 0)"""
    from best_spot import get_best_spot_cached

    # Mock database
    mock_db = MagicMock()

    # Mock sites
    mock_site = MagicMock(spec=Site)
    mock_site.id = "site-arguel"
    mock_site.name = "Arguel"
    mock_site.code = "arguel"
    mock_site.latitude = 47.2369
    mock_site.longitude = 6.0636
    mock_site.orientation = "W"
    mock_site.rating = 4
    mock_site.elevation_m = 600

    mock_db.query.return_value.all.return_value = [mock_site]

    # Mock weather forecast
    mock_forecast = {
        "success": True,
        "consensus": [{"hour": 12, "wind_speed": 15, "wind_direction": 270}],
    }

    with patch("weather_pipeline.get_normalized_forecast", new_callable=AsyncMock) as mock_weather:
        with patch("para_index.calculate_para_index") as mock_para:
            with patch("best_spot._get_cache_functions") as mock_cache_module:
                # Setup mocks
                mock_weather.return_value = mock_forecast
                mock_para.return_value = {"para_index": 75, "verdict": "BON"}
                mock_cache_module.return_value = (None, None, None)  # No Redis

                # Call function with day_index=0
                result = await get_best_spot_cached(mock_db, day_index=0)

                # Verify
                assert result is not None
                assert result["site"]["name"] == "Arguel"
                assert result["paraIndex"] == 75

                # Verify that get_normalized_forecast was called with day_index=0
                mock_weather.assert_called_once()
                call_args = mock_weather.call_args
                assert call_args[1]["day_index"] == 0


@pytest.mark.asyncio
async def test_get_best_spot_cached_day_3():
    """Test fetching best spot for day 3"""
    from best_spot import get_best_spot_cached

    # Mock database
    mock_db = MagicMock()

    mock_site = MagicMock(spec=Site)
    mock_site.id = "site-arguel"
    mock_site.name = "Arguel"
    mock_site.code = "arguel"
    mock_site.latitude = 47.2369
    mock_site.longitude = 6.0636
    mock_site.orientation = "W"
    mock_site.rating = 4
    mock_site.elevation_m = 600

    mock_db.query.return_value.all.return_value = [mock_site]

    mock_forecast = {
        "success": True,
        "consensus": [{"hour": 12, "wind_speed": 12, "wind_direction": 270}],
    }

    with patch("weather_pipeline.get_normalized_forecast", new_callable=AsyncMock) as mock_weather:
        with patch("para_index.calculate_para_index") as mock_para:
            with patch("best_spot._get_cache_functions") as mock_cache_module:
                mock_weather.return_value = mock_forecast
                mock_para.return_value = {"para_index": 65, "verdict": "MOYEN"}
                mock_cache_module.return_value = (None, None, None)

                # Call with day_index=3
                result = await get_best_spot_cached(mock_db, day_index=3)

                assert result is not None
                assert result["paraIndex"] == 65

                # Verify day_index=3 was passed
                call_args = mock_weather.call_args
                assert call_args[1]["day_index"] == 3


@pytest.mark.asyncio
async def test_cache_key_per_day():
    """Test that each day has its own cache key"""
    from best_spot import get_best_spot_cached

    # Mock database
    mock_db = MagicMock()

    mock_site = MagicMock(spec=Site)
    mock_site.id = "site-arguel"
    mock_site.name = "Arguel"
    mock_site.code = "arguel"
    mock_site.latitude = 47.2369
    mock_site.longitude = 6.0636
    mock_site.orientation = "W"
    mock_site.rating = 4
    mock_site.elevation_m = 600

    mock_db.query.return_value.all.return_value = [mock_site]

    mock_forecast = {
        "success": True,
        "consensus": [{"hour": 12, "wind_speed": 15, "wind_direction": 270}],
    }

    mock_get_cached = AsyncMock(return_value=None)
    mock_set_cached = AsyncMock()

    def cache_ttl():
        return {"summary": 3600}

    with patch("weather_pipeline.get_normalized_forecast", new_callable=AsyncMock) as mock_weather:
        with patch("para_index.calculate_para_index") as mock_para:
            with patch("best_spot._get_cache_functions") as mock_cache_module:
                mock_weather.return_value = mock_forecast
                mock_para.return_value = {"para_index": 75, "verdict": "BON"}
                mock_cache_module.return_value = (mock_get_cached, mock_set_cached, cache_ttl)

                # Fetch day 0
                await get_best_spot_cached(mock_db, day_index=0)

                # Check cache key for day 0
                calls = mock_get_cached.call_args_list
                assert any("best_spot:day_0" in str(call) for call in calls)

                # Reset mock
                mock_get_cached.reset_mock()

                # Fetch day 3
                await get_best_spot_cached(mock_db, day_index=3)

                # Check cache key for day 3
                calls = mock_get_cached.call_args_list
                assert any("best_spot:day_3" in str(call) for call in calls)


@pytest.mark.asyncio
async def test_refresh_cache_only_day_0():
    """Test that scheduler only refreshes day 0 (today)"""
    from best_spot import refresh_best_spot_cache

    # Mock database
    mock_db = MagicMock()

    mock_site = MagicMock(spec=Site)
    mock_site.id = "site-arguel"
    mock_site.name = "Arguel"
    mock_site.code = "arguel"
    mock_site.latitude = 47.2369
    mock_site.longitude = 6.0636
    mock_site.orientation = "W"
    mock_site.rating = 4
    mock_site.elevation_m = 600

    mock_db.query.return_value.all.return_value = [mock_site]

    mock_forecast = {
        "success": True,
        "consensus": [{"hour": 12, "wind_speed": 15, "wind_direction": 270}],
    }

    mock_get_cached = AsyncMock(return_value=None)
    mock_set_cached = AsyncMock()

    def cache_ttl():
        return {"summary": 3600}

    with patch("weather_pipeline.get_normalized_forecast", new_callable=AsyncMock) as mock_weather:
        with patch("para_index.calculate_para_index") as mock_para:
            with patch("best_spot._get_cache_functions") as mock_cache_module:
                mock_weather.return_value = mock_forecast
                mock_para.return_value = {"para_index": 75, "verdict": "BON"}
                mock_cache_module.return_value = (mock_get_cached, mock_set_cached, cache_ttl)

                # Call refresh
                await refresh_best_spot_cache(mock_db)

                # Verify set_cached was called with day_0 key
                mock_set_cached.assert_called_once()
                call_args = mock_set_cached.call_args
                assert call_args[0][0] == "best_spot:day_0"

                # Verify get_normalized_forecast was called with day_index=0
                mock_weather.assert_called_once()
                weather_call_args = mock_weather.call_args
                assert weather_call_args[1]["day_index"] == 0


@pytest.mark.asyncio
async def test_calculate_best_spot_multiple_days_different_results():
    """Test that different days can have different best spots"""
    from best_spot import calculate_best_spot_from_cache

    # Mock database
    mock_db = MagicMock()

    # Create two sites
    site1 = MagicMock(spec=Site)
    site1.id = "site-arguel"
    site1.name = "Arguel"
    site1.code = "arguel"
    site1.latitude = 47.2369
    site1.longitude = 6.0636
    site1.orientation = "W"
    site1.rating = 4
    site1.elevation_m = 600

    site2 = MagicMock(spec=Site)
    site2.id = "site-mont-poupet"
    site2.name = "Mont Poupet"
    site2.code = "mont-poupet"
    site2.latitude = 46.8
    site2.longitude = 5.9
    site2.orientation = "E"
    site2.rating = 5
    site2.elevation_m = 800

    mock_db.query.return_value.all.return_value = [site1, site2]

    # Mock different forecasts for different days
    def mock_weather_func(lat, lon, day_index, **kwargs):
        if day_index == 0:
            # Day 0: Better conditions at Arguel (W wind)
            if lat == site1.latitude:
                return {
                    "success": True,
                    "consensus": [{"hour": 12, "wind_speed": 15, "wind_direction": 270}],  # W
                }
            else:
                return {
                    "success": True,
                    "consensus": [
                        {"hour": 12, "wind_speed": 15, "wind_direction": 270}
                    ],  # W (bad for E site)
                }
        else:  # day_index == 3
            # Day 3: Better conditions at Mont Poupet (E wind)
            if lat == site2.latitude:
                return {
                    "success": True,
                    "consensus": [{"hour": 12, "wind_speed": 15, "wind_direction": 90}],  # E
                }
            else:
                return {
                    "success": True,
                    "consensus": [
                        {"hour": 12, "wind_speed": 15, "wind_direction": 90}
                    ],  # E (bad for W site)
                }

    with patch("weather_pipeline.get_normalized_forecast", new_callable=AsyncMock) as mock_weather:
        with patch("para_index.calculate_para_index") as mock_para:
            mock_weather.side_effect = mock_weather_func
            mock_para.return_value = {"para_index": 70, "verdict": "BON"}

            # Calculate for day 0
            result_day_0 = await calculate_best_spot_from_cache(mock_db, day_index=0)

            # Calculate for day 3
            result_day_3 = await calculate_best_spot_from_cache(mock_db, day_index=3)

            # Both should return results
            assert result_day_0 is not None
            assert result_day_3 is not None

            # The best sites should be different based on wind direction
            # (This test assumes wind favorability logic works correctly)
            # Day 0 with W wind should favor W-oriented site (Arguel)
            # Day 3 with E wind should favor E-oriented site (Mont Poupet)
            assert result_day_0["site"]["name"] == "Arguel"
            assert result_day_3["site"]["name"] == "Mont Poupet"
            assert result_day_0["site"]["name"] != result_day_3["site"]["name"]
