from datetime import date

import httpx
import pytest

from intervals_icu import (
    IntervalsAuthenticationError,
    IntervalsClient,
    IntervalsConfigurationError,
    IntervalsRateLimitError,
)


@pytest.mark.asyncio
async def test_lists_only_zepp_exact_allowed_types_in_ascending_order():
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["oldest"] == "2026-07-01"
        assert request.url.params["newest"] == "2026-07-03"
        assert request.headers["Authorization"].startswith("Basic ")
        return httpx.Response(
            200,
            json=[
                {
                    "id": "2",
                    "name": "Second",
                    "start_date_local": "2026-07-02T12:00:00",
                    "type": "HangGliding",
                    "source": "ZEPP",
                    "icu_original_file_type": "FIT",
                },
                {
                    "id": "1",
                    "name": "First",
                    "start_date_local": "2026-07-01T12:00:00",
                    "type": "HangGliding",
                    "source": "ZEPP",
                    "file_type": "GPX",
                },
                {
                    "id": "wrong-source",
                    "start_date_local": "2026-07-01T12:00:00",
                    "type": "HangGliding",
                    "source": "GARMIN",
                },
                {
                    "id": "wrong-type",
                    "start_date_local": "2026-07-01T12:00:00",
                    "type": "Paragliding",
                    "source": "ZEPP",
                },
            ],
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        client = IntervalsClient("secret", "https://example.test/api/v1", client=http_client)
        activities = await client.list_activities(
            date(2026, 7, 1), date(2026, 7, 3), ["HangGliding"]
        )

    assert [activity.id for activity in activities] == ["1", "2"]
    assert activities[1].file_type == "FIT"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "error"),
    [
        (401, IntervalsAuthenticationError),
        (403, IntervalsAuthenticationError),
        (429, IntervalsRateLimitError),
    ],
)
async def test_maps_actionable_http_errors(status, error):
    transport = httpx.MockTransport(lambda request: httpx.Response(status))
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = IntervalsClient("secret", "https://example.test", client=http_client)
        with pytest.raises(error):
            await client.download_original("activity")


@pytest.mark.asyncio
async def test_rejects_missing_api_key_before_request():
    client = IntervalsClient(None, "https://example.test")
    with pytest.raises(IntervalsConfigurationError):
        await client.download_original("activity")


@pytest.mark.asyncio
async def test_mixed_local_and_utc_activity_dates_sort_consistently():
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json=[
                {
                    "id": "utc",
                    "start_date": "2026-07-01T09:00:00Z",
                    "type": "Other",
                    "source": "ZEPP",
                },
                {
                    "id": "local",
                    "start_date_local": "2026-07-01T12:00:00",
                    "type": "Other",
                    "source": "ZEPP",
                },
            ],
        )
    )
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = IntervalsClient("secret", "https://example.test", client=http_client)
        activities = await client.list_activities(date(2026, 7, 1), date(2026, 7, 2), [])

    assert [activity.id for activity in activities] == ["utc", "local"]
    assert all(activity.start_date.tzinfo is not None for activity in activities)
