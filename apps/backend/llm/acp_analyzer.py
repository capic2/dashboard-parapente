"""
Emagram analyzer using OpenClaw ACP (Agent Client Protocol).

This analyzer uses `openclaw acp` to invoke Claude Code or other agents
to analyze emagram screenshots via the Agent Client Protocol.
"""

import json
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def analyze_emagram_with_acp(
    screenshot_paths: list[str],
    spot_name: str,
    coordinates: tuple,
    openclaw_command: str = "openclaw",
    agent_id: str | None = None,
    timeout: int = 120,
) -> dict:
    """
    Analyze emagram screenshots using OpenClaw ACP.

    Args:
        screenshot_paths: List of paths to screenshot files
        spot_name: Name of the paragliding spot
        coordinates: (lat, lon) tuple
        openclaw_command: Command to run openclaw CLI (default: "openclaw")
        agent_id: Optional agent ID to use (e.g., "claude", "codex")
        timeout: Timeout in seconds (default: 120)

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

    logger.info(f"Analyzing emagram for {spot_name} using OpenClaw ACP")

    # Prepare the prompt with embedded images
    prompt = _build_analysis_prompt(screenshot_paths, spot_name, coordinates)

    # Build openclaw acp command
    cmd = [openclaw_command, "acp", "client"]

    # Add agent specification if provided
    if agent_id:
        cmd.extend(["--server-args", f"--agent {agent_id}"])

    try:
        # Run openclaw acp client with the prompt
        logger.debug(f"Running command: {' '.join(cmd)}")

        result = subprocess.run(
            cmd, input=prompt.encode("utf-8"), capture_output=True, timeout=timeout, check=True
        )

        output = result.stdout.decode("utf-8")
        logger.debug(f"ACP output: {output[:500]}...")

        # Parse the structured response
        analysis = _parse_acp_response(output)

        logger.info(f"Successfully analyzed emagram for {spot_name}")
        return analysis

    except subprocess.TimeoutExpired:
        logger.error(f"ACP analysis timed out after {timeout}s")
        raise TimeoutError(f"OpenClaw ACP analysis timed out after {timeout} seconds")

    except subprocess.CalledProcessError as e:
        logger.error(f"ACP command failed: {e.stderr.decode('utf-8')}")
        raise RuntimeError(f"OpenClaw ACP command failed: {e.stderr.decode('utf-8')}")

    except Exception as e:
        logger.error(f"Unexpected error during ACP analysis: {e}")
        raise


def _build_analysis_prompt(screenshot_paths: list[str], spot_name: str, coordinates: tuple) -> str:
    """Build the analysis prompt with image attachments."""

    lat, lon = coordinates

    prompt = f"""Analyse les {len(screenshot_paths)} emagrammes ci-dessous pour le site de parapente "{spot_name}" (coordonnées: {lat:.4f}, {lon:.4f}).

Ces emagrammes proviennent de 3 sources différentes (Meteo-Parapente, TopMeteo, Windy). Compare-les et fournis une analyse consensuelle pour la pratique du parapente.

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans ```json```) contenant:
{{
  "plafond_thermique_m": <altitude plafond en mètres>,
  "force_thermique_ms": <force des thermiques en m/s>,
  "heures_volables": "<plage horaire, ex: 14h-18h>",
  "score_volabilite": <0-100>,
  "conseils_vol": "<conseils pratiques>",
  "alertes_securite": [<liste d'alertes si applicable>],
  "details_analyse": "<comparaison des 3 sources et points d'attention>"
}}

"""

    # Add image attachments (OpenClaw ACP should support image inputs)
    for i, path in enumerate(screenshot_paths, 1):
        if Path(path).exists():
            prompt += f"\n[Image {i}: {Path(path).name}]\n"
            # Note: We'll need to check if ACP supports base64 embedded images
            # For now, we just reference the file path
            prompt += f"File: {path}\n"

    return prompt


def _parse_acp_response(output: str) -> dict:
    """
    Parse the ACP response and extract the analysis JSON.

    OpenClaw ACP might wrap the response in additional text,
    so we need to extract the JSON portion.
    """

    # Try to find JSON in the output
    # Look for lines that start with { and end with }
    lines = output.strip().split("\n")

    json_lines = []
    in_json = False

    for line in lines:
        stripped = line.strip()

        # Start of JSON object
        if stripped.startswith("{"):
            in_json = True
            json_lines = [line]
        elif in_json:
            json_lines.append(line)
            # End of JSON object
            if stripped.endswith("}"):
                break

    if not json_lines:
        logger.warning("Could not find JSON in ACP response, trying to parse entire output")
        json_str = output.strip()
    else:
        json_str = "\n".join(json_lines)

    try:
        analysis = json.loads(json_str)

        # Validate required fields
        required_fields = [
            "plafond_thermique_m",
            "force_thermique_ms",
            "heures_volables",
            "score_volabilite",
            "conseils_vol",
            "alertes_securite",
            "details_analyse",
        ]

        for field in required_fields:
            if field not in analysis:
                logger.warning(f"Missing field in analysis: {field}")
                analysis[field] = _get_default_value(field)

        return analysis

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse ACP response as JSON: {e}")
        logger.debug(f"Response was: {output}")

        # Return a fallback analysis
        return {
            "plafond_thermique_m": 0,
            "force_thermique_ms": 0.0,
            "heures_volables": "indéterminé",
            "score_volabilite": 0,
            "conseils_vol": "Analyse impossible - erreur de parsing",
            "alertes_securite": ["Erreur lors de l'analyse"],
            "details_analyse": f"Erreur de parsing JSON: {str(e)}",
        }


def _get_default_value(field: str):
    """Get default value for a missing field."""
    defaults = {
        "plafond_thermique_m": 0,
        "force_thermique_ms": 0.0,
        "heures_volables": "indéterminé",
        "score_volabilite": 0,
        "conseils_vol": "",
        "alertes_securite": [],
        "details_analyse": "",
    }
    return defaults.get(field, None)


# Example usage and testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)

    # Test with dummy screenshot paths
    test_screenshots = [
        "/tmp/emagram_meteo_parapente_test.png",
        "/tmp/emagram_topmeteo_test.png",
        "/tmp/emagram_windy_test.png",
    ]

    # Create dummy files for testing
    for path in test_screenshots:
        Path(path).touch()

    try:
        result = analyze_emagram_with_acp(
            screenshot_paths=test_screenshots,
            spot_name="Arguel",
            coordinates=(47.2167, 6.0833),
            timeout=30,
        )

        print("Analysis result:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"Error: {e}")

    finally:
        # Cleanup dummy files
        for path in test_screenshots:
            Path(path).unlink(missing_ok=True)
