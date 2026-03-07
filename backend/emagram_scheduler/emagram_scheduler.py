"""
APScheduler for automatic emagram analysis
Runs 2x/day at 6:15am and 2:15pm local time (Europe/Paris)
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
from zoneinfo import ZoneInfo
import logging
import os
import asyncio

logger = logging.getLogger(__name__)

# Default user locations for automatic analysis (can be extended)
# Format: (latitude, longitude, location_name)
DEFAULT_LOCATIONS = [
    (45.76, 4.84, "Lyon"),
    (48.85, 2.35, "Paris"),
    (43.60, 1.44, "Toulouse"),
    (43.70, 7.27, "Nice"),
    (44.84, -0.58, "Bordeaux"),
]


async def run_scheduled_emagram_analysis():
    """
    Run emagram analysis for all default locations
    Called by scheduler at 6:15am and 2:15pm
    """
    from database import get_db_context
    from scrapers.wyoming import fetch_closest_sounding
    from scrapers.emagram_generator import generate_emagram_from_wyoming
    from llm.vision_analyzer import analyze_emagram_with_fallback
    from models import EmagramAnalysis
    from schemas import EmagramAnalysisCreate
    import uuid
    
    logger.info("🌡️ Starting scheduled emagram analysis...")
    
    # Determine sounding time based on current hour
    paris_tz = ZoneInfo("Europe/Paris")
    now_paris = datetime.now(paris_tz)
    current_hour = now_paris.hour
    
    # 6:15am run uses 00Z sounding (from night)
    # 2:15pm run uses 12Z sounding (from noon)
    if 5 <= current_hour < 12:
        sounding_time = "00"
        logger.info("Morning run: using 00Z sounding")
    else:
        sounding_time = "12"
        logger.info("Afternoon run: using 12Z sounding")
    
    success_count = 0
    error_count = 0
    
    for lat, lon, location_name in DEFAULT_LOCATIONS:
        try:
            logger.info(f"Analyzing {location_name} ({lat}, {lon})...")
            
            # Check if analysis already exists for today + this sounding time
            with get_db_context() as db:
                today = datetime.utcnow().date()
                existing = db.query(EmagramAnalysis).filter(
                    EmagramAnalysis.analysis_date == today,
                    EmagramAnalysis.sounding_time == sounding_time + "Z"
                ).first()
                
                if existing:
                    logger.info(f"  Skipping {location_name} - analysis already exists for today")
                    continue
            
            # Fetch sounding
            sounding_result = await fetch_closest_sounding(
                user_lat=lat,
                user_lon=lon,
                sounding_time=sounding_time
            )
            
            if not sounding_result.get("success"):
                logger.warning(f"  Failed to fetch sounding for {location_name}: {sounding_result.get('error')}")
                error_count += 1
                continue
            
            # Generate Skew-T
            image_result = generate_emagram_from_wyoming(
                wyoming_result=sounding_result,
                output_dir="/app/data/emagram_images"  # Persistent storage
            )
            
            if not image_result.get("success"):
                logger.warning(f"  Failed to generate Skew-T for {location_name}: {image_result.get('error')}")
                error_count += 1
                continue
            
            # Analyze with LLM or fallback
            analysis_result = await analyze_emagram_with_fallback(
                image_path=image_result["image_path"],
                sounding_data=sounding_result["data"],
                station_name=sounding_result["station_name"],
                station_latitude=sounding_result["station_latitude"]
            )
            
            if not analysis_result.get("success"):
                logger.warning(f"  Analysis failed for {location_name}: {analysis_result.get('error')}")
                error_count += 1
                continue
            
            # Save to database
            with get_db_context() as db:
                now = datetime.utcnow()
                analysis_id = str(uuid.uuid4())
                
                emagram_create = EmagramAnalysisCreate(
                    analysis_date=now.date(),
                    analysis_time=now.time(),
                    station_code=sounding_result["station_code"],
                    station_name=sounding_result["station_name"],
                    station_latitude=sounding_result["station_latitude"],
                    station_longitude=sounding_result["station_longitude"],
                    distance_km=sounding_result["distance_km"],
                    data_source="wyoming",
                    sounding_time=sounding_result["sounding_time"],
                    analysis_method=analysis_result["method"],
                    
                    llm_provider=analysis_result.get("provider"),
                    llm_model=analysis_result.get("model"),
                    llm_tokens_used=analysis_result.get("tokens_used"),
                    llm_cost_usd=analysis_result.get("cost_usd"),
                    
                    plafond_thermique_m=analysis_result.get("plafond_thermique_m"),
                    force_thermique_ms=analysis_result.get("force_thermique_ms"),
                    cape_jkg=analysis_result.get("cape_jkg"),
                    stabilite_atmospherique=analysis_result.get("stabilite_atmospherique"),
                    cisaillement_vent=analysis_result.get("cisaillement_vent"),
                    heure_debut_thermiques=analysis_result.get("heure_debut_thermiques"),
                    heure_fin_thermiques=analysis_result.get("heure_fin_thermiques"),
                    heures_volables_total=analysis_result.get("heures_volables_total"),
                    risque_orage=analysis_result.get("risque_orage"),
                    score_volabilite=analysis_result.get("score_volabilite"),
                    
                    resume_conditions=analysis_result.get("resume_conditions"),
                    conseils_vol=analysis_result.get("conseils_vol"),
                    alertes_securite=analysis_result.get("alertes_securite"),
                    
                    lcl_m=analysis_result.get("lcl_m"),
                    lfc_m=analysis_result.get("lfc_m"),
                    el_m=analysis_result.get("el_m"),
                    lifted_index=analysis_result.get("lifted_index"),
                    k_index=analysis_result.get("k_index"),
                    total_totals=analysis_result.get("total_totals"),
                    showalter_index=analysis_result.get("showalter_index"),
                    
                    skewt_image_path=image_result["image_path"],
                    raw_sounding_data=sounding_result.get("raw_text"),
                    ai_raw_response=analysis_result.get("raw_response"),
                    
                    analysis_status="completed"
                )
                
                db_analysis = EmagramAnalysis(
                    id=analysis_id,
                    analysis_datetime=now,
                    **emagram_create.model_dump()
                )
                
                db.add(db_analysis)
                db.commit()
            
            logger.info(f"  ✅ {location_name}: Score {analysis_result.get('score_volabilite', 0)}/100")
            success_count += 1
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(2)
            
        except Exception as e:
            logger.error(f"  ❌ Error analyzing {location_name}: {e}", exc_info=True)
            error_count += 1
    
    logger.info(f"✅ Scheduled emagram analysis complete: {success_count} success, {error_count} errors")


def setup_emagram_scheduler(app):
    """
    Setup APScheduler for automatic emagram analysis
    
    Args:
        app: FastAPI application instance
    
    Returns:
        Configured scheduler instance
    """
    scheduler = AsyncIOScheduler(timezone=ZoneInfo("Europe/Paris"))
    
    # Morning run: 6:15am Paris time (analyzes 00Z sounding)
    scheduler.add_job(
        run_scheduled_emagram_analysis,
        trigger=CronTrigger(hour=6, minute=15, timezone=ZoneInfo("Europe/Paris")),
        id="emagram_morning",
        name="Emagram Analysis (Morning - 00Z)",
        replace_existing=True
    )
    
    # Afternoon run: 2:15pm Paris time (analyzes 12Z sounding)
    scheduler.add_job(
        run_scheduled_emagram_analysis,
        trigger=CronTrigger(hour=14, minute=15, timezone=ZoneInfo("Europe/Paris")),
        id="emagram_afternoon",
        name="Emagram Analysis (Afternoon - 12Z)",
        replace_existing=True
    )
    
    logger.info("📅 Emagram scheduler configured:")
    logger.info("  - Morning run: 6:15am Paris time (00Z sounding)")
    logger.info("  - Afternoon run: 2:15pm Paris time (12Z sounding)")
    
    # Register shutdown event
    @app.on_event("shutdown")
    async def shutdown_scheduler():
        logger.info("Shutting down emagram scheduler...")
        scheduler.shutdown()
    
    return scheduler


def start_scheduler(scheduler):
    """
    Start the scheduler
    
    Args:
        scheduler: Configured scheduler instance
    """
    scheduler.start()
    logger.info("✅ Emagram scheduler started")
