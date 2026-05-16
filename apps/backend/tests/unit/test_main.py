"""
Tests for backend startup behavior (main.py)
"""

from unittest.mock import AsyncMock, patch

import pytest


def test_schedule_strava_token_refresh_job_forces_refresh():
    """Strava refresh job should be registered in forced mode."""

    with patch("main.scheduler") as mock_scheduler:
        from main import schedule_strava_token_refresh_job

        schedule_strava_token_refresh_job()

        mock_scheduler.add_job.assert_called_once()

        _, kwargs = mock_scheduler.add_job.call_args

        assert kwargs["kwargs"]["force"] is True
        assert kwargs["id"] == "strava_token_refresh"


@pytest.mark.asyncio
async def test_initial_strava_token_refresh_forces_refresh():
    """Initial startup refresh should force a token exchange immediately."""

    with patch("strava.refresh_access_token", new=AsyncMock(return_value="token")) as mock_refresh:
        from main import initial_strava_token_refresh

        await initial_strava_token_refresh()

    mock_refresh.assert_awaited_once_with(force=True)


@pytest.mark.asyncio
async def test_lifespan_starts_strava_job_when_scheduler_enabled():
    """Lifespan should register Strava refresh job when scheduler is enabled."""

    class DummyDb:
        def close(self):
            return None

    created_tasks = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()
        return object()

    with (
        patch("main.config.SCHEDULER_ENABLED", True),
        patch("app_settings.reload_cache") as mock_reload_cache,
        patch("main.SessionLocal") as mock_session_local,
        patch("main.start_scheduler") as mock_start_weather_scheduler,
        patch("main.stop_scheduler") as mock_stop_weather_scheduler,
        patch("main.start_video_export_worker"),
        patch("main.stop_video_export_worker") as mock_stop_video_export_worker,
        patch("main.schedule_strava_token_refresh_job") as mock_schedule_strava,
        patch("main.trigger_initial_strava_token_refresh") as mock_trigger_initial_strava,
        patch("cache.close_redis", new=AsyncMock()) as mock_close_redis,
        patch("emagram_scheduler.emagram_scheduler.setup_emagram_scheduler") as mock_setup_emagram,
        patch("emagram_scheduler.emagram_scheduler.start_scheduler") as mock_start_emagram,
        patch("main.asyncio.create_task", side_effect=fake_create_task),
    ):
        mock_session_local.return_value = DummyDb()
        mock_setup_emagram.return_value = object()
        from main import app, lifespan

        cm = lifespan(app)
        await cm.__aenter__()

        assert mock_schedule_strava.call_count == 1
        mock_trigger_initial_strava.assert_called_once()
        mock_reload_cache.assert_called_once()
        mock_start_weather_scheduler.assert_called_once()
        mock_setup_emagram.assert_called_once_with(app)
        mock_start_emagram.assert_called_once_with(mock_setup_emagram.return_value)
        assert len(created_tasks) == 1

        await cm.__aexit__(None, None, None)

        mock_stop_weather_scheduler.assert_called_once()
        mock_stop_video_export_worker.assert_called_once()
        mock_close_redis.assert_awaited_once()
