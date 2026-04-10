"""
Tests for Strava API Integration (strava.py)

Coverage:
- Token refresh and management
- GPX download from Strava API
- Stream to GPX conversion
- GPX parsing and data extraction
- Activity details fetching

Strategy:
- Mock all external HTTP calls (Strava API)
- Test token caching and expiration
- Test GPX conversion logic
- Test error handling
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from strava import (
    download_gpx,
    get_access_token,
    get_activities_by_period,
    get_activity_details,
    parse_gpx,
    refresh_access_token,
    streams_to_gpx,
)

# ============================================================================
# TOKEN REFRESH TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_refresh_access_token_success():
    """Test successful token refresh"""

    mock_response = {
        "access_token": "new_access_token_123",
        "refresh_token": "new_refresh_token_456",
        "expires_at": int((datetime.now() + timedelta(hours=6)).timestamp()),
    }

    with (
        patch("strava.STRAVA_CLIENT_ID", "test_client_id"),
        patch("strava.STRAVA_CLIENT_SECRET", "test_secret"),
        patch("strava.STRAVA_REFRESH_TOKEN", "test_refresh_token"),
        patch("strava.httpx.AsyncClient") as mock_client,
    ):

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(status_code=200, json=MagicMock(return_value=mock_response))
        )

        # Reset global token state
        import strava

        strava._access_token = None
        strava._token_expires_at = None

        token = await refresh_access_token()

        assert token == "new_access_token_123"
        assert strava._access_token == "new_access_token_123"
        assert strava._refresh_token == "new_refresh_token_456"
        assert strava._token_expires_at is not None


@pytest.mark.asyncio
async def test_refresh_access_token_ignores_persist_failure(caplog):
    """Test token refresh still works if token persistence fails"""

    mock_response = {
        "access_token": "fallback_access_token",
        "refresh_token": "fallback_refresh_token",
        "expires_at": int((datetime.now() + timedelta(hours=6)).timestamp()),
    }

    with (
        patch("strava.STRAVA_CLIENT_ID", "test_client_id"),
        patch("strava.STRAVA_CLIENT_SECRET", "test_secret"),
        patch("strava.STRAVA_REFRESH_TOKEN", "test_refresh_token"),
        patch("strava._persist_refresh_token") as mock_persist,
        patch("strava.httpx.AsyncClient") as mock_client,
    ):
        mock_persist.side_effect = RuntimeError("no such table: app_settings")

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(status_code=200, json=MagicMock(return_value=mock_response))
        )

        import strava

        strava._access_token = None
        strava._token_expires_at = None

        with caplog.at_level("WARNING"):
            token = await refresh_access_token()

        assert token == "fallback_access_token"
        assert strava._access_token == "fallback_access_token"
        assert strava._refresh_token == "fallback_refresh_token"
        assert mock_persist.call_count == 1
        assert any("Could not persist refresh token" in record.message for record in caplog.records)


@pytest.mark.asyncio
async def test_refresh_access_token_uses_cached():
    """Test that cached token is used when still valid"""

    import strava

    # Set a valid token
    strava._access_token = "cached_token"
    strava._token_expires_at = datetime.now() + timedelta(hours=1)

    # Should not make HTTP call
    token = await refresh_access_token()

    assert token == "cached_token"


@pytest.mark.asyncio
async def test_refresh_access_token_missing_credentials():
    """Test token refresh with missing credentials"""

    import strava

    strava._access_token = None
    strava._token_expires_at = None

    with patch("strava.STRAVA_REFRESH_TOKEN", None):
        token = await refresh_access_token()
        assert token is None


@pytest.mark.asyncio
async def test_refresh_access_token_http_error():
    """Test token refresh with HTTP error"""

    import strava

    strava._access_token = None
    strava._token_expires_at = None

    with patch("strava.httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_response.raise_for_status.side_effect = Exception("HTTP 401")

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )

        token = await refresh_access_token()
        assert token is None


@pytest.mark.asyncio
async def test_get_access_token():
    """Test get_access_token delegates to refresh_access_token"""

    with patch("strava.refresh_access_token", new=AsyncMock(return_value="test_token")):
        token = await get_access_token()
        assert token == "test_token"


# ============================================================================
# GPX DOWNLOAD TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_download_gpx_success():
    """Test successful GPX download"""

    mock_streams = {
        "latlng": {"data": [[47.2, 6.0], [47.21, 6.01]]},
        "altitude": {"data": [800, 850]},
        "time": {"data": [0, 60]},
    }

    with (
        patch("strava.get_access_token", new=AsyncMock(return_value="test_token")),
        patch("strava.httpx.AsyncClient") as mock_client,
    ):

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=MagicMock(
                status_code=200,
                json=MagicMock(return_value=mock_streams),
                raise_for_status=MagicMock(),
            )
        )

        gpx_content = await download_gpx("123456")

        assert gpx_content is not None
        assert "<gpx" in gpx_content
        assert "47.2" in gpx_content
        assert "800" in gpx_content


@pytest.mark.asyncio
async def test_download_gpx_no_token():
    """Test GPX download without access token"""

    with patch("strava.get_access_token", new=AsyncMock(return_value=None)):
        gpx_content = await download_gpx("123456")
        assert gpx_content is None


@pytest.mark.asyncio
async def test_download_gpx_http_error():
    """Test GPX download with HTTP error"""

    with (
        patch("strava.get_access_token", new=AsyncMock(return_value="test_token")),
        patch("strava.httpx.AsyncClient") as mock_client,
    ):

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            side_effect=Exception("Network error")
        )

        gpx_content = await download_gpx("123456")
        assert gpx_content is None


# ============================================================================
# STREAMS TO GPX CONVERSION TESTS
# ============================================================================


def test_streams_to_gpx_basic():
    """Test basic streams to GPX conversion"""

    streams = {
        "latlng": {"data": [[47.2, 6.0], [47.21, 6.01]]},
        "altitude": {"data": [800, 850]},
        "time": {"data": [0, 60]},
    }

    gpx_content = streams_to_gpx(streams, "123456")

    assert gpx_content is not None
    assert "<gpx" in gpx_content
    assert 'version="1.1"' in gpx_content
    assert "<trk>" in gpx_content
    assert "<trkpt" in gpx_content
    assert 'lat="47.2"' in gpx_content
    assert 'lon="6.0"' in gpx_content
    assert "<ele>800</ele>" in gpx_content or "<ele>800.0</ele>" in gpx_content


def test_streams_to_gpx_missing_data():
    """Test streams to GPX with missing data"""

    streams = {"latlng": {"data": [[47.2, 6.0]]}}

    gpx_content = streams_to_gpx(streams, "123")

    assert gpx_content is not None
    assert "<gpx" in gpx_content
    # Should handle missing altitude gracefully


def test_streams_to_gpx_empty():
    """Test streams to GPX with empty data"""

    streams = {}

    gpx_content = streams_to_gpx(streams, "123")

    assert gpx_content is not None
    assert "<gpx" in gpx_content
    # Should create valid but empty GPX


# ============================================================================
# GPX PARSING TESTS
# ============================================================================


def test_parse_gpx_success():
    """Test successful GPX parsing"""

    gpx_content = """<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="47.2" lon="6.0">
        <ele>800</ele>
        <time>2025-09-27T10:00:00Z</time>
      </trkpt>
      <trkpt lat="47.21" lon="6.01">
        <ele>850</ele>
        <time>2025-09-27T10:01:00Z</time>
      </trkpt>
      <trkpt lat="47.22" lon="6.02">
        <ele>900</ele>
        <time>2025-09-27T10:02:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>"""

    result = parse_gpx(gpx_content)

    assert result["success"] is True
    assert len(result["coordinates"]) == 3
    assert result["max_altitude_m"] == 900
    assert result["first_trackpoint"]["lat"] == 47.2
    assert result["first_trackpoint"]["lon"] == 6.0
    assert result["first_trackpoint"]["elevation"] == 800


def test_parse_gpx_no_namespace():
    """Test GPX parsing without namespace"""

    gpx_content = """<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="47.2" lon="6.0">
        <ele>800</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>"""

    result = parse_gpx(gpx_content)

    assert result["success"] is True
    assert len(result["coordinates"]) == 1


def test_parse_gpx_calculates_elevation_gain():
    """Test GPX parsing calculates elevation gain"""

    gpx_content = """<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="47.2" lon="6.0"><ele>800</ele></trkpt>
      <trkpt lat="47.21" lon="6.01"><ele>850</ele></trkpt>
      <trkpt lat="47.22" lon="6.02"><ele>840</ele></trkpt>
      <trkpt lat="47.23" lon="6.03"><ele>900</ele></trkpt>
    </trkseg>
  </trk>
</gpx>"""

    result = parse_gpx(gpx_content)

    assert result["success"] is True
    # Elevation gain = (850-800) + (900-840) = 50 + 60 = 110
    assert result["elevation_gain_m"] == pytest.approx(110, abs=1)


def test_parse_gpx_invalid_xml():
    """Test GPX parsing with invalid XML"""

    gpx_content = "Not valid XML"

    result = parse_gpx(gpx_content)

    assert result["success"] is False
    assert "error" in result


def test_parse_gpx_no_trackpoints():
    """Test GPX parsing with no trackpoints"""

    gpx_content = """<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <trkseg>
    </trkseg>
  </trk>
</gpx>"""

    result = parse_gpx(gpx_content)

    # parse_gpx returns success=False when no elevation data
    assert result["success"] is False
    assert "error" in result


# ============================================================================
# ACTIVITY DETAILS TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_get_activity_details_success():
    """Test fetching activity details"""

    mock_activity = {
        "id": 123456,
        "name": "Morning Flight",
        "type": "Flight",
        "distance": 15000,
        "elapsed_time": 3600,
        "total_elevation_gain": 450,
        "start_date_local": "2025-09-27T10:00:00Z",
    }

    with (
        patch("strava.get_access_token", new=AsyncMock(return_value="test_token")),
        patch("strava.httpx.AsyncClient") as mock_client,
    ):

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=MagicMock(
                status_code=200,
                json=MagicMock(return_value=mock_activity),
                raise_for_status=MagicMock(),
            )
        )

        activity = await get_activity_details("123456")

        assert activity is not None
        assert activity["id"] == 123456
        assert activity["name"] == "Morning Flight"
        assert activity["distance"] == 15000


@pytest.mark.asyncio
async def test_get_activity_details_no_token():
    """Test activity details without token"""

    with patch("strava.get_access_token", new=AsyncMock(return_value=None)):
        activity = await get_activity_details("123456")
        assert activity is None


@pytest.mark.asyncio
async def test_get_activity_details_http_error():
    """Test activity details with HTTP error"""

    with (
        patch("strava.get_access_token", new=AsyncMock(return_value="test_token")),
        patch("strava.httpx.AsyncClient") as mock_client,
    ):

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            side_effect=Exception("API error")
        )

        activity = await get_activity_details("123456")
        assert activity is None


# ============================================================================
# EDGE CASES AND ERROR HANDLING
# ============================================================================


def test_parse_gpx_missing_elevation():
    """Test GPX parsing with missing elevation data"""

    gpx_content = """<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="47.2" lon="6.0"></trkpt>
      <trkpt lat="47.21" lon="6.01"></trkpt>
    </trkseg>
  </trk>
</gpx>"""

    result = parse_gpx(gpx_content)

    assert result["success"] is True
    assert len(result["coordinates"]) == 2
    # Should default to 0 elevation


def test_parse_gpx_single_trackpoint():
    """Test GPX parsing with single trackpoint"""

    gpx_content = """<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="47.2" lon="6.0"><ele>800</ele></trkpt>
    </trkseg>
  </trk>
</gpx>"""

    result = parse_gpx(gpx_content)

    assert result["success"] is True
    assert len(result["coordinates"]) == 1
    assert result["elevation_gain_m"] == 0  # No gain with single point


@pytest.mark.asyncio
async def test_refresh_access_token_expired():
    """Test token refresh when token is expired"""

    import strava

    # Set an expired token
    strava._access_token = "old_token"
    strava._token_expires_at = datetime.now() - timedelta(hours=1)

    mock_response = {
        "access_token": "refreshed_token",
        "refresh_token": "new_refresh",
        "expires_at": int((datetime.now() + timedelta(hours=6)).timestamp()),
    }

    with (
        patch("strava.STRAVA_CLIENT_ID", "test_client_id"),
        patch("strava.STRAVA_CLIENT_SECRET", "test_secret"),
        patch("strava.STRAVA_REFRESH_TOKEN", "test_refresh_token"),
        patch("strava.httpx.AsyncClient") as mock_client,
    ):

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=MagicMock(
                status_code=200,
                json=MagicMock(return_value=mock_response),
                raise_for_status=MagicMock(),
            )
        )

        token = await refresh_access_token()

        assert token == "refreshed_token"
        assert strava._access_token == "refreshed_token"


def test_streams_to_gpx_mismatched_arrays():
    """Test streams to GPX with mismatched array lengths"""

    streams = {
        "latlng": {"data": [[47.2, 6.0], [47.21, 6.01], [47.22, 6.02]]},
        "altitude": {"data": [800, 850]},  # Shorter than latlng
        "time": {"data": [0]},  # Even shorter
    }

    gpx_content = streams_to_gpx(streams, "123")

    assert gpx_content is not None
    assert "<trkpt" in gpx_content
    # Should handle mismatched lengths gracefully


# ============================================================================
# GET ACTIVITIES BY PERIOD TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_get_activities_by_period_end_date_is_inclusive():
    """Test that date_to is inclusive: before timestamp should be midnight of the next day"""

    mock_activity = {
        "id": 999,
        "name": "Evening Flight",
        "type": "Workout",
        "start_date_local": "2026-03-15T18:00:00Z",
    }

    captured_params = {}

    async def mock_get(url, **kwargs):
        if not captured_params:
            captured_params.update(kwargs.get("params", {}))
            return MagicMock(
                status_code=200,
                json=MagicMock(return_value=[mock_activity]),
                raise_for_status=MagicMock(),
            )
        return MagicMock(
            status_code=200,
            json=MagicMock(return_value=[]),
            raise_for_status=MagicMock(),
        )

    with (
        patch("strava.get_access_token", new=AsyncMock(return_value="test_token")),
        patch("strava.httpx.AsyncClient") as mock_client,
    ):
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=mock_get)

        await get_activities_by_period("2026-03-01", "2026-03-15")

    # "before" should be 2026-03-16 00:00:00, not 2026-03-15 00:00:00
    expected_before = int(datetime(2026, 3, 16).timestamp())
    expected_after = int(datetime(2026, 3, 1).timestamp())

    assert captured_params["after"] == expected_after
    assert captured_params["before"] == expected_before
