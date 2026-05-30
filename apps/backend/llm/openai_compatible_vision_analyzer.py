"""Generic OpenAI-compatible vision analyzer for emagram screenshots."""

from __future__ import annotations

import base64
import json
import logging
import mimetypes
from pathlib import Path
from typing import Any

import httpx

from llm.emagram_prompt import build_emagram_analysis_prompt, normalize_analysis_locale
from llm.exceptions import QuotaExhaustedError
from llm.screenshot_inputs import ScreenshotInput, normalize_screenshot_inputs

logger = logging.getLogger(__name__)


def analyze_emagram_with_openai_compatible(
    *,
    screenshot_paths: list[ScreenshotInput],
    spot_name: str,
    coordinates: tuple[float, float],
    api_key: str,
    base_url: str,
    provider_name: str,
    model_name: str,
    locale: str | None = None,
    max_retries: int = 2,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Analyze screenshots through an OpenAI-compatible chat completions endpoint."""
    if not api_key:
        raise RuntimeError(f"{provider_name} API key not configured")
    if not base_url:
        raise RuntimeError(f"{provider_name} base URL not configured")

    logger.info(f"Analyzing emagram for {spot_name} using {provider_name} {model_name}")
    content = _build_message_content(screenshot_paths, spot_name, coordinates, locale)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        **(extra_headers or {}),
    }
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": content}],
        "temperature": 0.2,
        "max_tokens": 3000,
    }
    last_error = None

    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(base_url, headers=headers, json=payload)

            if response.status_code in {402, 429}:
                raise QuotaExhaustedError(
                    f"{provider_name} quota exhausted: HTTP {response.status_code}"
                )
            if response.status_code >= 400:
                raise RuntimeError(
                    f"{provider_name} API error HTTP {response.status_code}: "
                    f"{response.text[:500]}"
                )

            data = response.json()
            raw_text = data["choices"][0]["message"].get("content") or ""
            result = _parse_response(raw_text, provider_name)
            if isinstance(result.get("explication_analyse"), dict):
                result["explication_analyse"].setdefault(
                    "locale", normalize_analysis_locale(locale)
                )

            usage = data.get("usage") or {}
            prompt_tokens = usage.get("prompt_tokens") or 0
            completion_tokens = usage.get("completion_tokens") or 0
            total_tokens = usage.get("total_tokens") or (prompt_tokens + completion_tokens)
            result["llm_provider"] = provider_name
            result["llm_model"] = model_name
            result["llm_tokens_used"] = total_tokens
            result["llm_cost_usd"] = None

            logger.info(f"{provider_name} analysis successful (attempt {attempt + 1})")
            return result
        except QuotaExhaustedError:
            raise
        except Exception as e:
            last_error = e
            error_msg = str(e).lower()
            if any(kw in error_msg for kw in ["429", "quota", "rate_limit", "rate limit"]):
                raise QuotaExhaustedError(f"{provider_name} quota exhausted: {e}") from e
            logger.warning(f"{provider_name} attempt {attempt + 1} failed: {e}")

    raise RuntimeError(
        f"{provider_name} analysis failed after {max_retries} attempts: {last_error}"
    )


def _build_message_content(
    screenshot_paths: list[ScreenshotInput],
    spot_name: str,
    coordinates: tuple[float, float],
    locale: str | None,
) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = []
    screenshots = normalize_screenshot_inputs(screenshot_paths)
    lat, lon = coordinates
    source_lines = "\n".join(
        f"- Image {index}: source `{screenshot['source']}`"
        for index, screenshot in enumerate(screenshots, start=1)
    )
    content.append(
        {
            "type": "text",
            "text": build_emagram_analysis_prompt(
                spot_name=spot_name,
                lat=lat,
                lon=lon,
                source_lines=source_lines,
                image_count=len(screenshots),
                locale=locale,
            ),
        }
    )

    image_count = 0
    for screenshot in screenshots:
        path = screenshot["path"]
        image_path = Path(path)
        if not image_path.exists():
            logger.warning(f"Image not found: {path}")
            continue

        mime_type = mimetypes.guess_type(image_path.name)[0] or "image/png"
        try:
            img_data = base64.b64encode(image_path.read_bytes()).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{img_data}"},
                }
            )
            image_count += 1
        except Exception as e:
            logger.warning(f"Failed to encode {path}: {e}")

    if image_count == 0:
        raise RuntimeError("No valid images to analyze")

    return content


def _parse_response(response_text: str, provider_name: str) -> dict[str, Any]:
    text = response_text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0]

    try:
        result = json.loads(text.strip())
    except json.JSONDecodeError as e:
        raise RuntimeError(f"{provider_name} returned invalid JSON: {e}") from e

    required = [
        "plafond_thermique_m",
        "force_thermique_ms",
        "heures_volables",
        "score_volabilite",
        "conseils_vol",
        "alertes_securite",
        "details_analyse",
    ]
    missing = [field for field in required if field not in result]
    if missing:
        raise RuntimeError(f"{provider_name} response missing fields: {', '.join(missing)}")

    try:
        result["plafond_thermique_m"] = int(result["plafond_thermique_m"])
        result["force_thermique_ms"] = float(result["force_thermique_ms"])
        result["score_volabilite"] = max(0, min(100, int(result["score_volabilite"])))
    except (TypeError, ValueError) as e:
        raise RuntimeError(f"{provider_name} returned non-numeric analysis fields: {e}") from e
    if not isinstance(result["alertes_securite"], list):
        result["alertes_securite"] = []
    result.setdefault("explication_analyse", None)
    return result
