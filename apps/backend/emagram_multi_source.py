"""
Multi-Source Emagram Orchestrator
Coordinates screenshot capture, LLM analysis, and database storage
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from datetime import time as dt_time
from typing import Any

from sqlalchemy.orm import Session

import config
from emagram_freshness import get_emagram_cutoff_utc, get_emagram_next_update_utc
from llm.exceptions import QuotaExhaustedError
from llm.gemini_analyzer import analyze_emagram_with_gemini
from llm.groq_analyzer import analyze_emagram_with_groq
from llm.openrouter_analyzer import analyze_emagram_with_openrouter
from models import EmagramAnalysis, Site
from scrapers.emagram_screenshots import fetch_all_emagram_screenshots

logger = logging.getLogger(__name__)

GOOGLE_API_ENV_VAR = "BACKEND_GOOGLE_API_KEY"
GROQ_API_ENV_VAR = "BACKEND_GROQ_API_KEY"
OPENROUTER_API_ENV_VAR = "BACKEND_OPENROUTER_API_KEY"

PROVIDER_ENV_VARS = {
    "google": GOOGLE_API_ENV_VAR,
    "groq": GROQ_API_ENV_VAR,
    "openrouter": OPENROUTER_API_ENV_VAR,
}


def _configured_llm_providers() -> list[dict[str, Any]]:
    providers = {
        "groq": {
            "key": config.GROQ_API_KEY,
            "provider": "groq",
            "analyzer": "groq",
            "model": config.GROQ_MODEL,
            "label": "Groq Llama Vision",
            "free": True,
            "call": lambda image_paths, site: analyze_emagram_with_groq(
                screenshot_paths=image_paths,
                spot_name=site.name,
                coordinates=(site.latitude, site.longitude),
                model_name=config.GROQ_MODEL,
            ),
        },
        "openrouter": {
            "key": config.OPENROUTER_API_KEY,
            "provider": "openrouter",
            "analyzer": "openrouter",
            "model": config.OPENROUTER_MODEL,
            "label": "OpenRouter Vision",
            "free": True,
            "call": lambda image_paths, site: analyze_emagram_with_openrouter(
                screenshot_paths=image_paths,
                spot_name=site.name,
                coordinates=(site.latitude, site.longitude),
                model_name=config.OPENROUTER_MODEL,
            ),
        },
        "google": {
            "key": config.GOOGLE_API_KEY,
            "provider": "google",
            "analyzer": "gemini",
            "model": config.GEMINI_MODEL,
            "label": "Gemini Vision",
            "free": False,
            "call": lambda image_paths, site: analyze_emagram_with_gemini(
                screenshot_paths=image_paths,
                spot_name=site.name,
                coordinates=(site.latitude, site.longitude),
                api_key=config.GOOGLE_API_KEY,
                model_name=config.GEMINI_MODEL,
                max_retries=3,
            ),
        },
    }

    configured = []
    seen = set()
    for provider_name in config.LLM_FALLBACK_ORDER:
        if provider_name in seen:
            continue
        seen.add(provider_name)

        provider = providers.get(provider_name)
        if not provider:
            logger.warning(f"Unknown LLM provider in fallback order: {provider_name}")
            continue

        logger.info(
            "🔍 Checking %s availability: API Key = %s",
            provider["label"],
            "SET" if provider["key"] else "NOT SET",
        )
        if provider["key"]:
            configured.append(provider)

    return configured


def _analyze_emagram_with_fallbacks(image_paths: list[str], site: Site) -> dict[str, Any]:
    analysis_errors = []
    quota_errors = 0
    providers_tried = 0
    configured_providers = _configured_llm_providers()

    if not configured_providers:
        env_vars = ", ".join(PROVIDER_ENV_VARS.values())
        return {"success": False, "error": f"No LLM provider configured (set one of {env_vars})"}

    for provider in configured_providers:
        providers_tried += 1
        free_label = " (free)" if provider["free"] else ""
        logger.info(f"🤖 Trying {provider['label']} analysis{free_label}...")
        logger.info(f"   Model: {provider['model']}")

        try:
            raw_analysis = provider["call"](image_paths, site)
            analysis_result = _normalize_llm_analysis(raw_analysis, provider)
            if not _is_usable_llm_analysis(analysis_result):
                raise RuntimeError("LLM response is incomplete or unusable")

            logger.info(f"🤖 {provider['label']} analysis successful!")
            return analysis_result

        except QuotaExhaustedError as e:
            quota_errors += 1
            analysis_errors.append(f"{provider['provider']}: quota exhausted ({e})")
            logger.warning(f"⚠️ {provider['label']} quota exhausted, trying next provider")
        except Exception as e:
            analysis_errors.append(f"{provider['provider']}: {e}")
            logger.warning(f"{provider['label']} analysis failed: {e}")

    if quota_errors > 0 and quota_errors >= providers_tried:
        raise QuotaExhaustedError(
            f"All {providers_tried} configured LLM providers exhausted their quota"
        )

    return {
        "success": False,
        "error": "All configured LLM providers failed",
        "provider_errors": analysis_errors,
    }


def _normalize_llm_analysis(
    raw_analysis: dict[str, Any], provider: dict[str, Any]
) -> dict[str, Any]:
    return {
        "success": True,
        "plafond_thermique_m": raw_analysis.get("plafond_thermique_m"),
        "force_thermique_ms": raw_analysis.get("force_thermique_ms"),
        "heures_volables": raw_analysis.get("heures_volables"),
        "score_volabilite": raw_analysis.get("score_volabilite"),
        "conseils_vol": raw_analysis.get("conseils_vol"),
        "alertes_securite": raw_analysis.get("alertes_securite", []),
        "details_analyse": raw_analysis.get("details_analyse"),
        "explication_analyse": raw_analysis.get("explication_analyse"),
        "llm_provider": provider["provider"],
        "llm_model": raw_analysis.get("llm_model", provider["model"]),
        "llm_tokens_used": raw_analysis.get("llm_tokens_used"),
        "llm_cost_usd": raw_analysis.get("llm_cost_usd"),
        "analyzer": provider["analyzer"],
    }


def _is_usable_llm_analysis(analysis: dict[str, Any]) -> bool:
    required_fields = [
        "plafond_thermique_m",
        "force_thermique_ms",
        "heures_volables",
        "score_volabilite",
        "conseils_vol",
        "alertes_securite",
        "details_analyse",
    ]
    if any(analysis.get(field) is None for field in required_fields):
        return False

    details = str(analysis.get("details_analyse", "")).lower()
    advice = str(analysis.get("conseils_vol", "")).lower()
    failure_phrases = ["erreur de parsing", "analyse impossible"]
    return not any(phrase in details or phrase in advice for phrase in failure_phrases)


async def generate_multi_source_emagram_for_spot(
    site_id: str,
    db: Session,
    force_refresh: bool = False,
    day_index: int = 0,
    hour: int | None = None,
) -> dict[str, Any]:
    """
    Complete workflow to generate multi-source emagram analysis for a spot

    1. Fetch spot coordinates from database
    2. Screenshot 3 emagram sources in parallel
    3. Analyze with AI vision providers
    4. Save EmagramAnalysis to database
    5. Return analysis results

    Args:
        site_id: Site identifier (e.g., "arguel")
        db: Database session
        force_refresh: Skip cache and force new analysis

    Returns:
        {
            "success": True/False,
            "analysis_id": "uuid",
            "spot_name": "Arguel",
            "plafond_thermique_m": 2800,
            "score_volabilite": 75,
            ...
        }
    """

    try:
        # Step 1: Get site from database
        site = db.query(Site).filter(Site.id == site_id).first()

        if not site:
            logger.error(f"Site {site_id} not found in database")
            return {"success": False, "error": f"Site {site_id} not found"}

        if not site.latitude or not site.longitude:
            logger.error(f"Site {site_id} has no coordinates")
            return {"success": False, "error": f"Site {site_id} has no coordinates"}

        logger.info(f"🎯 Starting multi-source emagram analysis for {site.name}")

        # Compute forecast target date
        from datetime import timedelta

        forecast_date = (datetime.utcnow() + timedelta(days=day_index)).date()

        # Step 2: Check for recent analysis (unless force_refresh)
        if not force_refresh:
            cutoff_time = get_emagram_cutoff_utc(db=db)

            cache_filters = [
                EmagramAnalysis.station_code == site_id,
                EmagramAnalysis.analysis_method == "llm_vision",
                EmagramAnalysis.analysis_datetime >= cutoff_time,
                EmagramAnalysis.analysis_status == "completed",
                EmagramAnalysis.forecast_date == forecast_date,
            ]
            if hour is not None:
                cache_filters.append(EmagramAnalysis.forecast_hour == hour)

            existing = (
                db.query(EmagramAnalysis)
                .filter(*cache_filters)
                .order_by(EmagramAnalysis.analysis_datetime.desc())
                .first()
            )

            if existing:
                logger.info(
                    f"✅ Found recent analysis from {existing.analysis_datetime}, using cache"
                )
                return emagram_analysis_to_dict(existing, db=db)

        # Step 3: Fetch screenshots from all sources
        screenshot_result = await fetch_all_emagram_screenshots(
            spot_id=site.id,
            latitude=site.latitude,
            longitude=site.longitude,
            spot_name=site.name,
            day_index=day_index,
            hour=hour,
        )

        if not screenshot_result.get("success"):
            logger.error(f"Screenshot fetch failed: {screenshot_result.get('error')}")
            return {
                "success": False,
                "error": "Failed to fetch emagram screenshots",
                "details": screenshot_result,
            }

        screenshots = screenshot_result.get("screenshots", [])
        successful_screenshots = [s for s in screenshots if s.get("success")]

        if not successful_screenshots:
            logger.error("No screenshots were successful")
            return {
                "success": False,
                "error": "All screenshot sources failed",
                "screenshots": screenshots,
            }

        logger.info(f"📸 {len(successful_screenshots)}/3 screenshots successful")

        # Step 4: Analyze with AI using the configured fallback chain.
        image_paths = [s["image_path"] for s in successful_screenshots]
        analysis_result = _analyze_emagram_with_fallbacks(image_paths, site)

        if not analysis_result.get("success"):
            logger.error(f"LLM analysis failed: {analysis_result.get('error')}")
            # Save failed analysis to DB for debugging
            save_failed_analysis(
                db,
                site,
                screenshot_result,
                analysis_result,
                forecast_date=forecast_date,
                forecast_hour=hour,
            )
            return {"success": False, "error": "LLM analysis failed", "details": analysis_result}

        analyzer_used = analysis_result.get("analyzer", "unknown")
        logger.info(
            f"🤖 LLM analysis successful ({analyzer_used}): Score {analysis_result.get('score_volabilite')}/100"
        )

        # Step 5: Save to database
        emagram_analysis = save_emagram_analysis(
            db=db,
            site=site,
            screenshot_result=screenshot_result,
            analysis_result=analysis_result,
            forecast_date=forecast_date,
            forecast_hour=hour,
        )

        logger.info(f"✅ Multi-source emagram analysis complete for {site.name}")

        return emagram_analysis_to_dict(emagram_analysis, db=db)

    except Exception as e:
        logger.error(f"Error in multi-source emagram generation: {e}", exc_info=True)
        return {"success": False, "error": f"Unexpected error: {str(e)}"}


def save_emagram_analysis(
    db: Session,
    site: Site,
    screenshot_result: dict[str, Any],
    analysis_result: dict[str, Any],
    forecast_date=None,
    forecast_hour: int | None = None,
) -> EmagramAnalysis:
    """
    Save emagram analysis to database
    """

    now = datetime.utcnow()
    analysis_id = str(uuid.uuid4())

    # Build external URLs, screenshot paths, and source errors JSON
    external_urls = {}
    screenshot_paths = {}
    sources_errors = {}
    for screenshot in screenshot_result.get("screenshots", []):
        if screenshot.get("success"):
            source_name = screenshot["source"]
            external_urls[source_name] = screenshot["external_url"]
            screenshot_paths[source_name] = screenshot.get("image_path", "")
        else:
            source_name = screenshot.get("source", "unknown")
            sources_errors[source_name] = screenshot.get("error", "Unknown error")

    # Create EmagramAnalysis object
    emagram = EmagramAnalysis(
        id=analysis_id,
        analysis_date=now.date(),
        analysis_time=now.time(),
        analysis_datetime=now,
        forecast_date=forecast_date or now.date(),
        forecast_hour=forecast_hour,
        # Station info (using site_id as station_code for multi-source)
        station_code=site.id,
        station_name=site.name,
        station_latitude=site.latitude,
        station_longitude=site.longitude,
        distance_km=0.0,  # Multi-source is spot-specific, not from remote station
        # Data source info
        data_source="multi-source-vision",
        sounding_time=f"{now.hour}Z",
        llm_provider=analysis_result.get("llm_provider"),
        llm_model=analysis_result.get("llm_model"),
        llm_tokens_used=analysis_result.get("llm_tokens_used"),
        llm_cost_usd=analysis_result.get("llm_cost_usd"),
        analysis_method="llm_vision",
        # Analysis results
        plafond_thermique_m=analysis_result.get("plafond_thermique_m"),
        force_thermique_ms=analysis_result.get("force_thermique_ms"),
        stabilite_atmospherique=analysis_result.get("stabilite_atmospherique"),
        cisaillement_vent=analysis_result.get("cisaillement_vent"),
        risque_orage=analysis_result.get("risque_orage"),
        score_volabilite=analysis_result.get("score_volabilite"),
        # Parse time strings to time objects
        heure_debut_thermiques=parse_time_string(analysis_result.get("heure_debut_thermiques")),
        heure_fin_thermiques=parse_time_string(analysis_result.get("heure_fin_thermiques")),
        heures_volables_total=analysis_result.get("heures_volables_total"),
        # Text results
        resume_conditions=analysis_result.get("resume_conditions"),
        conseils_vol=analysis_result.get("conseils_vol"),
        alertes_securite=json.dumps(
            analysis_result.get("alertes_securite", []), ensure_ascii=False
        ),
        # Cloud data
        lcl_m=analysis_result.get("base_nuages_m"),  # Map to LCL field
        # Raw data storage (new fields for multi-source)
        external_source_urls=json.dumps(external_urls, ensure_ascii=False),
        screenshot_paths=json.dumps(screenshot_paths, ensure_ascii=False),
        sources_count=screenshot_result.get("sources_successful", 0),
        sources_agreement=analysis_result.get("sources_agreement"),
        sources_errors=json.dumps(sources_errors, ensure_ascii=False) if sources_errors else None,
        ai_raw_response=json.dumps(analysis_result, ensure_ascii=False),
        # Status
        analysis_status="completed",
    )

    db.add(emagram)
    db.commit()
    db.refresh(emagram)

    logger.info(f"💾 Saved emagram analysis {analysis_id} to database")

    return emagram


def save_failed_analysis(
    db: Session,
    site: Site,
    screenshot_result: dict[str, Any],
    analysis_result: dict[str, Any],
    forecast_date=None,
    forecast_hour: int | None = None,
):
    """
    Save failed analysis attempt for debugging
    """
    now = datetime.utcnow()

    # Collect per-source errors
    sources_errors = {}
    for screenshot in screenshot_result.get("screenshots", []):
        if not screenshot.get("success"):
            source_name = screenshot.get("source", "unknown")
            sources_errors[source_name] = screenshot.get("error", "Unknown error")

    emagram = EmagramAnalysis(
        id=str(uuid.uuid4()),
        analysis_date=now.date(),
        analysis_time=now.time(),
        analysis_datetime=now,
        forecast_date=forecast_date or now.date(),
        forecast_hour=forecast_hour,
        station_code=site.id,
        station_name=site.name,
        station_latitude=site.latitude,
        station_longitude=site.longitude,
        distance_km=0.0,
        data_source="multi-source-vision",
        sounding_time=f"{now.hour}Z",
        analysis_method="llm_vision",
        analysis_status="failed",
        error_message=analysis_result.get("error", "Unknown error"),
        sources_errors=json.dumps(sources_errors, ensure_ascii=False) if sources_errors else None,
        ai_raw_response=json.dumps(analysis_result, ensure_ascii=False),
    )

    db.add(emagram)
    db.commit()

    logger.warning("⚠️ Saved failed analysis attempt to database")


def parse_time_string(time_str: str | None) -> dt_time | None:
    """
    Parse time string like "11:00" to time object
    """
    if not time_str:
        return None

    try:
        hour, minute = time_str.split(":")
        return dt_time(int(hour), int(minute))
    except Exception as e:
        logger.warning(f"Failed to parse time '{time_str}': {e}")
        return None


def emagram_analysis_to_dict(emagram: EmagramAnalysis, db: Session | None = None) -> dict[str, Any]:
    """
    Convert EmagramAnalysis model to dictionary for API response
    """

    # Parse JSON fields
    try:
        external_urls = (
            json.loads(emagram.external_source_urls) if emagram.external_source_urls else {}
        )
    except (ValueError, TypeError, json.JSONDecodeError):
        external_urls = {}

    try:
        alertes = json.loads(emagram.alertes_securite) if emagram.alertes_securite else []
    except (ValueError, TypeError, json.JSONDecodeError):
        alertes = []

    return {
        "success": emagram.analysis_status == "completed",
        "analysis_id": emagram.id,
        "spot_name": emagram.station_name,
        "spot_id": emagram.station_code,
        "last_update": emagram.analysis_datetime.isoformat(),
        # External links to source emagrammes
        "external_links": [{"source": source, "url": url} for source, url in external_urls.items()],
        # Analysis results
        "analysis": {
            "plafond_thermique_m": emagram.plafond_thermique_m,
            "force_thermique_ms": emagram.force_thermique_ms,
            "base_nuages_m": emagram.lcl_m,
            "heure_debut_thermiques": (
                emagram.heure_debut_thermiques.strftime("%H:%M")
                if emagram.heure_debut_thermiques
                else None
            ),
            "heure_fin_thermiques": (
                emagram.heure_fin_thermiques.strftime("%H:%M")
                if emagram.heure_fin_thermiques
                else None
            ),
            "heures_volables_total": emagram.heures_volables_total,
            "stabilite_atmospherique": emagram.stabilite_atmospherique,
            "cisaillement_vent": emagram.cisaillement_vent,
            "risque_orage": emagram.risque_orage,
            "score_volabilite": emagram.score_volabilite,
            "resume_conditions": emagram.resume_conditions,
            "conseils_vol": emagram.conseils_vol,
            "alertes_securite": alertes,
        },
        # Metadata
        "forecast_date": emagram.forecast_date.isoformat() if emagram.forecast_date else None,
        "forecast_hour": emagram.forecast_hour,
        "sources_count": emagram.sources_count,
        "sources_agreement": emagram.sources_agreement,
        "llm_provider": emagram.llm_provider,
        "llm_cost_usd": emagram.llm_cost_usd,
        # Next update (configured freshness window from last update)
        "next_update": get_emagram_next_update_utc(emagram.analysis_datetime, db=db).isoformat(),
    }


async def generate_hourly_emagram_for_spot(
    site_id: str,
    db: Session,
    force_refresh: bool = False,
    day_index: int = 0,
) -> list[dict[str, Any]]:
    """
    Generate emagram analyses for every hour between sunrise and sunset.

    Uses the weather pipeline to determine sunrise/sunset, then calls
    generate_multi_source_emagram_for_spot for each hour.
    """
    from weather_pipeline import get_normalized_forecast

    # Get site coordinates
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site or not site.latitude or not site.longitude:
        logger.error(f"Site {site_id} not found or has no coordinates")
        return [{"success": False, "error": f"Site {site_id} not found or has no coordinates"}]

    # Get sunrise/sunset from weather pipeline
    try:
        forecast = await get_normalized_forecast(
            lat=site.latitude,
            lon=site.longitude,
            day_index=day_index,
            db=db,
        )
        sunrise = forecast.get("sunrise")  # "HH:MM"
        sunset = forecast.get("sunset")  # "HH:MM"
    except Exception as e:
        logger.warning(f"Could not get sunrise/sunset: {e}, using defaults")
        sunrise = None
        sunset = None

    # Parse hours, with seasonal defaults for France
    start_hour = int(sunrise.split(":")[0]) if sunrise else 7
    end_hour = int(sunset.split(":")[0]) if sunset else 20
    hours = list(range(start_hour, end_hour + 1))

    logger.info(
        f"Generating hourly emagram for {site.name}: "
        f"hours {start_hour}-{end_hour} ({len(hours)} hours)"
    )

    results = []
    for h in hours:
        try:
            result = await generate_multi_source_emagram_for_spot(
                site_id=site_id,
                db=db,
                force_refresh=force_refresh,
                day_index=day_index,
                hour=h,
            )
            results.append(result)
        except QuotaExhaustedError:
            logger.warning(f"⚠️ LLM quota exhausted at hour {h} for {site.name}, stopping")
            raise  # Propagate to scheduler to stop all remaining sites/days
        except Exception as e:
            logger.error(f"Hour {h} failed for {site.name}: {e}")
            results.append({"success": False, "hour": h, "error": str(e)})

        # Small delay between hours to avoid rate limiting
        await asyncio.sleep(2)

    success_count = sum(1 for r in results if r.get("success"))
    logger.info(
        f"Hourly emagram complete for {site.name}: "
        f"{success_count}/{len(hours)} hours successful"
    )
    return results
