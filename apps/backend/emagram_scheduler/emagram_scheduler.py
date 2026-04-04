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
    Run multi-source emagram analysis for all active sites
    Called by scheduler every 3 hours
    """
    from database import get_db_context
    from emagram_multi_source import generate_multi_source_emagram_for_spot
    from models import Site

    logger.info("📸 Starting scheduled multi-source emagram analysis...")

    success_count = 0
    error_count = 0

    # Get all active sites from database
    with get_db_context() as db:
        sites = db.query(Site).filter(Site.latitude.isnot(None), Site.longitude.isnot(None)).all()

        logger.info(f"Found {len(sites)} sites to analyze")

    # Process each site (using db context from above loop)
    for site in sites:
        try:
            logger.info(f"Analyzing {site.name} ({site.id})...")

            # Run complete multi-source workflow
            with get_db_context() as db_session:
                result = await generate_multi_source_emagram_for_spot(
                    site_id=site.id,
                    db=db_session,
                    force_refresh=False,  # Use cache if < 3 hours old
                )

            if result.get("success"):
                score = result.get("analysis", {}).get("score_volabilite", 0)
                logger.info(f"  ✅ {site.name}: Score {score}/100")
                success_count += 1
            else:
                logger.warning(f"  ❌ {site.name}: {result.get('error')}")
                error_count += 1

            # Small delay between sites to avoid overwhelming servers
            await asyncio.sleep(5)

        except Exception as e:
            logger.error(f"  ❌ Error analyzing {site.name}: {e}", exc_info=True)
            error_count += 1

    logger.info(
        f"✅ Scheduled emagram analysis complete: {success_count} success, {error_count} errors"
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
    """Read scheduler interval from app_settings (same as weather scheduler)."""
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
