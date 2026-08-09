"""
Tests for backend startup behavior (main.py)
"""

from unittest.mock import AsyncMock, patch

import pytest


def test_health_check_route_is_not_intercepted_by_spa_catch_all(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_route_returns_api_status_when_frontend_is_missing(client, tmp_path, monkeypatch):
    import main

    monkeypatch.setattr(main, "STATIC_DIR", tmp_path)

    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root_route_serves_frontend_index_when_built(client, tmp_path, monkeypatch):
    import main

    (tmp_path / "index.html").write_text("<html><body>frontend</body></html>")
    monkeypatch.setattr(main, "STATIC_DIR", tmp_path)

    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "frontend" in response.text


@pytest.mark.asyncio
async def test_initial_cache_warmup_runs_scheduled_fetch():
    """Startup cache warmup should populate Redis through the scheduler fetch."""

    with patch("scheduler.scheduled_weather_fetch", new=AsyncMock()) as mock_fetch:
        from main import initial_cache_warmup

        await initial_cache_warmup()

    mock_fetch.assert_awaited_once()


def test_trigger_initial_cache_warmup_starts_background_task():
    """Cache warmup should be scheduled without blocking application startup."""

    created_tasks = []

    def fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()
        return object()

    with patch("main.asyncio.create_task", side_effect=fake_create_task):
        from main import trigger_initial_cache_warmup

        trigger_initial_cache_warmup()

    assert len(created_tasks) == 1


@pytest.mark.asyncio
async def test_lifespan_starts_schedulers_when_enabled():

    class DummyDb:
        def close(self):
            return None

    with (
        patch("main.config.SCHEDULER_ENABLED", True),
        patch("app_settings.reload_cache") as mock_reload_cache,
        patch("main.SessionLocal") as mock_session_local,
        patch("main.start_scheduler") as mock_start_weather_scheduler,
        patch("main.stop_scheduler") as mock_stop_weather_scheduler,
        patch("main.start_video_export_worker"),
        patch("main.stop_video_export_worker") as mock_stop_video_export_worker,
        patch("main.trigger_initial_cache_warmup") as mock_trigger_cache_warmup,
        patch("cache.close_redis", new=AsyncMock()) as mock_close_redis,
        patch("emagram_scheduler.emagram_scheduler.setup_emagram_scheduler") as mock_setup_emagram,
        patch("emagram_scheduler.emagram_scheduler.start_scheduler") as mock_start_emagram,
    ):
        mock_session_local.return_value = DummyDb()
        mock_setup_emagram.return_value = object()
        from main import app, lifespan

        cm = lifespan(app)
        await cm.__aenter__()

        mock_trigger_cache_warmup.assert_called_once()
        mock_reload_cache.assert_called_once()
        mock_start_weather_scheduler.assert_called_once()
        mock_setup_emagram.assert_called_once_with(app)
        mock_start_emagram.assert_called_once_with(mock_setup_emagram.return_value)

        await cm.__aexit__(None, None, None)

        mock_stop_weather_scheduler.assert_called_once()
        mock_stop_video_export_worker.assert_called_once()
        mock_close_redis.assert_awaited_once()
