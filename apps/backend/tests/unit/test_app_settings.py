"""
Unit tests for app_settings module.
Tests the in-memory cache, DB read/write, and fallback logic.
"""

from models import AppSetting

import app_settings


class TestGetSetting:
    """Tests for get_setting() fallback priority."""

    def setup_method(self):
        """Reset the in-memory cache before each test."""
        app_settings.invalidate_cache()

    def test_returns_from_memory_cache(self, db_session):
        """Memory cache is checked first."""
        app_settings._settings_cache["test_key"] = "cached_value"
        app_settings._cache_loaded = True

        result = app_settings.get_setting("test_key", db=db_session)
        assert result == "cached_value"

    def test_returns_from_db_when_cache_empty(self, db_session):
        """Falls back to DB when cache miss and cache not loaded."""
        setting = AppSetting(key="db_key", value="db_value")
        db_session.add(setting)
        db_session.commit()

        result = app_settings.get_setting("db_key", db=db_session)
        assert result == "db_value"
        # Should also populate cache
        assert app_settings._settings_cache["db_key"] == "db_value"

    def test_returns_defaults_before_default_param(self):
        """DEFAULTS dict takes priority over the default parameter."""
        # "cache_ttl_default" is in DEFAULTS with value "3600"
        result = app_settings.get_setting("cache_ttl_default", default="9999")
        assert result == "3600"

    def test_returns_default_param_for_unknown_key(self):
        """Falls back to default param for keys not in DEFAULTS."""
        result = app_settings.get_setting("unknown_key", default="fallback")
        assert result == "fallback"

    def test_returns_empty_string_when_no_fallback(self):
        """Returns empty string when no match and no default."""
        result = app_settings.get_setting("totally_unknown")
        assert result == ""


class TestGetSettingInt:
    """Tests for get_setting_int()."""

    def setup_method(self):
        app_settings.invalidate_cache()

    def test_returns_integer(self):
        app_settings._settings_cache["cache_ttl_default"] = "1800"
        app_settings._cache_loaded = True

        result = app_settings.get_setting_int("cache_ttl_default")
        assert result == 1800

    def test_returns_default_on_invalid_value(self):
        app_settings._settings_cache["bad_key"] = "not_a_number"
        app_settings._cache_loaded = True

        result = app_settings.get_setting_int("bad_key", default=42)
        assert result == 42


class TestSetSetting:
    """Tests for set_setting()."""

    def setup_method(self):
        app_settings.invalidate_cache()

    def test_creates_new_setting(self, db_session):
        app_settings.set_setting(db_session, "new_key", "new_value")

        # Check DB
        row = db_session.query(AppSetting).filter(AppSetting.key == "new_key").first()
        assert row is not None
        assert row.value == "new_value"
        # Check memory cache
        assert app_settings._settings_cache["new_key"] == "new_value"

    def test_updates_existing_setting(self, db_session):
        # Create initial
        setting = AppSetting(key="existing", value="old")
        db_session.add(setting)
        db_session.commit()

        # Update
        app_settings.set_setting(db_session, "existing", "new")

        row = db_session.query(AppSetting).filter(AppSetting.key == "existing").first()
        assert row.value == "new"
        assert app_settings._settings_cache["existing"] == "new"


class TestReloadCache:
    """Tests for reload_cache()."""

    def setup_method(self):
        app_settings.invalidate_cache()

    def test_loads_all_settings(self, db_session):
        db_session.add(AppSetting(key="k1", value="v1"))
        db_session.add(AppSetting(key="k2", value="v2"))
        db_session.commit()

        app_settings.reload_cache(db_session)

        assert app_settings._cache_loaded is True
        assert app_settings._settings_cache["k1"] == "v1"
        assert app_settings._settings_cache["k2"] == "v2"


class TestGetAllSettings:
    """Tests for get_all_settings()."""

    def setup_method(self):
        app_settings.invalidate_cache()

    def test_returns_all_settings(self, db_session):
        db_session.add(AppSetting(key="a", value="1"))
        db_session.add(AppSetting(key="b", value="2"))
        db_session.commit()

        result = app_settings.get_all_settings(db_session)
        assert result == {"a": "1", "b": "2"}


class TestInvalidateCache:
    """Tests for invalidate_cache()."""

    def test_clears_cache(self):
        app_settings._settings_cache["key"] = "val"
        app_settings._cache_loaded = True

        app_settings.invalidate_cache()

        assert app_settings._settings_cache == {}
        assert app_settings._cache_loaded is False
