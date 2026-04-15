import re

import versioning


def _reset_cache():
    versioning._current_version_payload = None


def test_initialize_deployment_version_increments_same_day(tmp_path, monkeypatch):
    monkeypatch.setenv("BACKEND_VERSION_STATE_FILE", str(tmp_path / "version_state.json"))
    monkeypatch.setattr(versioning, "VERSION_STATE_FILE", tmp_path / "version_state.json")
    monkeypatch.setattr(versioning, "_today_string", lambda: "2026.04.15")
    _reset_cache()

    first = versioning.initialize_deployment_version()
    _reset_cache()
    second = versioning.initialize_deployment_version()

    assert first["version"] == "2026.04.15.1"
    assert second["version"] == "2026.04.15.2"


def test_initialize_deployment_version_resets_counter_on_new_day(tmp_path, monkeypatch):
    monkeypatch.setenv("BACKEND_VERSION_STATE_FILE", str(tmp_path / "version_state.json"))
    monkeypatch.setattr(versioning, "VERSION_STATE_FILE", tmp_path / "version_state.json")
    _reset_cache()

    monkeypatch.setattr(versioning, "_today_string", lambda: "2026.04.15")
    versioning.initialize_deployment_version()

    _reset_cache()
    monkeypatch.setattr(versioning, "_today_string", lambda: "2026.04.16")
    next_day = versioning.initialize_deployment_version()

    assert next_day["version"] == "2026.04.16.1"
    assert next_day["build_number"] == 1


def test_initialize_deployment_version_matches_expected_format(tmp_path, monkeypatch):
    monkeypatch.setenv("BACKEND_VERSION_STATE_FILE", str(tmp_path / "version_state.json"))
    monkeypatch.setattr(versioning, "VERSION_STATE_FILE", tmp_path / "version_state.json")
    monkeypatch.setattr(versioning, "_today_string", lambda: "2026.04.15")
    _reset_cache()

    payload = versioning.initialize_deployment_version()

    assert re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", str(payload["version"]))
