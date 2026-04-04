"""
API tests for /settings endpoints.

Tests HTTP endpoints for reading and updating application settings.
"""

from unittest.mock import patch

import app_settings
from models import AppSetting

API_PREFIX = "/api"


class TestGetSettings:
    """Tests for GET /settings"""

    def setup_method(self):
        app_settings.invalidate_cache()

    def test_get_settings_empty_table(self, client, db_session):
        """Returns empty dict when no settings exist."""
        response = client.get(f"{API_PREFIX}/settings")
        assert response.status_code == 200
        assert response.json() == {}

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
