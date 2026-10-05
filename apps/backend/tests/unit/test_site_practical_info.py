import json

import httpx
import pytest
from fastapi import HTTPException
from routes import suggest_site_practical_info_endpoint
from schemas import SitePracticalInfoSuggestionRequest

import site_practical_info

SITE = {"name": "Col du Test", "latitude": 45.0, "longitude": 6.0}
SOURCE_URL = "https://example.org/site"


class FakeResponse:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error

    def raise_for_status(self):
        if self.error:
            raise self.error
        return None

    def json(self):
        return self.payload


class FakeAsyncClient:
    def __init__(self, response):
        self.response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, *args, **kwargs):
        return self.response


def make_payload(text, supports):
    return {
        "candidates": [
            {
                "content": {"parts": [{"text": text}]},
                "groundingMetadata": {
                    "groundingChunks": [{"web": {"uri": SOURCE_URL, "title": "Site source"}}],
                    "groundingSupports": supports,
                },
            }
        ]
    }


def support_for(text, cited_text):
    char_start = text.index(cited_text)
    start = len(text[:char_start].encode("utf-8"))
    end = len(text[: char_start + len(cited_text)].encode("utf-8"))
    return {
        "segment": {
            **({"startIndex": start} if start else {}),
            "endIndex": end,
        },
        "groundingChunkIndices": [0],
    }


def mock_gemini(monkeypatch, payload):
    monkeypatch.setattr(site_practical_info.config, "GOOGLE_API_KEY", "test-key")
    monkeypatch.setattr(site_practical_info.config, "GEMINI_MODEL", "test-model")
    monkeypatch.setattr(
        site_practical_info.httpx,
        "AsyncClient",
        lambda **kwargs: FakeAsyncClient(FakeResponse(payload)),
    )


@pytest.mark.asyncio
async def test_returns_suggestion_when_entire_field_is_grounded(monkeypatch):
    text = json.dumps(
        {
            "access": "Parking au décollage.",
            "rules": "",
            "webcam": "",
            "contact": "",
            "hazards": "",
        },
        ensure_ascii=False,
    )
    mock_gemini(monkeypatch, make_payload(text, [support_for(text, "Parking au décollage.")]))

    result = await site_practical_info.suggest_site_practical_info(SITE)

    assert result["suggestions"]["access"] == "Parking au décollage."
    assert result["grounded_result_is_verified"] is True
    assert result["sources"] == [{"title": "Site source", "url": SOURCE_URL}]


@pytest.mark.asyncio
async def test_keeps_grounded_sentence_from_partially_supported_field(monkeypatch):
    first_sentence = "Parking au décollage."
    text = json.dumps(
        {
            "access": f"{first_sentence} Accès interdit par la route privée.",
            "rules": "",
            "webcam": "",
            "contact": "",
            "hazards": "",
        },
        ensure_ascii=False,
    )
    mock_gemini(monkeypatch, make_payload(text, [support_for(text, first_sentence)]))

    result = await site_practical_info.suggest_site_practical_info(SITE)

    assert result["suggestions"]["access"] == first_sentence
    assert first_sentence in result["grounded_result"]
    assert "Accès interdit par la route privée." not in result["grounded_result"]
    assert result["grounded_result_is_verified"] is False


@pytest.mark.asyncio
async def test_does_not_return_uncited_field(monkeypatch):
    text = json.dumps(
        {
            "access": "Parking au décollage.",
            "rules": "",
            "webcam": "",
            "contact": "",
            "hazards": "",
        },
        ensure_ascii=False,
    )
    mock_gemini(monkeypatch, make_payload(text, []))

    result = await site_practical_info.suggest_site_practical_info(SITE)

    assert result["suggestions"]["access"] == ""
    assert result["grounded_result_is_verified"] is False
    assert result["grounded_result"] == ""


@pytest.mark.asyncio
async def test_missing_api_key_returns_configuration_error(monkeypatch):
    monkeypatch.setattr(site_practical_info.config, "GOOGLE_API_KEY", "")

    with pytest.raises(RuntimeError, match="pas configurée"):
        await site_practical_info.suggest_site_practical_info(SITE)


@pytest.mark.asyncio
async def test_invalid_json_returns_actionable_error(monkeypatch):
    mock_gemini(
        monkeypatch,
        make_payload("Je ne peux pas trouver ces informations.", []),
    )

    with pytest.raises(RuntimeError, match="suggestions exploitables"):
        await site_practical_info.suggest_site_practical_info(SITE)


@pytest.mark.asyncio
async def test_endpoint_returns_503_when_api_key_is_missing(monkeypatch):
    monkeypatch.setattr(site_practical_info.config, "GOOGLE_API_KEY", "")
    request = SitePracticalInfoSuggestionRequest(**SITE)

    with pytest.raises(HTTPException) as error:
        await suggest_site_practical_info_endpoint(request)

    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_endpoint_returns_503_when_gemini_fails(monkeypatch):
    monkeypatch.setattr(site_practical_info.config, "GOOGLE_API_KEY", "test-key")
    monkeypatch.setattr(site_practical_info.config, "GEMINI_MODEL", "test-model")
    request_error = httpx.RequestError(
        "Gemini unavailable", request=httpx.Request("POST", "https://example.org")
    )
    monkeypatch.setattr(
        site_practical_info.httpx,
        "AsyncClient",
        lambda **kwargs: FakeAsyncClient(FakeResponse(error=request_error)),
    )
    request = SitePracticalInfoSuggestionRequest(**SITE)

    with pytest.raises(HTTPException) as error:
        await suggest_site_practical_info_endpoint(request)

    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_endpoint_returns_grounded_sentences(monkeypatch):
    sentence = "Parking au décollage."
    text = json.dumps(
        {
            "access": f"{sentence} Information sans source.",
            "rules": "",
            "webcam": "",
            "contact": "",
            "hazards": "",
        },
        ensure_ascii=False,
    )
    mock_gemini(monkeypatch, make_payload(text, [support_for(text, sentence)]))
    request = SitePracticalInfoSuggestionRequest(**SITE)

    response = await suggest_site_practical_info_endpoint(request)

    assert response.suggestions.access == sentence
    assert response.grounded_result_is_verified is False


@pytest.mark.asyncio
async def test_endpoint_returns_empty_suggestions_when_response_is_ungrounded(monkeypatch):
    text = json.dumps(
        {
            "access": "Parking au décollage.",
            "rules": "",
            "webcam": "",
            "contact": "",
            "hazards": "",
        },
        ensure_ascii=False,
    )
    mock_gemini(monkeypatch, make_payload(text, []))
    request = SitePracticalInfoSuggestionRequest(**SITE)

    response = await suggest_site_practical_info_endpoint(request)

    assert response.suggestions.access == ""
    assert response.grounded_result_is_verified is False
