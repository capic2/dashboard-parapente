"""
Multi-Emagram LLM Analyzer
Uses Claude 3.5 Sonnet Vision API to analyze multiple emagram screenshots
Extracts paragliding-specific metrics and generates flight recommendations
"""

import anthropic
import base64
import os
from typing import Dict, List, Any, Optional
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

# Claude API client
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

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
- Si divergences modérées (écart 20-40%): note "sources_agreement: medium" et explique les différences
- Si divergences importantes (écart >40%): note "sources_agreement: low" et explique pourquoi

Génère ensuite:
1. **Score de volabilité** (0-100):
   - 80-100: Conditions excellentes
   - 60-79: Bonnes conditions
   - 40-59: Conditions moyennes
   - 20-39: Conditions difficiles
   - 0-19: Conditions dangereuses ou non volables

2. **Résumé des conditions** (2-3 phrases décrivant les conditions générales)

3. **Conseils de vol** (recommandations pratiques sur timing, technique, niveau requis)

4. **Alertes sécurité** (tableau de risques détectés: vent fort, cisaillement, orage, etc.)

IMPORTANT:
- Priorise la SÉCURITÉ dans tous les conseils
- Si les sources divergent beaucoup, mentionne l'incertitude
- Utilise des valeurs moyennes si consensus entre sources
- Si un emagramme est illisible ou incomplet, mentionne-le et base-toi sur les autres

Format de réponse JSON strict (pas de texte avant/après, juste le JSON):
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
  "resume_conditions": "Thermiques bien développés avec plafond vers 2800m. Base des nuages à 1200m. Vent modéré avec cisaillement moyen.",
  "conseils_vol": "Bonnes conditions pour vols thermiques. Attendre 11h pour thermiques établis. Attention au cisaillement en altitude. Privilégier les ascendances larges.",
  "alertes_securite": [
    "Cisaillement modéré au-dessus de 2000m - prudence en altitude",
    "Base nuageuse basse - risque d'aspiration en thermique fort"
  ],
  "details_par_source": {{
    "meteo-parapente": {{"plafond_m": 2800, "force_ms": 2.5, "lisible": true}},
    "topmeteo": {{"plafond_m": 2750, "force_ms": 2.3, "lisible": true}},
    "windy": {{"plafond_m": 2850, "force_ms": 2.7, "lisible": true}}
  }}
}}
"""


def encode_image_base64(image_path: str) -> str:
    """Encode image to base64 for Claude API"""
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


async def analyze_multiple_emagrammes(
    image_paths: List[str],
    spot_name: str,
    sources: List[str]
) -> Dict[str, Any]:
    """
    Analyze multiple emagram screenshots using Claude 3.5 Sonnet Vision
    
    Args:
        image_paths: List of paths to screenshot images (PNG)
        spot_name: Name of the paragliding spot
        sources: List of source names matching image_paths
    
    Returns:
        {
            "success": True/False,
            "plafond_thermique_m": 2800,
            "force_thermique_ms": 2.5,
            "score_volabilite": 75,
            "resume_conditions": "...",
            "conseils_vol": "...",
            "alertes_securite": [...],
            "sources_agreement": "high",
            "llm_provider": "anthropic",
            "llm_model": "claude-3-5-sonnet-20241022",
            "llm_tokens_used": 12500,
            "error": "..." (if failed)
        }
    """
    
    if not image_paths:
        return {
            "success": False,
            "error": "No images provided for analysis"
        }
    
    if not os.getenv("ANTHROPIC_API_KEY"):
        return {
            "success": False,
            "error": "ANTHROPIC_API_KEY not configured"
        }
    
    try:
        # Build image descriptions for prompt
        image_descriptions = []
        for i, (path, source) in enumerate(zip(image_paths, sources), 1):
            image_descriptions.append(f"Image {i}: {source.title()}")
        
        prompt = EMAGRAM_ANALYSIS_PROMPT.format(
            spot_name=spot_name,
            image_descriptions="\n".join(image_descriptions)
        )
        
        # Prepare image content blocks for Claude
        image_content = []
        for image_path in image_paths:
            if not Path(image_path).exists():
                logger.warning(f"Image not found: {image_path}, skipping")
                continue
            
            try:
                image_data = encode_image_base64(image_path)
                image_content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": image_data
                    }
                })
            except Exception as e:
                logger.error(f"Failed to encode image {image_path}: {e}")
        
        if not image_content:
            return {
                "success": False,
                "error": "No valid images could be encoded"
            }
        
        # Add text prompt
        image_content.append({
            "type": "text",
            "text": prompt
        })
        
        logger.info(f"🤖 Sending {len(image_paths)} images to Claude for analysis...")
        
        # Call Claude API
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            temperature=0.3,  # Lower for more consistent factual extraction
            messages=[
                {
                    "role": "user",
                    "content": image_content
                }
            ]
        )
        
        # Extract response text
        response_text = response.content[0].text
        
        logger.info(f"✅ Claude response received ({response.usage.input_tokens} in, {response.usage.output_tokens} out)")
        
        # Parse JSON response
        try:
            # Claude sometimes wraps JSON in markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            analysis = json.loads(response_text)
            
            # Add metadata
            analysis["success"] = True
            analysis["llm_provider"] = "anthropic"
            analysis["llm_model"] = "claude-3-5-sonnet-20241022"
            analysis["llm_tokens_used"] = response.usage.input_tokens + response.usage.output_tokens
            analysis["llm_cost_usd"] = calculate_claude_cost(response.usage.input_tokens, response.usage.output_tokens)
            analysis["raw_response"] = response_text  # For debugging
            
            logger.info(f"📊 Analysis complete: Score {analysis.get('score_volabilite')}/100, Agreement: {analysis.get('sources_agreement')}")
            
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude JSON response: {e}")
            logger.error(f"Raw response: {response_text[:500]}")
            return {
                "success": False,
                "error": f"Failed to parse LLM response: {e}",
                "raw_response": response_text,
                "llm_provider": "anthropic",
                "llm_model": "claude-3-5-sonnet-20241022"
            }
    
    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        return {
            "success": False,
            "error": f"Claude API error: {str(e)}",
            "llm_provider": "anthropic"
        }
    
    except Exception as e:
        logger.error(f"Unexpected error in emagram analysis: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"Analysis failed: {str(e)}"
        }


def calculate_claude_cost(input_tokens: int, output_tokens: int) -> float:
    """
    Calculate cost for Claude 3.5 Sonnet API call
    Pricing (as of 2024):
    - Input: $3 per 1M tokens
    - Output: $15 per 1M tokens
    """
    input_cost = (input_tokens / 1_000_000) * 3.0
    output_cost = (output_tokens / 1_000_000) * 15.0
    return round(input_cost + output_cost, 4)


async def analyze_emagrammes_with_fallback(
    image_paths: List[str],
    spot_name: str,
    sources: List[str]
) -> Dict[str, Any]:
    """
    Analyze emagrammes with fallback to classic calculation if LLM fails
    
    For now, just wraps analyze_multiple_emagrammes
    In future, could implement classic meteorology fallback
    """
    result = await analyze_multiple_emagrammes(image_paths, spot_name, sources)
    
    if not result.get("success"):
        logger.warning("LLM analysis failed, classic fallback not implemented yet")
        # TODO: Implement classic meteorology analysis as fallback
        # For now, just return the error
    
    return result
