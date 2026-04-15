import json
import logging
import os
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

VERSION_STATE_FILE = Path(
    os.getenv(
        "BACKEND_VERSION_STATE_FILE",
        Path(__file__).parent / "db" / "version_state.json",
    )
)

_current_version_payload: dict[str, int | str] | None = None


def _today_string() -> str:
    return datetime.now().strftime("%Y.%m.%d")


def _is_testing_mode() -> bool:
    return os.getenv("TESTING", "false").lower() == "true"


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
    VERSION_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_file = VERSION_STATE_FILE.with_suffix(".tmp")
    payload = {"date": date, "number": number}

    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(payload, file)

    temp_file.replace(VERSION_STATE_FILE)


def initialize_deployment_version() -> dict[str, int | str]:
    global _current_version_payload

    today = _today_string()

    if _is_testing_mode() and "BACKEND_VERSION_STATE_FILE" not in os.environ:
        _current_version_payload = {
            "version": f"{today}.0",
            "build_date": today,
            "build_number": 0,
        }
        return _current_version_payload

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
    }

    logger.info("Deployment version initialized: %s", _current_version_payload["version"])
    return _current_version_payload


def get_version_payload() -> dict[str, int | str]:
    if _current_version_payload is not None:
        return _current_version_payload

    return initialize_deployment_version()
