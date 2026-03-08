"""
Emagram analyzer using Google Gemini Vision API.

This analyzer uses Gemini 2.0 Flash (or 1.5 Pro/Flash) to analyze
emagram screenshots and extract paragliding-relevant metrics.
"""

import json
import logging
import base64
from pathlib import Path
from typing import Dict, List, Optional
import time

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logging.warning("google-generativeai not installed. Install with: pip install google-generativeai")

logger = logging.getLogger(__name__)


def analyze_emagram_with_gemini(
    screenshot_paths: List[str],
    spot_name: str,
    coordinates: tuple,
    api_key: str,
    model_name: str = "gemini-2.5-flash",
    max_retries: int = 3,
    retry_delay: float = 2.0
) -> Dict:
    """
    Analyze emagram screenshots using Google Gemini Vision API.
    
    Args:
        screenshot_paths: List of paths to screenshot files (up to 3 sources)
        spot_name: Name of the paragliding spot
        coordinates: (lat, lon) tuple
        api_key: Google API key
        model_name: Gemini model to use (default: gemini-2.0-flash-exp)
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds
    
    Returns:
        Dict with analysis results containing:
        - plafond_thermique_m: float
        - force_thermique_ms: float
        - heures_volables: str
        - score_volabilite: int (0-100)
        - conseils_vol: str
        - alertes_securite: List[str]
        - details_analyse: str
    """
    
    if not GEMINI_AVAILABLE:
        raise RuntimeError(
            "google-generativeai package not installed. "
            "Install with: pip install google-generativeai"
        )
    
    logger.info(f"Analyzing emagram for {spot_name} using Gemini {model_name}")
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    
    # Build prompt with images
    prompt_parts = _build_analysis_prompt(screenshot_paths, spot_name, coordinates)
    
    # Retry loop
    last_error = None
    for attempt in range(max_retries):
        try:
            # Create model
            model = genai.GenerativeModel(model_name)
            
            # Generate content
            logger.debug(f"Sending request to Gemini (attempt {attempt + 1}/{max_retries})")
            response = model.generate_content(
                prompt_parts,
                generation_config={
                    "temperature": 0.2,  # Low temperature for consistent structured output
                    "top_p": 0.8,
                    "top_k": 40,
                    "max_output_tokens": 2048,
                }
            )
            
            # Log response details for debugging
            logger.info(f"Gemini response candidates: {len(response.candidates)}")
            if response.candidates:
                logger.info(f"Gemini finish reason: {response.candidates[0].finish_reason}")
                logger.info(f"Gemini safety ratings: {response.candidates[0].safety_ratings}")
                
                # Try to get full text from parts
                if hasattr(response.candidates[0].content, 'parts'):
                    full_text = ''.join(part.text for part in response.candidates[0].content.parts if hasattr(part, 'text'))
                    logger.info(f"Full text from parts: {len(full_text)} chars")
                    response_text = full_text
                else:
                    response_text = response.text
            else:
                response_text = response.text
            
            logger.info(f"Gemini response text length: {len(response_text)} chars")
            
            # Parse response
            analysis = _parse_gemini_response(response_text)
            
            logger.info(f"Successfully analyzed emagram for {spot_name} with Gemini")
            return analysis
            
        except Exception as e:
            last_error = e
            logger.warning(f"Gemini API attempt {attempt + 1} failed: {e}")
            
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
                retry_delay *= 1.5  # Exponential backoff
            else:
                logger.error(f"All {max_retries} attempts failed")
    
    # All retries exhausted
    raise RuntimeError(f"Gemini API failed after {max_retries} attempts: {last_error}")


def _build_analysis_prompt(
    screenshot_paths: List[str],
    spot_name: str,
    coordinates: tuple
) -> List:
    """
    Build the analysis prompt with embedded images.
    
    Returns list of prompt parts for Gemini API:
    [text_part, image_part_1, image_part_2, image_part_3]
    """
    
    lat, lon = coordinates
    
    # Text prompt
    text_prompt = f"""Tu es un expert en météorologie aéronautique et en parapente. Analyse les {len(screenshot_paths)} emagrammes ci-dessous pour le site de parapente "{spot_name}" (coordonnées: {lat:.4f}, {lon:.4f}).

Ces emagrammes proviennent de sources différentes (Meteo-Parapente, TopMeteo, Windy). Compare-les et fournis une analyse consensuelle optimisée pour la pratique du parapente.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans ```json```) contenant EXACTEMENT ces champs:

{{
  "plafond_thermique_m": <altitude du plafond thermique en mètres (nombre entier)>,
  "force_thermique_ms": <force moyenne des thermiques en m/s (nombre décimal)>,
  "heures_volables": "<plage horaire favorable, ex: 14h-18h>",
  "score_volabilite": <score de 0 à 100 (0=impossible, 100=excellent)>,
  "conseils_vol": "<conseils pratiques courts pour les pilotes>",
  "alertes_securite": [<liste d'alertes si applicable, sinon liste vide>],
  "details_analyse": "<comparaison des sources et analyse détaillée>"
}}

Critères d'analyse pour le parapente:
- Plafond thermique: altitude maximale des ascendances
- Force thermique: vitesse verticale moyenne attendue
- Heures volables: créneaux avec thermiques exploitables (généralement entre midi et 18h)
- Score: prend en compte plafond, force, stabilité de la masse d'air, cisaillement
- Alertes: vent fort, orage, cisaillement, inversion basse, etc.

IMPORTANT: Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.
"""
    
    # Build parts list: [text, image1, image2, ...]
    parts = [text_prompt]
    
    # Add images
    for path in screenshot_paths:
        image_path = Path(path)
        if not image_path.exists():
            logger.warning(f"Screenshot not found: {path}")
            continue
        
        try:
            # Read image as bytes
            image_bytes = image_path.read_bytes()
            
            # Add as PIL Image (Gemini accepts various formats)
            from PIL import Image
            import io
            image = Image.open(io.BytesIO(image_bytes))
            parts.append(image)
            
            logger.debug(f"Added image to prompt: {path}")
            
        except Exception as e:
            logger.error(f"Failed to load image {path}: {e}")
    
    return parts


def _parse_gemini_response(response_text: str) -> Dict:
    """
    Parse Gemini's response and extract the analysis JSON.
    
    Gemini should return clean JSON, but we handle common issues:
    - Markdown code blocks
    - Extra whitespace
    - Missing fields
    """
    
    text = response_text.strip()
    
    # Remove markdown code blocks if present
    if text.startswith("```json"):
        text = text[7:]  # Remove ```json
    elif text.startswith("```"):
        text = text[3:]  # Remove ```
    
    if text.endswith("```"):
        text = text[:-3]  # Remove trailing ```
    
    text = text.strip()
    
    # Try to fix incomplete JSON
    if not text.endswith('}'):
        logger.warning("JSON appears incomplete, attempting to close it")
        # Count opening and closing braces
        open_braces = text.count('{')
        close_braces = text.count('}')
        
        # Add missing closing braces
        if open_braces > close_braces:
            text += '}' * (open_braces - close_braces)
            logger.info(f"Added {open_braces - close_braces} closing braces")
    
    try:
        analysis = json.loads(text)
        
        # Validate required fields
        required_fields = [
            'plafond_thermique_m',
            'force_thermique_ms',
            'heures_volables',
            'score_volabilite',
            'conseils_vol',
            'alertes_securite',
            'details_analyse'
        ]
        
        for field in required_fields:
            if field not in analysis:
                logger.warning(f"Missing field in Gemini response: {field}")
                analysis[field] = _get_default_value(field)
        
        # Type conversions and validation
        analysis['plafond_thermique_m'] = int(analysis['plafond_thermique_m'])
        analysis['force_thermique_ms'] = float(analysis['force_thermique_ms'])
        analysis['score_volabilite'] = max(0, min(100, int(analysis['score_volabilite'])))
        
        if not isinstance(analysis['alertes_securite'], list):
            analysis['alertes_securite'] = []
        
        return analysis
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        logger.error(f"Full response text ({len(response_text)} chars): {response_text}")
        
        # Return fallback analysis
        return {
            'plafond_thermique_m': 0,
            'force_thermique_ms': 0.0,
            'heures_volables': 'indéterminé',
            'score_volabilite': 0,
            'conseils_vol': 'Analyse impossible - erreur de parsing Gemini',
            'alertes_securite': ['Erreur lors de l\'analyse'],
            'details_analyse': f'Erreur de parsing JSON: {str(e)}\n\nRéponse brute: {response_text[:1000]}'
        }


def _get_default_value(field: str):
    """Get default value for a missing field."""
    defaults = {
        'plafond_thermique_m': 0,
        'force_thermique_ms': 0.0,
        'heures_volables': 'indéterminé',
        'score_volabilite': 0,
        'conseils_vol': '',
        'alertes_securite': [],
        'details_analyse': ''
    }
    return defaults.get(field, None)


# Example usage and testing
if __name__ == "__main__":
    import os
    import sys
    
    logging.basicConfig(level=logging.DEBUG)
    
    # Check for API key
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY not set in environment")
        print("Usage: export GOOGLE_API_KEY='your_key' && python gemini_analyzer.py")
        sys.exit(1)
    
    # Test with dummy screenshot paths
    test_screenshots = [
        "/tmp/emagram_meteo_parapente_test.png",
        "/tmp/emagram_topmeteo_test.png",
        "/tmp/emagram_windy_test.png"
    ]
    
    # Create minimal test images (1x1 PNG)
    png_data = (
        b'\x89PNG\r\n\x1a\n'
        b'\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x02\x00\x00\x00\x90wS\xde'
        b'\x00\x00\x00\x0cIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4'
        b'\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    
    for path in test_screenshots:
        Path(path).write_bytes(png_data)
    
    try:
        print("Testing Gemini analyzer...")
        result = analyze_emagram_with_gemini(
            screenshot_paths=test_screenshots,
            spot_name="Arguel Test",
            coordinates=(47.2167, 6.0833),
            api_key=api_key,
            model_name=os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        )
        
        print("\n✅ Analysis successful!")
        print("\nResult:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"\n❌ Analysis failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        # Cleanup
        for path in test_screenshots:
            Path(path).unlink(missing_ok=True)
