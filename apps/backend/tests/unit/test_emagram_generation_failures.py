from typing import Any

import pytest

import emagram_multi_source as emagram
from llm.exceptions import QuotaExhaustedError
from models import EmagramAnalysis, Site


def _site(site_id: str = "site-emagram-failure") -> Site:
    return Site(
        id=site_id,
        code="EGF",
        name="Emagram Failure Site",
        latitude=47.0,
        longitude=6.0,
        elevation_m=500,
    )


@pytest.mark.asyncio
async def test_generation_persists_failed_analysis_when_screenshots_fail(
    db_session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    site = _site()
    db_session.add(site)
    db_session.commit()

    async def fail_screenshots(**_kwargs: Any) -> dict[str, Any]:
        return {
            "success": False,
            "error": "all sources timed out",
            "screenshots": [
                {
                    "source": "meteo-parapente",
                    "success": False,
                    "error": "timeout",
                }
            ],
        }

    monkeypatch.setattr(emagram, "fetch_all_emagram_screenshots", fail_screenshots)

    result = await emagram.generate_multi_source_emagram_for_spot(
        site_id=site.id,
        db=db_session,
        day_index=0,
        hour=14,
    )

    assert result["success"] is False
    assert result["analysis_id"]

    analysis = db_session.get(EmagramAnalysis, result["analysis_id"])
    assert analysis is not None
    assert analysis.analysis_status == "failed"
    assert analysis.forecast_hour == 14
    assert analysis.error_message == "Failed to fetch emagram screenshots"
    assert "meteo-parapente" in (analysis.sources_errors or "")


@pytest.mark.asyncio
async def test_generation_persists_failed_analysis_when_llm_quota_is_exhausted(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    site = _site("site-emagram-quota")
    db_session.add(site)
    db_session.commit()

    async def successful_screenshots(**_kwargs: Any) -> dict[str, Any]:
        return {
            "success": True,
            "screenshots": [
                {
                    "source": "meteociel",
                    "success": True,
                    "image_path": "/tmp/emagram.png",
                    "external_url": "https://example.test/emagram",
                }
            ],
            "sources_successful": 1,
        }

    def quota_exhausted(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise QuotaExhaustedError("provider quota")

    monkeypatch.setattr(emagram, "fetch_all_emagram_screenshots", successful_screenshots)
    monkeypatch.setattr(emagram, "_analyze_emagram_with_fallbacks", quota_exhausted)

    result = await emagram.generate_multi_source_emagram_for_spot(
        site_id=site.id,
        db=db_session,
        day_index=0,
        hour=12,
    )

    assert result["success"] is False
    assert result["analysis_id"]

    response = client.get(f"/api/emagram/latest?site_id={site.id}&hour=12")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == result["analysis_id"]
    assert data["analysis_status"] == "failed"
    assert data["error_message"] == "LLM quota exhausted: provider quota"
