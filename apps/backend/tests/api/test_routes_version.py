import json

import pytest
from routes import serialize_sse_event
import versioning

API_PREFIX = "/api"


def _reset_version_cache() -> None:
    versioning._current_version_payload = None


@pytest.fixture(autouse=True)
def reset_version_cache_fixture():
    _reset_version_cache()
    yield
    _reset_version_cache()


def test_get_version_includes_release_notes_url(client, monkeypatch):
    monkeypatch.setenv("BACKEND_DEPLOY_VERSION", "2026.04.21.7")
    monkeypatch.setenv(
        "BACKEND_RELEASE_NOTES_URL", "https://example.com/releases/2026.04.21.7"
    )
    response = client.get(f"{API_PREFIX}/version")

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == "2026.04.21.7"
    assert payload["release_notes_url"] == "https://example.com/releases/2026.04.21.7"


def test_version_stream_sends_initial_version_event(monkeypatch):
    monkeypatch.setenv("BACKEND_DEPLOY_VERSION", "2026.04.22.1")
    monkeypatch.setenv(
        "BACKEND_RELEASE_NOTES_URL", "https://example.com/releases/2026.04.22.1"
    )
    payload = versioning.get_version_payload()
    chunk = serialize_sse_event("version", payload)

    event_name = None
    event_data = None

    for raw_line in chunk.splitlines():
        if raw_line.startswith("event: "):
            event_name = raw_line.replace("event: ", "", 1)
        if raw_line.startswith("data: ") and event_name == "version":
            event_data = json.loads(raw_line.replace("data: ", "", 1))

    assert event_name == "version"
    assert event_data is not None
    assert event_data["version"] == "2026.04.22.1"
    assert event_data["release_notes_url"] == "https://example.com/releases/2026.04.22.1"
