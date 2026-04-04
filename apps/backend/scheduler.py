"""
Weather Scheduler - Fetch forecasts every hour for default sites
Uses APScheduler to run background tasks
"""

import asyncio
import logging
import uuid
from datetime import date, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Site, WeatherForecast
from para_index import analyze_hourly_slots, calculate_para_index, format_slots_summary
from weather_pipeline import get_normalized_forecast

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default sites to monitor - UPDATED with real site IDs from database
DEFAULT_SITES = [
    "site-arguel",
    "site-mont-poupet-ouest",
    "site-mont-poupet-nw",  # Nord-Ouest
    "site-mont-poupet-sud",
    "site-mont-poupet-nord",
    "site-la-cote",
]

scheduler = AsyncIOScheduler()

# Semaphore to limit concurrent database operations (prevent pool exhaustion)
_db_semaphore = asyncio.Semaphore(5)


async def fetch_and_store_weather(site_code: str, day_index: int = 0):
    """
    Fetch weather for a site and store in database

    Args:
        site_code: Site code (e.g., 'arguel')
        day_index: 0=today, 1=tomorrow
    """
    db = SessionLocal()

    try:
        # Get site from database
        site = db.query(Site).filter(Site.code == site_code).first()

        if not site:
            logger.error(f"Site not found: {site_code}")
            return

        logger.info(f"Fetching weather for {site.name} (day_index={day_index})...")

        # Fetch normalized forecast
        consensus = await get_normalized_forecast(site.latitude, site.longitude, day_index, db=db)

        if not consensus.get("success"):
            logger.error(f"Failed to fetch weather for {site.name}: {consensus.get('error')}")
            return

        # Calculate para_index
        consensus_hours = consensus.get("consensus", [])
        para_result = calculate_para_index(consensus_hours)

        # Analyze slots
        slots = analyze_hourly_slots(consensus_hours)
        slots_summary = format_slots_summary(slots)

        # Calculate statistics
        if consensus_hours:
            temps = [h["temperature"] for h in consensus_hours if h.get("temperature")]
            winds = [h["wind_speed"] for h in consensus_hours if h.get("wind_speed")]
            precips = [h["precipitation"] for h in consensus_hours if h.get("precipitation")]
            clouds = [h["cloud_cover"] for h in consensus_hours if h.get("cloud_cover")]

            avg_temp = sum(temps) / len(temps) if temps else None
            min_temp = min(temps) if temps else None
            max_temp = max(temps) if temps else None
            avg_wind = sum(winds) / len(winds) if winds else None
            max_wind = max(winds) if winds else None
            total_precip = sum(precips) if precips else 0
            avg_cloud = sum(clouds) / len(clouds) if clouds else None
        else:
            avg_temp = min_temp = max_temp = avg_wind = max_wind = total_precip = avg_cloud = None

        # Calculate forecast date
        forecast_date = date.today()
        if day_index == 1:
            from datetime import timedelta

            forecast_date = forecast_date + timedelta(days=1)

        # Store in database
        forecast = WeatherForecast(
            id=str(uuid.uuid4()),
            site_id=site.id,
            forecast_date=forecast_date,
            para_index=para_result["para_index"],
            wind_avg_kmh=round(avg_wind, 1) if avg_wind else None,
            wind_max_kmh=round(max_wind, 1) if max_wind else None,
            temperature_avg_c=round(avg_temp, 1) if avg_temp else None,
            temperature_min_c=round(min_temp, 1) if min_temp else None,
            temperature_max_c=round(max_temp, 1) if max_temp else None,
            precipitation_mm=round(total_precip, 1) if total_precip else None,
            cloud_cover_percent=round(avg_cloud) if avg_cloud else None,
            verdict=para_result["verdict"],
            flyable_slots=slots_summary,
            source="multi-source-consensus",
            created_at=datetime.now(),
        )

        # Check if forecast already exists for this date
        existing = (
            db.query(WeatherForecast)
            .filter(
                WeatherForecast.site_id == site.id, WeatherForecast.forecast_date == forecast_date
            )
            .first()
        )

        if existing:
            # Update existing forecast
            existing.para_index = forecast.para_index
            existing.wind_avg_kmh = forecast.wind_avg_kmh
            existing.wind_max_kmh = forecast.wind_max_kmh
            existing.temperature_avg_c = forecast.temperature_avg_c
            existing.temperature_min_c = forecast.temperature_min_c
            existing.temperature_max_c = forecast.temperature_max_c
            existing.precipitation_mm = forecast.precipitation_mm
            existing.cloud_cover_percent = forecast.cloud_cover_percent
            existing.verdict = forecast.verdict
            existing.flyable_slots = forecast.flyable_slots
            existing.source = forecast.source
            existing.created_at = forecast.created_at
            logger.info(
                f"✅ Updated forecast for {site.name} ({forecast_date}): {para_result['verdict']} ({para_result['para_index']}/100)"
            )
        else:
            # Create new forecast
            db.add(forecast)
            logger.info(
                f"✅ Stored forecast for {site.name} ({forecast_date}): {para_result['verdict']} ({para_result['para_index']}/100)"
            )

        db.commit()

    except Exception as e:
        logger.error(f"Error fetching weather for {site_code}: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


async def fetch_and_cache_weather(site_id: str, day_index: int = 0, db: Session = None):
    """
    Fetch weather for a site and populate Redis cache
    Used by scheduler for polling mode (replaces fetch_and_store_weather)

    Args:
        site_id: Site ID (e.g., 'site-arguel')
        day_index: 0=today, 1=tomorrow, etc.
        db: Optional database session (for testing)

    Returns:
        True if successful, False otherwise
    """
    # Use provided db or create new one
    if db is None:
        db = SessionLocal()
        close_db = True
    else:
        close_db = False

    # Limit concurrent database operations to prevent pool exhaustion
    async with _db_semaphore:

        try:
            # Get site from database
            site = db.query(Site).filter(Site.id == site_id).first()

            if not site:
                logger.error(f"Site not found: {site_id}")
                return False

            logger.info(f"Fetching {site.name} (day {day_index})...")

            # Fetch normalized forecast (will auto-cache via weather_pipeline.py)
            result = await get_normalized_forecast(
                lat=site.latitude,
                lon=site.longitude,
                day_index=day_index,
                site_name=site.name,
                elevation_m=site.elevation_m,
                db=db,
            )

            if result.get("success"):
                logger.info(f"✅ Cached {site.name} day {day_index}")
                return True
            else:
                logger.error(f"❌ Failed {site.name} day {day_index}: {result.get('error')}")
                return False

        except Exception as e:
            logger.error(f"Error fetching {site_id} day {day_index}: {e}", exc_info=True)
            return False
        finally:
            if close_db:
                db.close()


async def scheduled_weather_fetch():
    """
    Main scheduled task - fetch weather for all default sites
    OPTIMIZATION: Only polls day 0-1 (today/tomorrow) - most consulted
    Days 2-6 are fetched on-demand and cached for 30min
    Runs every hour
    """
    logger.info(f"⏰ Scheduled weather fetch started at {datetime.now()}")

    tasks = []

    # Fetch today and tomorrow ONLY (most consulted days)
    for site_id in DEFAULT_SITES:
        tasks.append(fetch_and_cache_weather(site_id, day_index=0))  # Today
        tasks.append(fetch_and_cache_weather(site_id, day_index=1))  # Tomorrow

    # Execute all fetches in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Log results
    success_count = sum(1 for r in results if r and not isinstance(r, Exception))
    logger.info(
        f"✅ Scheduled fetch completed: {success_count}/{len(tasks)} succeeded at {datetime.now()}"
    )

    # Refresh best spot cache after weather data is updated
    try:
        from best_spot import refresh_best_spot_cache

        db = SessionLocal()
        try:
            await refresh_best_spot_cache(db)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error refreshing best spot cache: {e}", exc_info=True)


def _get_scheduler_interval() -> int:
    """Read scheduler interval from app_settings (fallback to config/default)."""
    try:
        from app_settings import get_setting_int
        from database import get_db_context

        with get_db_context() as db:
            interval = get_setting_int("scheduler_interval_minutes", db=db, default=30)
        return interval if interval > 0 else 30
    except Exception:
        try:
            from config import SCHEDULER_INTERVAL_MINUTES

            return SCHEDULER_INTERVAL_MINUTES if SCHEDULER_INTERVAL_MINUTES > 0 else 30
        except Exception:
            return 30


def start_scheduler():
    """
    Start weather scheduler - polls at configurable interval for today/tomorrow data

    Configuration:
    - Interval read from app_settings (default: 30 min)
    - Polls 6 sites × 2 days (today + tomorrow)
    - Results cached in Redis
    - Days 2-6 fetched on-demand only
    """
    interval = _get_scheduler_interval()
    logger.info(f"🚀 Starting weather scheduler (interval: {interval} min)...")

    scheduler.add_job(
        scheduled_weather_fetch,
        trigger=IntervalTrigger(minutes=interval),
        id="weather_fetch",
        name=f"Weather fetch every {interval} min (6 sites × 2 days)",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(f"✅ Scheduler started - running every {interval} minutes")


def reschedule(interval_minutes: int):
    """Reschedule the weather fetch job with a new interval (called from API)."""
    if interval_minutes <= 0:
        raise ValueError("scheduler interval must be > 0 minutes")
    scheduler.reschedule_job(
        "weather_fetch",
        trigger=IntervalTrigger(minutes=interval_minutes),
    )
    logger.info(f"✅ Scheduler rescheduled to every {interval_minutes} minutes")


def stop_scheduler():
    """Stop the scheduler"""
    try:
        if scheduler.running:
            scheduler.shutdown(wait=True)
            logger.info("⏹️ Weather scheduler stopped")
    except Exception as e:
        logger.warning(f"⚠️ Error stopping scheduler (may already be stopped): {e}")


# Manual trigger for testing
async def manual_fetch_all():
    """
    Manually trigger a fetch for all sites
    Useful for testing or on-demand updates
    """
    await scheduled_weather_fetch()
