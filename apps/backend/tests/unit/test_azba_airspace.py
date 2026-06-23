import asyncio
from datetime import datetime, timezone

import httpx

import azba_airspace


def test_evaluate_site_azba_constraints_blocks_near_active_zone(monkeypatch):
    azba_airspace._CACHE.clear()

    async def fake_current_range():
        return {"rtba": "2026-06-16"}

    async def fake_active_zones(start, end, latest_azba_date):
        return {
            "hydra:member": [
                {
                    "id": "rtba-near",
                    "name": "RTBA TEST",
                    "valDistVerLower": 0,
                    "uomDistVerLower": "FT",
                    "valDistVerUpper": 4500,
                    "uomDistVerUpper": "FT",
                    "timeSlots": [
                        {
                            "startTime": "2026-06-16T08:00:00Z",
                            "endTime": "2026-06-16T10:00:00Z",
                        }
                    ],
                    "coordinates": [
                        {"latitude": "471200N", "longitude": "0060000E"},
                        {"latitude": "471236N", "longitude": "0060000E"},
                        {"latitude": "471236N", "longitude": "0060036E"},
                    ],
                },
                {
                    "id": "rtba-far",
                    "name": "RTBA FAR",
                    "coordinates": [{"latitude": 44.0, "longitude": 2.0}],
                },
            ]
        }

    monkeypatch.setattr(azba_airspace, "_get_current_range", fake_current_range)
    monkeypatch.setattr(azba_airspace, "_get_active_zones", fake_active_zones)

    result = asyncio.run(
        azba_airspace.evaluate_site_azba_constraints(
            site_id="site-arguel",
            site_name="Arguel",
            site_lat=47.2,
            site_lon=6.0,
            start=datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            end=datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            radius_km=10,
        )
    )

    assert result["status"] == "blocking"
    assert result["latest_azba_date"] == "2026-06-16"
    assert [constraint["id"] for constraint in result["constraints"]] == ["rtba-near"]
    assert result["constraints"][0]["distance_km"] == 0
    assert result["constraints"][0]["geometry"]["type"] == "Polygon"


def test_evaluate_site_azba_constraints_returns_clear_without_near_zone(monkeypatch):
    azba_airspace._CACHE.clear()

    async def fake_current_range():
        return {"rtba": "2026-06-16"}

    async def fake_active_zones(start, end, latest_azba_date):
        return {
            "hydra:member": [
                {
                    "id": "rtba-far",
                    "coordinates": [{"latitude": 44.0, "longitude": 2.0}],
                }
            ]
        }

    monkeypatch.setattr(azba_airspace, "_get_current_range", fake_current_range)
    monkeypatch.setattr(azba_airspace, "_get_active_zones", fake_active_zones)

    result = asyncio.run(
        azba_airspace.evaluate_site_azba_constraints(
            site_id="site-arguel",
            site_name="Arguel",
            site_lat=47.2,
            site_lon=6.0,
            start=datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            end=datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            radius_km=10,
        )
    )

    assert result["status"] == "clear"
    assert result["constraints"] == []


def test_evaluate_site_azba_constraints_returns_unknown_on_source_error(monkeypatch):
    azba_airspace._CACHE.clear()

    async def fake_current_range():
        raise azba_airspace.AzbaClientError("SIA unavailable")

    monkeypatch.setattr(azba_airspace, "_get_current_range", fake_current_range)

    result = asyncio.run(
        azba_airspace.evaluate_site_azba_constraints(
            site_id="site-arguel",
            site_name="Arguel",
            site_lat=47.2,
            site_lon=6.0,
            start=datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            end=datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            radius_km=10,
        )
    )

    assert result["status"] == "unknown"
    assert result["message"]
    assert azba_airspace._CACHE == {}


def test_get_active_zones_uses_sia_v3_interval_params(monkeypatch):
    captured = {}

    async def fake_get_json(path_with_query):
        captured["path_with_query"] = path_with_query
        return {"items": []}

    monkeypatch.setattr(azba_airspace, "_get_json", fake_get_json)

    asyncio.run(
        azba_airspace._get_active_zones(
            datetime(2026, 6, 16, 8, tzinfo=timezone.utc),
            datetime(2026, 6, 16, 12, tzinfo=timezone.utc),
            "2026-06-16",
        )
    )

    assert captured["path_with_query"].startswith("v3/r_t_b_as?")
    assert "itemsPerPage=600" in captured["path_with_query"]
    assert "debutIntervalTemps=2026-06-16T08%3A00%3A00.000Z" in captured["path_with_query"]
    assert "finIntervalTemps=2026-06-16T12%3A00%3A00.000Z" in captured["path_with_query"]
    assert "timeSlots" not in captured["path_with_query"]


def test_extract_coordinates_supports_sia_dms_coordinates():
    assert azba_airspace._extract_coordinates(
        {"coordinates": [{"latitude": "470438.00N", "longitude": "0034000.00E"}]}
    ) == [(47.077222222222225, 3.6666666666666665)]


def test_extract_azba_public_app_script_url():
    assert (
        azba_airspace._extract_azba_public_app_script_url(
            '<script src="runtime.123.js" type="module"></script>'
            '<script src="main.35bcb85181c01b05.js" type="module"></script>'
        )
        == "https://www.sia.aviation-civile.gouv.fr/azbaEx/main.35bcb85181c01b05.js"
    )


def test_extract_azba_public_auth_secret():
    assert (
        azba_airspace._extract_azba_public_auth_secret(
            'baseUrl:"https://bo-prod-sofia-vac.sia-france.fr/api/",share_secret:"public-signature"'
        )
        == "public-signature"
    )


def test_get_json_retries_once_after_cached_public_auth_failure(monkeypatch):
    request = httpx.Request(
        "GET", "https://bo-prod-sofia-vac.sia-france.fr/api/v3/custom/currentDate"
    )
    api_call_count = {"value": 0}

    class FakeResponse:
        def __init__(self, status_code, *, text="", payload=None):
            self.status_code = status_code
            self.text = text
            self._payload = payload
            self.request = request

        def raise_for_status(self):
            if self.status_code >= 400:
                raise httpx.HTTPStatusError("error", request=self.request, response=self)

        def json(self):
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return False

        async def get(self, url, headers=None):
            if url == azba_airspace.AZBA_PUBLIC_APP_URL:
                return FakeResponse(
                    200,
                    text='<script src="main.35bcb85181c01b05.js" type="module"></script>',
                )
            if url.endswith("/azbaEx/main.35bcb85181c01b05.js"):
                return FakeResponse(200, text='share_secret:"fresh-public-signature"')

            api_call_count["value"] += 1
            if api_call_count["value"] == 1:
                return FakeResponse(401)
            expected_auth = azba_airspace._build_auth_header(
                "v3/custom/currentDate", "fresh-public-signature"
            )["AUTH"]
            assert headers and headers["AUTH"] == expected_auth
            return FakeResponse(200, payload={"rtba": "2026-06-16"})

    monkeypatch.setattr(azba_airspace.config, "AZBA_API_AUTH_SECRET", None)
    monkeypatch.setattr(azba_airspace.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(azba_airspace, "_AZBA_API_AUTH_SECRET_CACHE", "stale-public-signature")

    result = asyncio.run(azba_airspace._get_json("v3/custom/currentDate"))

    assert result == {"rtba": "2026-06-16"}
    assert api_call_count["value"] == 2
    assert azba_airspace._AZBA_API_AUTH_SECRET_CACHE == "fresh-public-signature"
