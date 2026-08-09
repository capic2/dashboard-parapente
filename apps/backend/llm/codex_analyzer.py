"""Emagram analyzer using Codex CLI with ChatGPT account authentication."""

from __future__ import annotations

import json
import logging
import math
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

from llm.emagram_prompt import build_emagram_analysis_prompt, normalize_analysis_locale
from llm.exceptions import QuotaExhaustedError
from llm.screenshot_inputs import ScreenshotInput, normalize_screenshot_inputs

logger = logging.getLogger(__name__)

_CODEX_EXEC_LOCK = threading.Lock()
_QUOTA_ERROR_MARKERS = (
    "429",
    "quota",
    "rate limit",
    "rate_limit",
    "too many requests",
    "usage limit",
)


def analyze_emagram_with_codex(
    *,
    screenshot_paths: list[ScreenshotInput],
    spot_name: str,
    coordinates: tuple[float, float],
    model_name: str | None = None,
    locale: str | None = None,
    timeout_seconds: int = 180,
    command: str = "codex",
) -> dict[str, Any]:
    """Analyze screenshots through Codex CLI using its persisted ChatGPT login."""
    screenshots = []
    for screenshot in normalize_screenshot_inputs(screenshot_paths):
        path = Path(screenshot["path"]).resolve()
        if not path.is_file():
            logger.warning("Image not found: %s", path)
            continue
        screenshots.append({"source": screenshot["source"], "path": str(path)})

    if not screenshots:
        raise RuntimeError("No valid images to analyze")

    lat, lon = coordinates
    source_lines = "\n".join(
        f"- Image {index}: source `{screenshot['source']}`"
        for index, screenshot in enumerate(screenshots, start=1)
    )
    prompt = build_emagram_analysis_prompt(
        spot_name=spot_name,
        lat=lat,
        lon=lon,
        source_lines=source_lines,
        image_count=len(screenshots),
        locale=locale,
    )

    args = [
        command,
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--ignore-user-config",
        "--ignore-rules",
    ]
    if model_name:
        args.extend(["--model", model_name])
    for screenshot in screenshots:
        args.extend(["--image", screenshot["path"]])
    args.append("-")

    logger.info(
        "Analyzing emagram for %s using Codex %s",
        spot_name,
        model_name or "account default",
    )
    deadline = time.monotonic() + timeout_seconds
    try:
        with tempfile.TemporaryDirectory(prefix="emagram-codex-") as workdir:
            # Codex may refresh auth.json during a run; keep one account session at a time.
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not _CODEX_EXEC_LOCK.acquire(timeout=remaining):
                raise RuntimeError("Codex analysis timed out waiting for execution slot")
            try:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise RuntimeError("Codex analysis timed out before execution")
                completed = subprocess.run(
                    args,
                    input=prompt,
                    text=True,
                    capture_output=True,
                    timeout=remaining,
                    cwd=workdir,
                    check=False,
                )
            finally:
                _CODEX_EXEC_LOCK.release()
    except FileNotFoundError as error:
        raise RuntimeError("Codex CLI is not installed") from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(f"Codex analysis timed out after {timeout_seconds}s") from error

    if completed.returncode != 0:
        error_output = (completed.stderr or completed.stdout or "unknown Codex error").strip()
        if _is_quota_error(error_output):
            raise QuotaExhaustedError(f"Codex quota exhausted: {error_output[:500]}")
        raise RuntimeError(f"Codex CLI failed: {error_output[:500]}")

    result = _parse_codex_response(completed.stdout)
    if isinstance(result.get("explication_analyse"), dict):
        result["explication_analyse"].setdefault("locale", normalize_analysis_locale(locale))

    result["llm_provider"] = "codex"
    result["llm_model"] = model_name or "account-default"
    result["llm_tokens_used"] = None
    result["llm_cost_usd"] = None
    return result


def _is_quota_error(error_output: str) -> bool:
    normalized = error_output.lower()
    return any(marker in normalized for marker in _QUOTA_ERROR_MARKERS)


def _parse_codex_response(response_text: str) -> dict[str, Any]:
    text = response_text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0]

    try:
        result = json.loads(text.strip())
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Codex returned invalid JSON: {error}") from error

    required = [
        "plafond_thermique_m",
        "force_thermique_ms",
        "heures_volables",
        "score_volabilite",
        "conseils_vol",
        "alertes_securite",
        "details_analyse",
    ]
    missing = [field for field in required if field not in result]
    if missing:
        raise RuntimeError(f"Codex response missing fields: {', '.join(missing)}")

    try:
        result["plafond_thermique_m"] = int(result["plafond_thermique_m"])
        result["force_thermique_ms"] = float(result["force_thermique_ms"])
        if not math.isfinite(result["force_thermique_ms"]):
            raise ValueError("force_thermique_ms must be finite")
        result["score_volabilite"] = max(0, min(100, int(result["score_volabilite"])))
    except (TypeError, ValueError) as error:
        raise RuntimeError(f"Codex returned non-numeric analysis fields: {error}") from error
    if not isinstance(result["alertes_securite"], list):
        result["alertes_securite"] = []
    result.setdefault("explication_analyse", None)
    return result
