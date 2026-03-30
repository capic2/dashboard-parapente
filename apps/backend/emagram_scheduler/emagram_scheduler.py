"""
APScheduler for automatic multi-source emagram analysis
Runs every 3 hours to refresh emagram screenshots and LLM analysis
"""

import asyncio
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

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


def setup_emagram_scheduler(app):
    """
    Setup APScheduler for automatic emagram analysis

    Args:
        app: FastAPI application instance

    Returns:
        Configured scheduler instance
    """
    scheduler = AsyncIOScheduler(timezone=ZoneInfo("Europe/Paris"))

    # Multi-source emagram refresh: Every 3 hours at :15
    scheduler.add_job(
        run_scheduled_emagram_analysis,
        trigger=CronTrigger(hour="*/3", minute=15, timezone=ZoneInfo("Europe/Paris")),
        id="emagram_refresh",
        name="Multi-Source Emagram Refresh (Every 3 hours)",
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
    logger.info("  - Multi-source refresh: Every 3 hours at :15 (00:15, 03:15, 06:15, ...)")
    logger.info("  - Screenshot cleanup: Every hour at :05")

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
