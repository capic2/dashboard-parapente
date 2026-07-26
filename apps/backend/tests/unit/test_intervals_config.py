import config


def test_csv_env_trims_values_and_removes_empty_entries(monkeypatch) -> None:
    monkeypatch.setenv("TEST_INTERVALS_TYPES", " Other, ,Workout ,, ")

    assert config._csv_env("TEST_INTERVALS_TYPES", "") == ["Other", "Workout"]


def test_bounded_integer_environment_values_are_clamped(monkeypatch) -> None:
    monkeypatch.setenv("TEST_INTERVAL", "0")
    monkeypatch.setenv("TEST_LOOKBACK", "-2")

    assert config._int_env_at_least("TEST_INTERVAL", 10, 1) == 1
    assert config._int_env_at_least("TEST_LOOKBACK", 3, 0) == 0


def test_intervals_sync_is_disabled_when_api_key_is_missing(monkeypatch) -> None:
    monkeypatch.setenv("BACKEND_INTERVALS_ICU_SYNC_ENABLED", "true")

    assert config._intervals_sync_enabled(None) is False
    assert config._intervals_sync_enabled("") is False
    assert config._intervals_sync_enabled("secret") is True
