"""
Multi-Source Emagram Orchestrator
Coordinates screenshot capture, LLM analysis, and database storage
"""

import uuid
import json
from datetime import datetime, date, time as dt_time
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
import logging

from scrapers.emagram_screenshots import fetch_all_emagram_screenshots
from llm.multi_emagram_analyzer import analyze_emagrammes_with_fallback
from llm.acp_analyzer import analyze_emagram_with_acp
from llm.gemini_analyzer import analyze_emagram_with_gemini
from models import Site, EmagramAnalysis
import os

logger = logging.getLogger(__name__)


async def generate_multi_source_emagram_for_spot(
    site_id: str,
    db: Session,
    force_refresh: bool = False
) -> Dict[str, Any]:
    """
    Complete workflow to generate multi-source emagram analysis for a spot
    
    1. Fetch spot coordinates from database
    2. Screenshot 3 emagram sources in parallel
    3. Analyze with Claude Vision API
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
            return {
                "success": False,
                "error": f"Site {site_id} not found"
            }
        
        if not site.latitude or not site.longitude:
            logger.error(f"Site {site_id} has no coordinates")
            return {
                "success": False,
                "error": f"Site {site_id} has no coordinates"
            }
        
        logger.info(f"🎯 Starting multi-source emagram analysis for {site.name}")
        
        # Step 2: Check for recent analysis (unless force_refresh)
        if not force_refresh:
            from datetime import timedelta
            cutoff_time = datetime.utcnow() - timedelta(hours=3)
            
            existing = db.query(EmagramAnalysis).filter(
                EmagramAnalysis.station_code == site_id,
                EmagramAnalysis.analysis_datetime >= cutoff_time,
                EmagramAnalysis.analysis_status == "completed"
            ).order_by(EmagramAnalysis.analysis_datetime.desc()).first()
            
            if existing:
                logger.info(f"✅ Found recent analysis from {existing.analysis_datetime}, using cache")
                return emagram_analysis_to_dict(existing)
        
        # Step 3: Fetch screenshots from all sources
        screenshot_result = await fetch_all_emagram_screenshots(
            spot_id=site.id,
            latitude=site.latitude,
            longitude=site.longitude,
            spot_name=site.name
        )
        
        if not screenshot_result.get("success"):
            logger.error(f"Screenshot fetch failed: {screenshot_result.get('error')}")
            return {
                "success": False,
                "error": "Failed to fetch emagram screenshots",
                "details": screenshot_result
            }
        
        screenshots = screenshot_result.get("screenshots", [])
        successful_screenshots = [s for s in screenshots if s.get("success")]
        
        if not successful_screenshots:
            logger.error("No screenshots were successful")
            return {
                "success": False,
                "error": "All screenshot sources failed",
                "screenshots": screenshots
            }
        
        logger.info(f"📸 {len(successful_screenshots)}/3 screenshots successful")
        
        # Step 4: Analyze with AI (priority: Gemini > ACP > Anthropic direct)
        image_paths = [s["image_path"] for s in successful_screenshots]
        sources = [s["source"] for s in successful_screenshots]
        
        analysis_result = None
        
        # Priority 1: Try Gemini if API key is available
        google_api_key = os.getenv("GOOGLE_API_KEY")
        if google_api_key:
            try:
                logger.info("🔷 Trying Gemini Vision analysis...")
                gemini_analysis = analyze_emagram_with_gemini(
                    screenshot_paths=image_paths,
                    spot_name=site.name,
                    coordinates=(site.latitude, site.longitude),
                    api_key=google_api_key,
                    model_name=os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp"),
                    max_retries=3
                )
                
                # Convert to expected format
                analysis_result = {
                    "success": True,
                    "plafond_thermique_m": gemini_analysis["plafond_thermique_m"],
                    "force_thermique_ms": gemini_analysis["force_thermique_ms"],
                    "heures_volables": gemini_analysis["heures_volables"],
                    "score_volabilite": gemini_analysis["score_volabilite"],
                    "conseils_vol": gemini_analysis["conseils_vol"],
                    "alertes_securite": gemini_analysis["alertes_securite"],
                    "details_analyse": gemini_analysis["details_analyse"],
                    "analyzer": "gemini"
                }
                logger.info(f"🔷 Gemini analysis successful!")
                
            except Exception as e:
                logger.warning(f"Gemini analysis failed: {e}")
                analysis_result = None
        
        # Priority 2: Try OpenClaw ACP if enabled and Gemini failed
        if not analysis_result and os.getenv("OPENCLAW_ACP_ENABLED", "false").lower() == "true":
            try:
                logger.info("🦞 Trying OpenClaw ACP analysis...")
                acp_analysis = analyze_emagram_with_acp(
                    screenshot_paths=image_paths,
                    spot_name=site.name,
                    coordinates=(site.latitude, site.longitude),
                    openclaw_command=os.getenv("OPENCLAW_COMMAND", "openclaw"),
                    agent_id=os.getenv("OPENCLAW_AGENT_ID"),
                    timeout=int(os.getenv("OPENCLAW_TIMEOUT", "120"))
                )
                
                # Convert to expected format
                analysis_result = {
                    "success": True,
                    "plafond_thermique_m": acp_analysis["plafond_thermique_m"],
                    "force_thermique_ms": acp_analysis["force_thermique_ms"],
                    "heures_volables": acp_analysis["heures_volables"],
                    "score_volabilite": acp_analysis["score_volabilite"],
                    "conseils_vol": acp_analysis["conseils_vol"],
                    "alertes_securite": acp_analysis["alertes_securite"],
                    "details_analyse": acp_analysis["details_analyse"],
                    "analyzer": "openclaw_acp"
                }
                logger.info(f"🦞 OpenClaw ACP analysis successful!")
                
            except Exception as e:
                logger.warning(f"OpenClaw ACP failed: {e}")
                analysis_result = None
        
        # Priority 3: Fallback to Anthropic direct API
        if not analysis_result:
            logger.info("🤖 Using Anthropic direct API (fallback)...")
            analysis_result = await analyze_emagrammes_with_fallback(
                image_paths=image_paths,
                spot_name=site.name,
                sources=sources
            )
        
        if not analysis_result.get("success"):
            logger.error(f"LLM analysis failed: {analysis_result.get('error')}")
            # Save failed analysis to DB for debugging
            save_failed_analysis(db, site, screenshot_result, analysis_result)
            return {
                "success": False,
                "error": "LLM analysis failed",
                "details": analysis_result
            }
        
        analyzer_used = analysis_result.get("analyzer", "unknown")
        logger.info(f"🤖 LLM analysis successful ({analyzer_used}): Score {analysis_result.get('score_volabilite')}/100")
        
        # Step 5: Save to database
        emagram_analysis = save_emagram_analysis(
            db=db,
            site=site,
            screenshot_result=screenshot_result,
            analysis_result=analysis_result
        )
        
        logger.info(f"✅ Multi-source emagram analysis complete for {site.name}")
        
        return emagram_analysis_to_dict(emagram_analysis)
    
    except Exception as e:
        logger.error(f"Error in multi-source emagram generation: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }


def save_emagram_analysis(
    db: Session,
    site: Site,
    screenshot_result: Dict[str, Any],
    analysis_result: Dict[str, Any]
) -> EmagramAnalysis:
    """
    Save emagram analysis to database
    """
    
    now = datetime.utcnow()
    analysis_id = str(uuid.uuid4())
    
    # Build external URLs JSON
    external_urls = {}
    for screenshot in screenshot_result.get("screenshots", []):
        if screenshot.get("success"):
            external_urls[screenshot["source"]] = screenshot["external_url"]
    
    # Create EmagramAnalysis object
    emagram = EmagramAnalysis(
        id=analysis_id,
        analysis_date=now.date(),
        analysis_time=now.time(),
        analysis_datetime=now,
        
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
        alertes_securite=json.dumps(analysis_result.get("alertes_securite", []), ensure_ascii=False),
        
        # Cloud data
        lcl_m=analysis_result.get("base_nuages_m"),  # Map to LCL field
        
        # Raw data storage (new fields for multi-source)
        external_source_urls=json.dumps(external_urls, ensure_ascii=False),
        sources_count=screenshot_result.get("sources_successful", 0),
        sources_agreement=analysis_result.get("sources_agreement"),
        
        ai_raw_response=analysis_result.get("raw_response"),
        
        # Status
        analysis_status="completed"
    )
    
    db.add(emagram)
    db.commit()
    db.refresh(emagram)
    
    logger.info(f"💾 Saved emagram analysis {analysis_id} to database")
    
    return emagram


def save_failed_analysis(
    db: Session,
    site: Site,
    screenshot_result: Dict[str, Any],
    analysis_result: Dict[str, Any]
):
    """
    Save failed analysis attempt for debugging
    """
    now = datetime.utcnow()
    
    emagram = EmagramAnalysis(
        id=str(uuid.uuid4()),
        analysis_date=now.date(),
        analysis_time=now.time(),
        analysis_datetime=now,
        
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
        
        ai_raw_response=json.dumps(analysis_result, ensure_ascii=False)
    )
    
    db.add(emagram)
    db.commit()
    
    logger.warning(f"⚠️ Saved failed analysis attempt to database")


def parse_time_string(time_str: Optional[str]) -> Optional[dt_time]:
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


def emagram_analysis_to_dict(emagram: EmagramAnalysis) -> Dict[str, Any]:
    """
    Convert EmagramAnalysis model to dictionary for API response
    """
    
    # Parse JSON fields
    try:
        external_urls = json.loads(emagram.external_source_urls) if emagram.external_source_urls else {}
    except:
        external_urls = {}
    
    try:
        alertes = json.loads(emagram.alertes_securite) if emagram.alertes_securite else []
    except:
        alertes = []
    
    return {
        "success": emagram.analysis_status == "completed",
        "analysis_id": emagram.id,
        "spot_name": emagram.station_name,
        "spot_id": emagram.station_code,
        "last_update": emagram.analysis_datetime.isoformat(),
        
        # External links to source emagrammes
        "external_links": [
            {"source": source, "url": url}
            for source, url in external_urls.items()
        ],
        
        # Analysis results
        "analysis": {
            "plafond_thermique_m": emagram.plafond_thermique_m,
            "force_thermique_ms": emagram.force_thermique_ms,
            "base_nuages_m": emagram.lcl_m,
            "heure_debut_thermiques": emagram.heure_debut_thermiques.strftime("%H:%M") if emagram.heure_debut_thermiques else None,
            "heure_fin_thermiques": emagram.heure_fin_thermiques.strftime("%H:%M") if emagram.heure_fin_thermiques else None,
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
        "sources_count": emagram.sources_count,
        "sources_agreement": emagram.sources_agreement,
        "llm_provider": emagram.llm_provider,
        "llm_cost_usd": emagram.llm_cost_usd,
        
        # Next update (3 hours from last update)
        "next_update": (emagram.analysis_datetime.replace(tzinfo=None) + 
                       __import__('datetime').timedelta(hours=3)).isoformat(),
    }
