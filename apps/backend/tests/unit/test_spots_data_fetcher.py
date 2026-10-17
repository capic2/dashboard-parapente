"""Tests for external paragliding spot data fetching."""

from unittest.mock import Mock

import pytest

from spots import data_fetcher


@pytest.mark.unit
def test_fetch_openaip_data_uses_api_key_and_follows_pages(monkeypatch) -> None:
    monkeypatch.setattr(data_fetcher, "OPENAIP_API_KEY", "test-openaip-key")
    first_page = Mock()
    first_page.json.return_value = {
        "items": [
            None,
            {
                "_id": "north-launch",
                "name": "Saint-Hilaire Nord",
                "type": 0,
                "country": "FR",
                "geometry": {"coordinates": [5.88828, 45.30702]},
                "elevation": {"value": 950},
            },
        ],
        "nextPage": 2,
    }
    second_page = Mock()
    second_page.json.return_value = {
        "items": [
            {
                "_id": "lumbin-landing",
                "name": "Lumbin",
                "type": 1,
                "country": "FR",
                "geometry": {"coordinates": [5.927, 45.311]},
                "elevation": {"value": 220},
            }
        ],
        "nextPage": None,
    }
    request = Mock(side_effect=[first_page, second_page])
    monkeypatch.setattr(data_fetcher.requests, "get", request)

    spots = data_fetcher.fetch_openaip_data()

    assert len(spots) == 2
    assert spots[0]["id"] == "openaip_north-launch"
    assert spots[0]["type"] == "takeoff"
    assert spots[0]["latitude"] == pytest.approx(45.30702)
    assert spots[0]["longitude"] == pytest.approx(5.88828)
    assert spots[0]["elevation_m"] == 950
    assert spots[1]["type"] == "landing"
    assert spots[1]["elevation_m"] == 220
    assert request.call_count == 2
    assert request.call_args_list[0].kwargs["headers"] == {"x-openaip-api-key": "test-openaip-key"}
    assert request.call_args_list[0].kwargs["params"] == [
        ("country", "FR"),
        ("page", "1"),
        ("limit", "1000"),
        ("type", "0"),
        ("type", "1"),
        ("category", "0"),
    ]
    assert ("page", "2") in request.call_args_list[1].kwargs["params"]


@pytest.mark.unit
def test_fetch_openaip_data_skips_request_without_api_key(monkeypatch) -> None:
    monkeypatch.setattr(data_fetcher, "OPENAIP_API_KEY", None)
    request = Mock()
    monkeypatch.setattr(data_fetcher.requests, "get", request)

    assert data_fetcher.fetch_openaip_data() == []
    request.assert_not_called()


@pytest.mark.unit
def test_parse_openaip_spot_handles_null_name_and_id() -> None:
    spot = data_fetcher._parse_openaip_spot(
        {
            "_id": None,
            "name": None,
            "type": 0,
            "country": "FR",
            "geometry": {"coordinates": [5.88828, 45.30702]},
            "elevation": {"value": 950},
        }
    )

    assert spot is not None
    assert spot["name"] == ""
    assert spot["id"].startswith("openaip_")
    assert spot["elevation_m"] == 950


@pytest.mark.unit
def test_fetch_openaip_data_retries_failed_page(monkeypatch) -> None:
    monkeypatch.setattr(data_fetcher, "OPENAIP_API_KEY", "test-openaip-key")
    response = Mock()
    response.json.return_value = {"items": [], "nextPage": None}
    request = Mock(side_effect=[data_fetcher.requests.ConnectionError("temporary"), response])
    monkeypatch.setattr(data_fetcher.requests, "get", request)

    assert data_fetcher.fetch_openaip_data(fail_on_error=True) == []
    assert request.call_count == 2


@pytest.mark.unit
def test_sync_stops_if_openaip_page_still_fails_after_retry(monkeypatch) -> None:
    monkeypatch.setattr(data_fetcher, "OPENAIP_API_KEY", "test-openaip-key")
    request = Mock(side_effect=data_fetcher.requests.ConnectionError("unavailable"))
    monkeypatch.setattr(data_fetcher.requests, "get", request)
    fetch_paraglidingspots = Mock()
    monkeypatch.setattr(data_fetcher, "fetch_paraglidingspots_data", fetch_paraglidingspots)

    with pytest.raises(data_fetcher.OpenAIPFetchError, match="after retry"):
        data_fetcher.sync_to_database(Mock())

    assert request.call_count == 2
    fetch_paraglidingspots.assert_not_called()
