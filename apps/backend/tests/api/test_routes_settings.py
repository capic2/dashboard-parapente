"""
API tests for /settings endpoints.

Tests HTTP endpoints for reading and updating application settings.
"""

from unittest.mock import AsyncMock, patch

import app_settings
from models import AppSetting

API_PREFIX = "/api"


class TestGetSettings:
    """Tests for GET /settings"""

    def setup_method(self):
        app_settings.invalidate_cache()

    def test_get_settings_empty_table(self, client, db_session):
        """Returns default settings when no settings exist."""
        response = client.get(f"{API_PREFIX}/settings")
        assert response.status_code == 200
        data = response.json()
        assert "video_export_dir" not in data
        assert "video_temp_images_dir" not in data
        assert data["default_flight_objective"] == "tranquille"

    def test_get_settings_returns_all(self, client, db_session):
        """Returns all settings as key-value pairs."""
        db_session.add(AppSetting(key="cache_ttl_default", value="1800"))
        db_session.add(AppSetting(key="scheduler_interval_minutes", value="15"))
        db_session.commit()

        response = client.get(f"{API_PREFIX}/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["cache_ttl_default"] == "1800"
        assert data["scheduler_interval_minutes"] == "15"
        assert "video_export_dir" not in data

    def test_get_settings_ignores_retired_video_storage_keys(self, client, db_session):
        """Retired video storage keys are not exposed even if old rows exist."""
        db_session.add(AppSetting(key="video_export_dir", value="/mnt/old-exports"))
        db_session.add(AppSetting(key="video_temp_images_dir", value="/mnt/old-temp"))
        db_session.commit()

        response = client.get(f"{API_PREFIX}/settings")
        assert response.status_code == 200
        data = response.json()
        assert "video_export_dir" not in data
        assert "video_temp_images_dir" not in data


class TestUpdateSettings:
    """Tests for PUT /settings"""

    def setup_method(self):
        app_settings.invalidate_cache()

    def test_update_known_key(self, client, db_session):
        """Updates a known setting and persists it."""
        db_session.add(AppSetting(key="cache_ttl_default", value="3600"))
        db_session.commit()

        response = client.put(
            f"{API_PREFIX}/settings",
            json={"cache_ttl_default": "1800"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["updated"]["cache_ttl_default"] == "1800"

        # Verify persisted
        row = db_session.query(AppSetting).filter(AppSetting.key == "cache_ttl_default").first()
        assert row.value == "1800"

    def test_rejects_unknown_keys(self, client, db_session):
        """Unknown keys are rejected, not persisted, and reported."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={"unknown_key": "value", "cache_ttl_default": "900"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "unknown_key" in data["rejected_keys"]
        assert "cache_ttl_default" in data["updated"]

        # Verify unknown key was NOT persisted
        row = db_session.query(AppSetting).filter(AppSetting.key == "unknown_key").first()
        assert row is None

    def test_update_multiple_keys(self, client, db_session):
        """Can update multiple settings at once."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={
                "cache_ttl_default": "900",
                "cache_ttl_summary": "1800",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["updated"]) == 2

    def test_cache_sensitive_settings_invalidate_weather_cache(self, client, db_session):
        """Settings that affect displayed weather clear cached weather responses."""
        with patch("cache.delete_cached", new_callable=AsyncMock) as delete_cached:
            response = client.put(
                f"{API_PREFIX}/settings",
                json={"para_gust_high_max": "26"},
            )

        assert response.status_code == 200
        delete_cached.assert_any_await("weather:*")
        delete_cached.assert_any_await("best_spot:*")
        assert delete_cached.await_count == 2

    def test_non_cache_sensitive_settings_do_not_clear_weather_cache(self, client, db_session):
        """Scheduler-only changes should not evict weather response caches."""
        with (
            patch("cache.delete_cached", new_callable=AsyncMock) as delete_cached,
            patch("scheduler.reschedule"),
            patch("emagram_scheduler.emagram_scheduler.reschedule"),
        ):
            response = client.put(
                f"{API_PREFIX}/settings",
                json={"scheduler_interval_minutes": "15"},
            )

        assert response.status_code == 200
        delete_cached.assert_not_awaited()

    def test_update_emagram_max_age_minutes(self, client, db_session):
        """Updates emagram freshness window setting."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={"emagram_max_age_minutes": "120"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["updated"]["emagram_max_age_minutes"] == "120"

        row = (
            db_session.query(AppSetting).filter(AppSetting.key == "emagram_max_age_minutes").first()
        )
        assert row is not None
        assert row.value == "120"

    def test_update_spotair_live_wind_settings(self, client, db_session):
        """Updates SpotAiR live wind settings and persists normalized values."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={
                "spotair_live_wind_radius_km": "12.0",
                "spotair_live_wind_cache_ttl_seconds": "420",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"]["spotair_live_wind_radius_km"] == "12"
        assert data["updated"]["spotair_live_wind_cache_ttl_seconds"] == "420"

        radius_row = (
            db_session.query(AppSetting)
            .filter(AppSetting.key == "spotair_live_wind_radius_km")
            .first()
        )
        ttl_row = (
            db_session.query(AppSetting)
            .filter(AppSetting.key == "spotair_live_wind_cache_ttl_seconds")
            .first()
        )
        assert radius_row is not None and radius_row.value == "12"
        assert ttl_row is not None and ttl_row.value == "420"

    def test_update_default_flight_objective(self, client, db_session):
        """Updates the default flight objective when the value is known."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={"default_flight_objective": "thermique"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"]["default_flight_objective"] == "thermique"

        row = (
            db_session.query(AppSetting)
            .filter(AppSetting.key == "default_flight_objective")
            .first()
        )
        assert row is not None and row.value == "thermique"

    def test_rejects_invalid_default_flight_objective(self, client, db_session):
        """Rejects unknown flight objectives without persisting them."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={"default_flight_objective": "distance"},
        )
        assert response.status_code == 400
        assert "default_flight_objective must be one of" in response.json()["detail"]

        row = (
            db_session.query(AppSetting)
            .filter(AppSetting.key == "default_flight_objective")
            .first()
        )
        assert row is None

    def test_rejects_retired_video_storage_settings(self, client, db_session):
        """Video storage folders are managed by Docker volume mapping only."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={
                "video_export_dir": "  /mnt/videos/exports  ",
                "video_temp_images_dir": "/mnt/videos/temp-images",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] == {}
        assert data["rejected_keys"] == ["video_export_dir", "video_temp_images_dir"]

        export_row = (
            db_session.query(AppSetting).filter(AppSetting.key == "video_export_dir").first()
        )
        temp_row = (
            db_session.query(AppSetting).filter(AppSetting.key == "video_temp_images_dir").first()
        )
        assert export_row is None
        assert temp_row is None

    def test_rejects_invalid_spotair_live_wind_settings(self, client, db_session):
        """Rejects out-of-range SpotAiR live wind radius and non-positive TTL."""
        radius_response = client.put(
            f"{API_PREFIX}/settings",
            json={"spotair_live_wind_radius_km": "0.5"},
        )
        assert radius_response.status_code == 400
        assert "between 1 and 50" in radius_response.json()["detail"]

        ttl_response = client.put(
            f"{API_PREFIX}/settings",
            json={"spotair_live_wind_cache_ttl_seconds": "0"},
        )
        assert ttl_response.status_code == 400
        assert ttl_response.json()["detail"] == "spotair_live_wind_cache_ttl_seconds must be > 0"

    def test_validates_and_normalizes_float_thresholds(self, client, db_session):
        """Float thresholds are normalized and reject non-finite / out-of-range values."""
        valid_response = client.put(
            f"{API_PREFIX}/settings",
            json={"para_gust_high_max": "25.0"},
        )
        assert valid_response.status_code == 200
        assert valid_response.json()["updated"]["para_gust_high_max"] == "25"

        row = db_session.query(AppSetting).filter(AppSetting.key == "para_gust_high_max").first()
        assert row is not None
        assert row.value == "25"

        invalid_cases = [
            ("NaN", "finite number"),
            ("inf", "finite number"),
            ("-inf", "finite number"),
            ("151", "between 0 and 150"),
        ]

        for value, detail_fragment in invalid_cases:
            response = client.put(
                f"{API_PREFIX}/settings",
                json={"para_gust_low_max": value},
            )
            assert response.status_code == 400
            assert detail_fragment in response.json()["detail"]

            row = db_session.query(AppSetting).filter(AppSetting.key == "para_gust_low_max").first()
            assert row is None

        verdict_response = client.put(
            f"{API_PREFIX}/settings",
            json={"para_verdict_good_min": "101"},
        )
        assert verdict_response.status_code == 400
        assert "between 0 and 100" in verdict_response.json()["detail"]

    def test_rejects_non_monotonic_threshold_groups(self, client, db_session):
        """Threshold families must keep their expected ordering."""
        wind_response = client.put(
            f"{API_PREFIX}/settings",
            json={"para_wind_low_max": "20"},
        )
        assert wind_response.status_code == 400
        assert "para_wind thresholds" in wind_response.json()["detail"]

        verdict_response = client.put(
            f"{API_PREFIX}/settings",
            json={"para_verdict_good_min": "20"},
        )
        assert verdict_response.status_code == 400
        assert "para_verdict thresholds" in verdict_response.json()["detail"]

    def test_rejects_invalid_emagram_max_age_minutes(self, client, db_session):
        """Invalid emagram freshness values are rejected with 400."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={"emagram_max_age_minutes": "abc"},
        )
        assert response.status_code == 400
        assert "positive integer" in response.json()["detail"]

        row = (
            db_session.query(AppSetting).filter(AppSetting.key == "emagram_max_age_minutes").first()
        )
        assert row is None

    def test_rejects_non_positive_emagram_max_age_minutes(self, client, db_session):
        """Zero and negative emagram freshness values are rejected."""
        for value in ("0", "-1"):
            response = client.put(
                f"{API_PREFIX}/settings",
                json={"emagram_max_age_minutes": value},
            )
            assert response.status_code == 400
            assert response.json()["detail"] == "emagram_max_age_minutes must be > 0"

            row = (
                db_session.query(AppSetting)
                .filter(AppSetting.key == "emagram_max_age_minutes")
                .first()
            )
            assert row is None

    def test_rejects_invalid_setting_without_partial_persist(self, client, db_session):
        """Mixed payloads must not persist valid keys when one value is invalid."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={
                "cache_ttl_default": "1800",
                "emagram_max_age_minutes": "abc",
            },
        )
        assert response.status_code == 400
        assert "positive integer" in response.json()["detail"]

        valid_row = (
            db_session.query(AppSetting).filter(AppSetting.key == "cache_ttl_default").first()
        )
        invalid_row = (
            db_session.query(AppSetting).filter(AppSetting.key == "emagram_max_age_minutes").first()
        )
        assert valid_row is None
        assert invalid_row is None

    def test_update_creates_setting_if_missing(self, client, db_session):
        """Creates new row if setting key doesn't exist in DB yet."""
        response = client.put(
            f"{API_PREFIX}/settings",
            json={"cache_ttl_default": "7200"},
        )
        assert response.status_code == 200

        row = db_session.query(AppSetting).filter(AppSetting.key == "cache_ttl_default").first()
        assert row is not None
        assert row.value == "7200"

    def test_update_empty_body(self, client, db_session):
        """Empty body succeeds with no updates."""
        response = client.put(f"{API_PREFIX}/settings", json={})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["updated"] == {}

    def test_scheduler_reschedule_warning_on_failure(self, client, db_session):
        """Returns scheduler_warning when reschedule fails."""
        with (
            patch("scheduler.reschedule", side_effect=ValueError("test error")),
            patch("emagram_scheduler.emagram_scheduler.reschedule"),
        ):
            response = client.put(
                f"{API_PREFIX}/settings",
                json={"scheduler_interval_minutes": "15"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "scheduler_warning" in data
        assert "test error" in data["scheduler_warning"]
