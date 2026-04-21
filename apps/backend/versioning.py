import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import fcntl

logger = logging.getLogger(__name__)

VERSION_STATE_FILE = Path(
    os.getenv(
        "BACKEND_VERSION_STATE_FILE",
        Path(__file__).parent / "db" / "version_state.json",
    )
)

_current_version_payload: dict[str, int | str | None] | None = None


def _today_string() -> str:
    return datetime.now(timezone.utc).strftime("%Y.%m.%d")


def _is_testing_mode() -> bool:
    return os.getenv("TESTING", "false").lower() == "true"


def _release_notes_url() -> str | None:
    value = os.getenv("BACKEND_RELEASE_NOTES_URL", "").strip()
    if not value:
        return None

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        logger.warning("Ignoring invalid BACKEND_RELEASE_NOTES_URL: %s", value)
        return None

    return value


def _load_state() -> dict[str, int | str] | None:
    if not VERSION_STATE_FILE.exists():
        return None

    try:
        with VERSION_STATE_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError) as error:
        logger.warning("Failed to read version state file: %s", error)
        return None

    date = data.get("date")
    number = data.get("number")

    if not isinstance(date, str) or not isinstance(number, int) or number < 0:
        logger.warning("Version state file is invalid, resetting state")
        return None

    return {"date": date, "number": number}


def _write_state(date: str, number: int) -> None:
    payload = {"date": date, "number": number}

    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=VERSION_STATE_FILE.parent,
        delete=False,
    ) as file:
        json.dump(payload, file)
        temp_file = Path(file.name)

    temp_file.replace(VERSION_STATE_FILE)


def initialize_deployment_version() -> dict[str, int | str | None]:
    global _current_version_payload

    today = _today_string()
    forced_version = os.getenv("BACKEND_DEPLOY_VERSION", "").strip()

    if forced_version:
        forced_parts = forced_version.split(".")
        build_number = int(forced_parts[-1]) if forced_parts and forced_parts[-1].isdigit() else 0
        _current_version_payload = {
            "version": forced_version,
            "build_date": ".".join(forced_parts[:3]) if len(forced_parts) >= 3 else today,
            "build_number": build_number,
            "release_notes_url": _release_notes_url(),
        }
        logger.info("Deployment version forced from BACKEND_DEPLOY_VERSION: %s", forced_version)
        return _current_version_payload

    if _is_testing_mode() and "BACKEND_VERSION_STATE_FILE" not in os.environ:
        _current_version_payload = {
            "version": f"{today}.0",
            "build_date": today,
            "build_number": 0,
            "release_notes_url": _release_notes_url(),
        }
        return _current_version_payload

    VERSION_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    lock_file_path = VERSION_STATE_FILE.with_suffix(".lock")

    with lock_file_path.open("w", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)

        state = _load_state()

        if state and state.get("date") == today:
            next_number = int(state["number"]) + 1
        else:
            next_number = 1

        _write_state(today, next_number)

    _current_version_payload = {
        "version": f"{today}.{next_number}",
        "build_date": today,
        "build_number": next_number,
        "release_notes_url": _release_notes_url(),
    }

    logger.info("Deployment version initialized: %s", _current_version_payload["version"])
    return _current_version_payload


def get_version_payload() -> dict[str, int | str | None]:
    if _current_version_payload is not None:
        return _current_version_payload

    return initialize_deployment_version()
