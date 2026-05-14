import logging
import os

logger = logging.getLogger(__name__)


def required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        logger.error("Required environment variable %s is missing or empty", name)
        raise ValueError(f"{name} environment variable is required")
    return value.strip()
