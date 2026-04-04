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

logger = logging.getLogger(__name__)

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


def analyze_emagram_with_groq(
    screenshot_paths: list[str],
    spot_name: str,
    coordinates: tuple,
    model_name: str = "meta-llama/llama-4-scout-17b-16e-instruct",
    max_retries: int = 2,
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
    for path in screenshot_paths:
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

    last_error = None
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": content}],
                temperature=0.2,
                max_tokens=2000,
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

            logger.info(f"Groq analysis successful (attempt {attempt + 1})")
            return result

        except Exception as e:
            last_error = e
            logger.warning(f"Groq attempt {attempt + 1} failed: {e}")

    raise RuntimeError(f"Groq analysis failed after {max_retries} attempts: {last_error}")
