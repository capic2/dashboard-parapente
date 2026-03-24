"""
Multi-source Emagram Aggregator
Fetches emagram data/images from multiple sources for comparison
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any


async def fetch_all_emagrammes_for_spot(
    spot_latitude: float,
    spot_longitude: float,
    spot_name: str,
    forecast_hour: int = 0,
    output_dir: str = "/tmp/emagram_images",
) -> dict[str, Any]:
    """
    Fetch emagrammes from all available sources for a spot

    Returns multiple emagrammes for comparison:
    - Meteo-Parapente (screenshot)
    - Open-Meteo generated (with LLM analysis)
    - TopMeteo (screenshot)
    - Windy sounding (screenshot)

    Args:
        spot_latitude: Spot coordinates
        spot_longitude: Spot coordinates
        spot_name: Name for display
        forecast_hour: Hours ahead (0=now, 3=+3h, etc.)
        output_dir: Where to save images

    Returns:
        {
            "success": True,
            "spot_name": "Arguel",
            "latitude": 47.24,
            "longitude": 6.02,
            "emagrammes": [
                {
                    "source": "meteo-parapente",
                    "success": True,
                    "image_url": "/api/emagram/images/...",
                    "external_url": "https://meteo-parapente.com/#/sounding/47.24/6.02"
                },
                {
                    "source": "open-meteo",
                    "success": True,
                    "image_url": "/api/emagram/images/...",
                    "analysis": {
                        "cloud_base": 1200,
                        "ceiling": 2800,
                        "thermal_strength": "moderate",
                        ...
                    }
                },
                ...
            ],
            "timestamp": "2024-03-07T20:00:00"
        }
    """

    from scrapers.meteo_parapente_emagram import (
        fetch_meteo_parapente_emagram,
        fetch_topmeteo_emagram,
    )

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    emagrammes = []

    # Fetch all sources in parallel
    tasks = []

    # 1. Meteo-Parapente (screenshot)
    tasks.append(
        (
            "meteo-parapente",
            fetch_meteo_parapente_emagram(spot_latitude, spot_longitude, spot_name, output_dir),
        )
    )

    # 2. Open-Meteo (generate emagram + LLM analysis)
    tasks.append(
        (
            "open-meteo",
            fetch_and_generate_openmeteo(
                spot_latitude, spot_longitude, spot_name, forecast_hour, output_dir
            ),
        )
    )

    # 3. TopMeteo (screenshot)
    tasks.append(
        ("topmeteo", fetch_topmeteo_emagram(spot_latitude, spot_longitude, spot_name, output_dir))
    )

    # Execute all in parallel
    results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)

    # Process results
    for (source_name, _), result in zip(tasks, results, strict=False):
        if isinstance(result, Exception):
            emagrammes.append(
                {
                    "source": source_name,
                    "success": False,
                    "error": str(result),
                    "forecast_hour": None,  # Provider-specific: no data on error
                }
            )
        elif isinstance(result, dict):
            # Extract forecast_hour from result if present, otherwise null
            forecast_hour_value = result.get("forecast_hour", None)

            emagrammes.append(
                {
                    "source": source_name,
                    "forecast_hour": forecast_hour_value,  # Provider-specific
                    **result,
                }
            )

    # Count successes
    success_count = sum(1 for e in emagrammes if e.get("success"))

    return {
        "success": success_count > 0,
        "spot_name": spot_name,
        "latitude": spot_latitude,
        "longitude": spot_longitude,
        "emagrammes": emagrammes,
        "sources_available": success_count,
        "sources_total": len(emagrammes),
        "timestamp": datetime.now().isoformat(),
    }


async def fetch_and_generate_openmeteo(
    latitude: float, longitude: float, spot_name: str, forecast_hour: int, output_dir: str
) -> dict[str, Any]:
    """
    Fetch Open-Meteo data and generate emagram with analysis
    """
    from scrapers.emagram_generator import generate_emagram_from_openmeteo
    from scrapers.open_meteo_sounding import fetch_sounding_for_spot

    # Fetch sounding data
    sounding = await fetch_sounding_for_spot(latitude, longitude, spot_name, forecast_hour)

    if not sounding.get("success"):
        return sounding

    # Generate emagram image
    image_result = generate_emagram_from_openmeteo(sounding_data=sounding, output_dir=output_dir)

    if not image_result.get("success"):
        return image_result

    # TODO: Add LLM analysis here
    # For now, return just the image

    return {
        "success": True,
        "source": "open-meteo",
        "model": sounding.get("model", "GFS"),
        "image_path": image_result["image_path"],
        "sounding_data": sounding.get("data"),
        "forecast_hour": forecast_hour,
    }


# Quick links for external sources (no screenshot needed)
def get_emagram_external_links(latitude: float, longitude: float) -> list[dict[str, str]]:
    """
    Get direct links to external emagram sources
    Useful for "Open in new tab" buttons
    """
    return [
        {
            "source": "Meteo-Parapente",
            "url": f"https://meteo-parapente.com/#/sounding/{latitude}/{longitude}",
            "description": "Emagramme optimisé parapente",
        },
        {
            "source": "TopMeteo",
            "url": f"https://www.topmeteo.eu/fr/emagramme/{latitude}/{longitude}",
            "description": "Emagramme Europe",
        },
        {
            "source": "Windy Sounding",
            "url": f"https://www.windy.com/fr/{latitude}/{longitude}?temp,{latitude},{longitude},8",
            "description": "Sondage atmosphérique Windy",
        },
        {
            "source": "Meteociel Emagram",
            "url": f"https://www.meteociel.fr/modeles/sondage2.php?mode=0&lon={longitude}&lat={latitude}&ech=3&map=0",
            "description": "Emagramme Meteociel",
        },
    ]
