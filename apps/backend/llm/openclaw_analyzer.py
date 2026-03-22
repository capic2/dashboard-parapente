"""
OpenClaw Vision Analyzer
Uses OpenClaw proxy to access Claude Sonnet 4.5 for emagram analysis
Compatible with OpenAI API format
"""

import base64
import json
import logging
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# OpenClaw configuration
OPENCLAW_BASE_URL = "http://localhost:8080/v1"  # Adjust port as needed
OPENCLAW_MODEL = "claude-sonnet-4.5"  # Or whatever OpenClaw calls it


EMAGRAM_ANALYSIS_PROMPT = """Tu es un expert météorologue spécialisé en parapente. Analyse ces emagrammes pour le spot de parapente "{spot_name}":

{image_descriptions}

Pour CHAQUE emagramme, identifie:
1. **Plafond thermique** (altitude maximale des thermiques, en mètres MSL)
2. **Force des thermiques** (vitesse verticale moyenne dans les thermiques, en m/s)
3. **Base des nuages** (LCL - Lifting Condensation Level, en mètres MSL)
4. **Heures volables** (début et fin des conditions thermiques favorables)
5. **Stabilité atmosphérique** (stable/instable/très instable)
6. **Cisaillement du vent** (entre surface et 3000m, classé: faible/modéré/fort)
7. **Risque d'orage** (nul/faible/modéré/élevé)

PUIS compare les 3 sources:
- Si les valeurs concordent (écart <20%): note "sources_agreement: high"
- Si divergences modérées (écart 20-40%): note "sources_agreement: medium"
- Si divergences importantes (écart >40%): note "sources_agreement: low"

Génère:
1. **Score de volabilité** (0-100)
2. **Résumé des conditions** (2-3 phrases)
3. **Conseils de vol** (recommandations pratiques)
4. **Alertes sécurité** (risques détectés)

Format JSON strict:
{{
  "plafond_thermique_m": 2800,
  "force_thermique_ms": 2.5,
  "base_nuages_m": 1200,
  "heure_debut_thermiques": "11:00",
  "heure_fin_thermiques": "17:30",
  "heures_volables_total": 6.5,
  "stabilite_atmospherique": "instable",
  "cisaillement_vent": "modéré",
  "risque_orage": "faible",
  "score_volabilite": 75,
  "sources_agreement": "high",
  "resume_conditions": "...",
  "conseils_vol": "...",
  "alertes_securite": [...]
}}
"""


def encode_image_base64(image_path: str) -> str:
    """Encode image to base64"""
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


async def analyze_with_openclaw(
    image_paths: list[str],
    spot_name: str,
    sources: list[str],
    base_url: str = OPENCLAW_BASE_URL,
    model: str = OPENCLAW_MODEL,
) -> dict[str, Any]:
    """
    Analyze emagram screenshots using OpenClaw (Claude via OpenAI-compatible API)

    Args:
        image_paths: Paths to screenshot images
        spot_name: Name of paragliding spot
        sources: Source names
        base_url: OpenClaw API base URL
        model: Model name (claude-sonnet-4.5)

    Returns:
        Analysis results dict
    """

    if not image_paths:
        return {"success": False, "error": "No images provided"}

    try:
        # Build image descriptions for prompt
        image_descriptions = []
        for i, source in enumerate(sources, 1):
            image_descriptions.append(f"Image {i}: {source.title()}")

        prompt = EMAGRAM_ANALYSIS_PROMPT.format(
            spot_name=spot_name, image_descriptions="\n".join(image_descriptions)
        )

        # Prepare OpenAI-compatible messages with vision
        messages = [{"role": "user", "content": []}]

        # Add text prompt
        messages[0]["content"].append({"type": "text", "text": prompt})

        # Add images
        for image_path in image_paths:
            if not Path(image_path).exists():
                logger.warning(f"Image not found: {image_path}")
                continue

            image_data = encode_image_base64(image_path)
            messages[0]["content"].append(
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_data}"}}
            )

        logger.info(f"🦙 Calling OpenClaw with {len(image_paths)} images...")

        # Call OpenClaw API (OpenAI-compatible)
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                json={"model": model, "messages": messages, "max_tokens": 2000, "temperature": 0.3},
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            result = response.json()

        # Extract response
        response_text = result["choices"][0]["message"]["content"]

        logger.info("✅ OpenClaw response received")

        # Parse JSON response
        try:
            # Remove markdown code blocks if present
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            analysis = json.loads(response_text)

            # Add metadata
            analysis["success"] = True
            analysis["llm_provider"] = "openclaw"
            analysis["llm_model"] = model
            analysis["llm_tokens_used"] = result.get("usage", {}).get("total_tokens", 0)
            analysis["llm_cost_usd"] = 0.0  # OpenClaw is free!
            analysis["raw_response"] = response_text

            logger.info(
                f"📊 Analysis: Score {analysis.get('score_volabilite')}/100, Agreement: {analysis.get('sources_agreement')}"
            )

            return analysis

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenClaw response: {e}")
            return {
                "success": False,
                "error": f"Failed to parse response: {e}",
                "raw_response": response_text,
                "llm_provider": "openclaw",
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"OpenClaw HTTP error: {e}")
        return {
            "success": False,
            "error": f"OpenClaw API error: {e.response.status_code} - {e.response.text}",
            "llm_provider": "openclaw",
        }

    except Exception as e:
        logger.error(f"OpenClaw error: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"OpenClaw request failed: {str(e)}",
            "llm_provider": "openclaw",
        }
