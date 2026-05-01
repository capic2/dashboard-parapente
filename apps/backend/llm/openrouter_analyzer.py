"""
Emagram analyzer using OpenRouter vision models.

OpenRouter exposes an OpenAI-compatible Chat Completions API and can route to
free vision-capable models when available.
"""

import base64
import json
import logging
import mimetypes
from pathlib import Path
from typing import Any

import httpx

import config
from llm.exceptions import QuotaExhaustedError

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

ANALYSIS_PROMPT = """Tu es un expert météorologue spécialisé en parapente. Analyse ces emagrammes pour le spot "{spot_name}" ({lat}, {lon}).

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{{
  "plafond_thermique_m": <altitude en metres du sommet des thermiques>,
  "force_thermique_ms": <vitesse ascendante moyenne en m/s>,
  "heures_volables": "<heure debut>-<heure fin>",
  "score_volabilite": <score 0-100>,
  "conseils_vol": "<conseils pratiques pour le pilote>",
  "alertes_securite": ["<alerte 1>", "<alerte 2>"],
  "details_analyse": "<resume technique de l'analyse>"
}}"""


def analyze_emagram_with_openrouter(
    screenshot_paths: list[str],
    spot_name: str,
    coordinates: tuple[float, float],
    model_name: str = "qwen/qwen2.5-vl-72b-instruct:free",
    max_retries: int = 2,
) -> dict[str, Any]:
    """Analyze emagram screenshots using OpenRouter vision models."""
    api_key = config.OPENROUTER_API_KEY
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not configured")

    logger.info(f"Analyzing emagram for {spot_name} using OpenRouter {model_name}")

    content = _build_message_content(screenshot_paths, spot_name, coordinates)
    last_error = None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dashboard-parapente.local",
        "X-Title": "Dashboard Parapente",
    }
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": content}],
        "temperature": 0.2,
        "max_tokens": 2000,
    }

    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(OPENROUTER_API_URL, headers=headers, json=payload)

            if response.status_code in {402, 429}:
                raise QuotaExhaustedError(
                    f"OpenRouter quota exhausted: HTTP {response.status_code}"
                )
            if response.status_code >= 400:
                raise RuntimeError(
                    f"OpenRouter API error HTTP {response.status_code}: {response.text[:500]}"
                )

            data = response.json()
            raw_text = data["choices"][0]["message"].get("content") or ""
            result = _parse_openrouter_response(raw_text)

            usage = data.get("usage") or {}
            prompt_tokens = usage.get("prompt_tokens") or 0
            completion_tokens = usage.get("completion_tokens") or 0
            total_tokens = usage.get("total_tokens") or (prompt_tokens + completion_tokens)

            result["llm_provider"] = "openrouter"
            result["llm_model"] = model_name
            result["llm_tokens_used"] = total_tokens
            result["llm_cost_usd"] = None

            logger.info(f"OpenRouter analysis successful (attempt {attempt + 1})")
            return result

        except QuotaExhaustedError:
            raise
        except Exception as e:
            last_error = e
            error_msg = str(e).lower()
            if any(kw in error_msg for kw in ["429", "quota", "rate_limit", "rate limit"]):
                raise QuotaExhaustedError(f"OpenRouter quota exhausted: {e}") from e
            logger.warning(f"OpenRouter attempt {attempt + 1} failed: {e}")

    raise RuntimeError(f"OpenRouter analysis failed after {max_retries} attempts: {last_error}")


def _build_message_content(
    screenshot_paths: list[str], spot_name: str, coordinates: tuple[float, float]
) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = []

    for path in screenshot_paths:
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
        except Exception as e:
            logger.warning(f"Failed to encode {path}: {e}")

    if not content:
        raise RuntimeError("No valid images to analyze")

    lat, lon = coordinates
    content.append(
        {
            "type": "text",
            "text": ANALYSIS_PROMPT.format(spot_name=spot_name, lat=lat, lon=lon),
        }
    )
    return content


def _parse_openrouter_response(response_text: str) -> dict[str, Any]:
    text = response_text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0]

    try:
        result = json.loads(text.strip())
    except json.JSONDecodeError as e:
        raise RuntimeError(f"OpenRouter returned invalid JSON: {e}") from e

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
        raise RuntimeError(f"OpenRouter response missing fields: {', '.join(missing)}")

    result["plafond_thermique_m"] = int(result["plafond_thermique_m"])
    result["force_thermique_ms"] = float(result["force_thermique_ms"])
    result["score_volabilite"] = max(0, min(100, int(result["score_volabilite"])))
    if not isinstance(result["alertes_securite"], list):
        result["alertes_securite"] = []

    return result
