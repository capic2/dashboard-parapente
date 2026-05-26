"""
Emagram analyzer using Groq API with Llama Vision models.
Free tier fallback when Gemini is unavailable.
"""

import base64
import json
import logging
from pathlib import Path

try:
    from groq import Groq

    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

import config
from llm.emagram_prompt import build_emagram_analysis_prompt, normalize_analysis_locale
from llm.screenshot_inputs import ScreenshotInput, normalize_screenshot_inputs

logger = logging.getLogger(__name__)


def analyze_emagram_with_groq(
    screenshot_paths: list[ScreenshotInput],
    spot_name: str,
    coordinates: tuple,
    model_name: str = "meta-llama/llama-4-scout-17b-16e-instruct",
    max_retries: int = 2,
    locale: str | None = None,
) -> dict:
    """
    Analyze emagram screenshots using Groq API (Llama Vision).

    Returns same dict structure as gemini_analyzer for compatibility.
    """
    if not GROQ_AVAILABLE:
        raise RuntimeError("groq package not installed")

    api_key = config.GROQ_API_KEY
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not configured")

    logger.info(f"Analyzing emagram for {spot_name} using Groq {model_name}")

    client = Groq(api_key=api_key)

    # Build message content with images
    content = []
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
        if not Path(path).exists():
            logger.warning(f"Image not found: {path}")
            continue
        try:
            with open(path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{img_data}"},
                }
            )
            image_count += 1
        except Exception as e:
            logger.warning(f"Failed to encode {path}: {e}")

    if image_count == 0:
        raise RuntimeError("No valid images to analyze")

    last_error = None
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": content}],
                temperature=0.2,
                max_tokens=3000,
            )

            raw_text = response.choices[0].message.content or ""
            # Strip markdown code blocks
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0]
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0]

            result = json.loads(raw_text.strip())

            # Validate required fields
            required = [
                "plafond_thermique_m",
                "force_thermique_ms",
                "score_volabilite",
                "conseils_vol",
            ]
            for field in required:
                if field not in result:
                    result[field] = 0 if field != "conseils_vol" else "Analyse incomplète"

            result.setdefault("heures_volables", "11:00-17:00")
            result.setdefault("alertes_securite", [])
            result.setdefault("details_analyse", "Analyse par Groq Llama Vision")
            result.setdefault("explication_analyse", None)
            if isinstance(result["explication_analyse"], dict):
                result["explication_analyse"].setdefault(
                    "locale", normalize_analysis_locale(locale)
                )
            usage = getattr(response, "usage", None)
            prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(usage, "completion_tokens", 0) or 0
            total_tokens = getattr(usage, "total_tokens", 0) or (prompt_tokens + completion_tokens)

            result["llm_provider"] = "groq"
            result["llm_model"] = model_name
            result["llm_tokens_used"] = total_tokens
            result["llm_cost_usd"] = None

            logger.info(f"Groq analysis successful (attempt {attempt + 1})")
            return result

        except Exception as e:
            last_error = e
            error_msg = str(e).lower()

            # Detect quota/rate limit errors — skip retries immediately
            if any(kw in error_msg for kw in ["429", "quota", "rate_limit", "rate limit"]):
                logger.warning(f"⚠️ Groq quota/rate limit hit: {e}")
                from llm.exceptions import QuotaExhaustedError

                raise QuotaExhaustedError(f"Groq quota exhausted: {e}") from e

            logger.warning(f"Groq attempt {attempt + 1} failed: {e}")

    raise RuntimeError(f"Groq analysis failed after {max_retries} attempts: {last_error}")
