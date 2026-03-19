"""
AI Vision-based emagram analysis using Claude 3.5 Sonnet
Analyzes Skew-T diagrams to extract paragliding-specific thermal forecasts
"""

import os
import base64
import json
from typing import Dict, Any, Optional
from datetime import datetime, time
import anthropic


# Specialized prompt for paragliding thermal analysis
PARAGLIDING_ANALYSIS_PROMPT = """Tu es un expert météorologue spécialisé en parapente. Analyse ce radiosondage (diagramme émagramme/Skew-T) et fournis une prévision détaillée pour le vol libre.

IMPORTANT: Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans texte avant ou après. Pas de markdown, pas d'explication textuelle.

Analyse les éléments suivants:

1. **Plafond thermique** (en mètres): Altitude maximale des thermiques (convergence température/point de rosée ou niveau d'équilibre)

2. **Force des thermiques** (en m/s): Taux de montée moyen estimé dans les thermiques (basé sur CAPE et gradient thermique)

3. **CAPE** (J/kg): Énergie potentielle convective disponible (visible sur le diagramme)

4. **Stabilité atmosphérique**: Classification parmi: "très stable", "stable", "neutre", "instable", "très instable"

5. **Cisaillement du vent**: Classification parmi: "faible", "modéré", "fort" (basé sur l'évolution du vent avec l'altitude)

6. **Heures de vol thermique**:
   - Heure de début estimée (format "HH:MM")
   - Heure de fin estimée (format "HH:MM")
   - Total d'heures volables

7. **Risque d'orage**: Classification parmi: "nul", "faible", "modéré", "élevé"

8. **Score de volabilité** (0-100): Note globale tenant compte de tous les facteurs (0 = non volable, 100 = conditions parfaites)

9. **Résumé des conditions**: Description concise (2-3 phrases) des conditions de vol attendues

10. **Conseils de vol**: Recommandations pratiques pour les pilotes (2-3 phrases)

11. **Alertes de sécurité**: Liste des dangers potentiels (thermiques forts, vent fort, orage, etc.) - array de strings

Réponds EXACTEMENT au format JSON suivant (sans ```json ni autre formatage):

{
  "plafond_thermique_m": 2500,
  "force_thermique_ms": 2.5,
  "cape_jkg": 850.0,
  "stabilite_atmospherique": "instable",
  "cisaillement_vent": "modéré",
  "heure_debut_thermiques": "10:30",
  "heure_fin_thermiques": "17:00",
  "heures_volables_total": 6.5,
  "risque_orage": "faible",
  "score_volabilite": 75,
  "resume_conditions": "Journée favorable au vol thermique avec des thermiques de force modérée. Plafond confortable autour de 2500m.",
  "conseils_vol": "Départ recommandé vers 11h. Bonnes conditions pour du cross-country. Attention au renforcement possible des thermiques en début d'après-midi.",
  "alertes_securite": ["Thermiques potentiellement turbulents entre 13h et 15h", "Surveiller l'évolution nuageuse en fin d'après-midi"]
}

RAPPEL: Réponds UNIQUEMENT avec le JSON, rien d'autre."""


def encode_image_base64(image_path: str) -> str:
    """
    Encode image to base64 string
    
    Args:
        image_path: Path to image file
    
    Returns:
        Base64-encoded string
    """
    with open(image_path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def parse_time_string(time_str: str) -> Optional[time]:
    """
    Parse time string in HH:MM format to time object
    
    Args:
        time_str: Time string like "10:30"
    
    Returns:
        time object or None if invalid
    """
    try:
        parts = time_str.strip().split(':')
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return time(hour=hour, minute=minute)
    except:
        return None


async def analyze_skewt_with_llm(
    image_path: str,
    station_name: str,
    provider: str = "anthropic",
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyze Skew-T diagram using LLM Vision API (multi-provider)
    
    Args:
        image_path: Path to Skew-T PNG/WebP image
        station_name: Name of radiosonde station
        provider: LLM provider ("anthropic", "openai", or "google")
        api_key: API key (or from env vars)
        model: Model name (auto-selected if None)
    
    Returns:
        Dict with analysis results or error
    """
    try:
        # Auto-select model based on provider
        if model is None:
            if provider == "anthropic":
                model = "claude-3-5-sonnet-20241022"
            elif provider == "openai":
                model = "gpt-4-vision-preview"
            elif provider == "google":
                model = "gemini-pro-vision"
            else:
                return {
                    "success": False,
                    "error": f"Unknown provider: {provider}",
                    "method": "llm_vision_failed"
                }
        
        # Get API key from env if not provided
        if api_key is None:
            if provider == "anthropic":
                api_key = os.getenv("ANTHROPIC_API_KEY")
            elif provider == "openai":
                api_key = os.getenv("OPENAI_API_KEY")
            elif provider == "google":
                api_key = os.getenv("GOOGLE_API_KEY")
        
        if not api_key:
            return {
                "success": False,
                "error": f"{provider.upper()} API key not configured",
                "method": "llm_vision_failed"
            }
        
        # Check image exists
        if not os.path.exists(image_path):
            return {
                "success": False,
                "error": f"Image file not found: {image_path}",
                "method": "llm_vision_failed"
            }
        
        # Encode image
        image_base64 = encode_image_base64(image_path)
        
        start_time = datetime.now()
        response_text = ""
        input_tokens = 0
        output_tokens = 0
        
        # Provider-specific API calls
        if provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            
            response = client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=0.2,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_base64
                            }
                        },
                        {"type": "text", "text": PARAGLIDING_ANALYSIS_PROMPT}
                    ]
                }]
            )
            
            response_text = response.content[0].text.strip()
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            
        elif provider == "openai":
            import openai
            client = openai.OpenAI(api_key=api_key)
            
            response = client.chat.completions.create(
                model=model,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PARAGLIDING_ANALYSIS_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{image_base64}"}
                        }
                    ]
                }],
                max_tokens=2048,
                temperature=0.2
            )
            
            response_text = response.choices[0].message.content.strip()
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            
        elif provider == "google":
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            
            model_obj = genai.GenerativeModel(model)
            
            from PIL import Image
            img = Image.open(image_path)
            
            response = model_obj.generate_content([PARAGLIDING_ANALYSIS_PROMPT, img])
            response_text = response.text.strip()
            
            # Gemini doesn't provide token counts easily
            input_tokens = 1000  # Estimate
            output_tokens = 500
        
        end_time = datetime.now()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        # Remove markdown code blocks if present (defensive)
        if response_text.startswith('```'):
            # Remove ```json and ``` markers
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:].strip()
        
        # Parse JSON response
        try:
            analysis_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse JSON response: {str(e)}",
                "raw_response": response_text[:500],
                "method": "llm_vision_failed"
            }
        
        # Parse time strings to time objects
        if "heure_debut_thermiques" in analysis_data:
            analysis_data["heure_debut_thermiques"] = parse_time_string(
                analysis_data["heure_debut_thermiques"]
            )
        
        if "heure_fin_thermiques" in analysis_data:
            analysis_data["heure_fin_thermiques"] = parse_time_string(
                analysis_data["heure_fin_thermiques"]
            )
        
        # Convert alertes_securite to JSON string if it's a list
        if "alertes_securite" in analysis_data and isinstance(analysis_data["alertes_securite"], list):
            analysis_data["alertes_securite"] = json.dumps(analysis_data["alertes_securite"], ensure_ascii=False)
        
        # Calculate cost (provider-specific pricing)
        if provider == "anthropic":
            # Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
            cost_usd = (input_tokens / 1_000_000 * 3.0) + (output_tokens / 1_000_000 * 15.0)
        elif provider == "openai":
            # GPT-4 Vision: ~$0.01/image + $0.03/1K output tokens
            cost_usd = 0.01 + (output_tokens / 1_000 * 0.03)
        elif provider == "google":
            # Gemini Pro Vision: Free tier or very cheap
            cost_usd = 0.0
        else:
            cost_usd = 0.0
        
        return {
            "success": True,
            "method": "llm_vision",
            "provider": provider,
            "model": model,
            "tokens_used": input_tokens + output_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": round(cost_usd, 4),
            "response_time_ms": response_time_ms,
            "raw_response": response_text,
            **analysis_data  # Merge analysis results
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"{provider} API error: {str(e)}",
            "method": "llm_vision_failed"
        }


async def analyze_emagram_with_fallback(
    image_path: str,
    sounding_data: Dict[str, Any],
    station_name: str,
    station_latitude: float,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyze emagram with LLM vision, fallback to classic calculations
    
    Args:
        image_path: Path to Skew-T image
        sounding_data: Raw sounding data for fallback calculations
        station_name: Station name
        station_latitude: Station latitude (for solar calculations)
        api_key: Anthropic API key
    
    Returns:
        Complete analysis with method indicator
    """
    # Determine provider from env or config
    provider = os.getenv("LLM_PROVIDER", "anthropic")
    
    # Try LLM vision first
    llm_result = await analyze_skewt_with_llm(
        image_path=image_path,
        station_name=station_name,
        provider=provider,
        api_key=api_key
    )
    
    if llm_result.get("success"):
        return llm_result
    
    # Fallback to classic calculations
    print(f"LLM vision failed ({llm_result.get('error')}), using classic calculations...")
    
    from meteorology.classic_analysis import (
        calculate_stability_indices,
        estimate_flyable_hours,
        calculate_flyability_score
    )
    
    # Extract sounding data
    pressure = sounding_data.get("pressure_hpa", [])
    temperature = sounding_data.get("temperature_c", [])
    dewpoint = sounding_data.get("dewpoint_c", [])
    height = sounding_data.get("height_m", [])
    
    # Calculate stability indices
    stability_result = calculate_stability_indices(
        pressure_hpa=pressure,
        temperature_c=temperature,
        dewpoint_c=dewpoint,
        height_m=height
    )
    
    if not stability_result.get("success"):
        return {
            "success": False,
            "error": f"Both LLM and classic calculations failed. Classic error: {stability_result.get('error')}",
            "llm_error": llm_result.get("error"),
            "method": "all_methods_failed"
        }
    
    # Estimate flyable hours
    hours_result = estimate_flyable_hours(
        cape_jkg=stability_result.get("cape_jkg", 0),
        plafond_m=stability_result.get("plafond_thermique_m"),
        stabilite=stability_result.get("stabilite_atmospherique", "stable"),
        latitude=station_latitude
    )
    
    # Calculate flyability score
    score = calculate_flyability_score(
        cape_jkg=stability_result.get("cape_jkg", 0),
        plafond_m=stability_result.get("plafond_thermique_m"),
        force_thermique_ms=stability_result.get("force_thermique_ms", 0),
        cisaillement="indéterminé",
        risque_orage=stability_result.get("risque_orage", "indéterminé")
    )
    
    # Merge results
    return {
        "success": True,
        "method": "classic_calculation",
        "provider": None,
        "model": None,
        "tokens_used": None,
        "cost_usd": None,
        "llm_fallback_reason": llm_result.get("error"),
        
        # Thermal metrics
        "plafond_thermique_m": stability_result.get("plafond_thermique_m"),
        "force_thermique_ms": stability_result.get("force_thermique_ms"),
        "cape_jkg": stability_result.get("cape_jkg"),
        "stabilite_atmospherique": stability_result.get("stabilite_atmospherique"),
        "cisaillement_vent": "indéterminé",
        "risque_orage": stability_result.get("risque_orage"),
        "score_volabilite": score,
        
        # Time estimates
        "heure_debut_thermiques": hours_result.get("heure_debut_thermiques") if hours_result.get("success") else None,
        "heure_fin_thermiques": hours_result.get("heure_fin_thermiques") if hours_result.get("success") else None,
        "heures_volables_total": hours_result.get("heures_volables_total") if hours_result.get("success") else None,
        
        # Text summaries (classic fallback)
        "resume_conditions": f"Analyse automatique: Stabilité {stability_result.get('stabilite_atmospherique')}, "
                           f"CAPE {stability_result.get('cape_jkg', 0):.0f} J/kg. "
                           f"Force thermique estimée: {stability_result.get('force_thermique_ms', 0):.1f} m/s.",
        "conseils_vol": "Analyse basée sur calculs météorologiques classiques. Vérifiez les conditions locales.",
        "alertes_securite": json.dumps(["Prévisions basées sur calculs automatiques - vérifier conditions réelles"], ensure_ascii=False),
        
        # Classic indices
        "lcl_m": stability_result.get("lcl_m"),
        "lfc_m": stability_result.get("lfc_m"),
        "el_m": stability_result.get("el_m"),
        "lifted_index": stability_result.get("lifted_index"),
        "k_index": stability_result.get("k_index"),
        "total_totals": stability_result.get("total_totals"),
        "showalter_index": stability_result.get("showalter_index")
    }
