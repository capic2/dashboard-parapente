"""
APScheduler for automatic multi-source emagram analysis
Runs every 3 hours to refresh emagram screenshots and LLM analysis
"""

import asyncio
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)


async def run_scheduled_emagram_analysis():
    """
    Run multi-source emagram analysis for all active sites.
    Analyzes today (J), tomorrow (J+1), and day after (J+2).
    Skips sites/days with MAUVAIS weather verdict to save LLM credits.

    Uses round-robin across sites: processes one hour per site before moving
    to the next hour. This ensures all sites get at least some hourly data
    even if the LLM quota runs out mid-cycle.
    """
    from database import get_db_context
    from emagram_multi_source import generate_multi_source_emagram_for_spot
    from llm.exceptions import QuotaExhaustedError
    from models import Site
    from weather_pipeline import get_normalized_forecast

    logger.info("📸 Starting scheduled hourly emagram analysis (J, J+1, J+2) — round-robin...")

    success_count = 0
    error_count = 0
    skipped_count = 0

    # Get all active sites from database
    with get_db_context() as db:
        sites = db.query(Site).filter(Site.latitude.isnot(None), Site.longitude.isnot(None)).all()

        logger.info(f"Found {len(sites)} sites to analyze")

    # Phase 1: Build per-site hour ranges and filter out MAUVAIS days
    # Structure: list of (site, day_index, hours_list)
    site_day_hours: list[tuple] = []

    for site in sites:
        for day_index in range(3):
            try:
                with get_db_context() as db_session:
                    forecast = await get_normalized_forecast(
                        lat=site.latitude,
                        lon=site.longitude,
                        day_index=day_index,
                        db=db_session,
                    )
                verdict = forecast.get("verdict", "").upper()
                if verdict == "MAUVAIS":
                    logger.info(f"  ⏭️ Skipping {site.name} day+{day_index} — verdict MAUVAIS")
                    skipped_count += 1
                    continue

                sunrise = forecast.get("sunrise")
                sunset = forecast.get("sunset")
                start_hour = int(sunrise.split(":")[0]) if sunrise else 7
                end_hour = int(sunset.split(":")[0]) if sunset else 20
                hours = list(range(start_hour, end_hour + 1))
                site_day_hours.append((site, day_index, hours))

            except Exception as e:
                logger.error(f"  ❌ Error getting forecast for {site.name} day+{day_index}: {e}")
                error_count += 1

    if not site_day_hours:
        logger.info("No sites/days to analyze (all skipped or errored)")
        return

    # Phase 2: Round-robin — iterate hour by hour across all site/day combos
    # Find the maximum number of hours across all entries
    max_hours = max(len(hours) for _, _, hours in site_day_hours)

    logger.info(f"Round-robin: {len(site_day_hours)} site/day combos, up to {max_hours} hours each")

    for hour_idx in range(max_hours):
        for site, day_index, hours in site_day_hours:
            if hour_idx >= len(hours):
                continue
            hour = hours[hour_idx]

            try:
                with get_db_context() as db_session:
                    result = await generate_multi_source_emagram_for_spot(
                        site_id=site.id,
                        db=db_session,
                        force_refresh=False,
                        day_index=day_index,
                        hour=hour,
                    )

                if result.get("success"):
                    success_count += 1
                else:
                    error_count += 1

                await asyncio.sleep(2)

            except QuotaExhaustedError as e:
                logger.warning(
                    f"  ⚠️ LLM quota exhausted during {site.name} day+{day_index} h{hour}: {e}"
                )
                logger.warning("  Stopping all remaining analyses for this scheduler cycle.")
                logger.info(
                    f"✅ Scheduled hourly emagram analysis stopped early (quota exhausted): "
                    f"{success_count} success, {error_count} errors, {skipped_count} skipped"
                )
                return
            except Exception as e:
                logger.error(
                    f"  ❌ Error analyzing {site.name} day+{day_index} h{hour}: {e}",
                    exc_info=True,
                )
                error_count += 1

    logger.info(
        f"✅ Scheduled hourly emagram analysis complete: "
        f"{success_count} success, {error_count} errors, {skipped_count} skipped (MAUVAIS)"
    )


async def cleanup_old_emagram_screenshots():
    """
    Clean up screenshot images no longer referenced by latest analyses.
    Files younger than 1 hour are never deleted (race-condition guard).
    Called every hour by scheduler
    """
    from scrapers.emagram_screenshots import cleanup_old_screenshots

    logger.info("🗑️ Running emagram screenshot cleanup...")
    deleted = cleanup_old_screenshots(max_age_hours=1)

    if deleted > 0:
        logger.info(f"✅ Cleanup complete: {deleted} old screenshots deleted")
    else:
        logger.debug("No old screenshots to clean up")


_scheduler: AsyncIOScheduler | None = None


def _get_scheduler_interval() -> int:
    """Read emagram-specific scheduler interval (default: 180 min = 3h, matches cache TTL)."""
    try:
        from app_settings import get_setting_int
        from database import get_db_context

        with get_db_context() as db:
            interval = get_setting_int("emagram_scheduler_interval_minutes", db=db, default=180)
        return interval if interval > 0 else 180
    except Exception:
        return 180


def setup_emagram_scheduler(app):
    """
    Setup APScheduler for automatic emagram analysis

    Args:
        app: FastAPI application instance

    Returns:
        Configured scheduler instance
    """
    global _scheduler
    interval = _get_scheduler_interval()
    scheduler = AsyncIOScheduler(timezone=ZoneInfo("Europe/Paris"))
    _scheduler = scheduler

    # Multi-source emagram refresh: same interval as weather scheduler
    scheduler.add_job(
        run_scheduled_emagram_analysis,
        trigger=IntervalTrigger(minutes=interval),
        id="emagram_refresh",
        name=f"Multi-Source Emagram Refresh (Every {interval} min)",
        replace_existing=True,
    )

    # Screenshot cleanup: Every hour at :05
    scheduler.add_job(
        cleanup_old_emagram_screenshots,
        trigger=CronTrigger(minute=5, timezone=ZoneInfo("Europe/Paris")),
        id="emagram_cleanup",
        name="Emagram Screenshot Cleanup (Hourly)",
        replace_existing=True,
    )

    logger.info("📅 Emagram scheduler configured:")
    logger.info(f"  - Multi-source refresh: Every {interval} minutes")
    logger.info("  - Screenshot cleanup: Every hour at :05")

    # Register shutdown event
    @app.on_event("shutdown")
    async def shutdown_scheduler():
        logger.info("Shutting down emagram scheduler...")
        scheduler.shutdown()

    return scheduler


def reschedule(interval_minutes: int):
    """Reschedule the emagram refresh job with a new interval (called from API)."""
    if _scheduler is None:
        raise RuntimeError("Emagram scheduler not initialized")
    if interval_minutes <= 0:
        raise ValueError("scheduler interval must be > 0 minutes")
    _scheduler.reschedule_job(
        "emagram_refresh",
        trigger=IntervalTrigger(minutes=interval_minutes),
    )
    logger.info(f"✅ Emagram scheduler rescheduled to every {interval_minutes} minutes")


def start_scheduler(scheduler):
    """
    Start the scheduler

    Args:
        scheduler: Configured scheduler instance
    """
    scheduler.start()
    logger.info("✅ Emagram scheduler started")
