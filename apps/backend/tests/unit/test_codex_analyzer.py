import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from llm import codex_analyzer
from llm.exceptions import QuotaExhaustedError


def _analysis() -> dict[str, Any]:
    return {
        "plafond_thermique_m": "2500",
        "force_thermique_ms": "2.2",
        "heures_volables": "12:00-17:00",
        "score_volabilite": "72",
        "conseils_vol": "Conditions exploitables",
        "alertes_securite": [],
        "details_analyse": "Analyse Codex",
    }


def test_codex_uses_shared_prompt_and_images(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    first_image = tmp_path / "first.png"
    second_image = tmp_path / "second.png"
    first_image.write_bytes(b"png")
    second_image.write_bytes(b"png")
    captured: dict[str, Any] = {}

    def run(args: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        captured["args"] = args
        captured["kwargs"] = kwargs
        return subprocess.CompletedProcess(args, 0, stdout=json.dumps(_analysis()), stderr="")

    monkeypatch.setattr(codex_analyzer.subprocess, "run", run)

    result = codex_analyzer.analyze_emagram_with_codex(
        screenshot_paths=[
            {"source": "meteociel", "path": str(first_image)},
            {"source": "open-meteo", "path": str(second_image)},
        ],
        spot_name="Arguel",
        coordinates=(47.2, 6.0),
        model_name=None,
    )

    args = captured["args"]
    assert args[:2] == ["codex", "exec"]
    assert args.count("--image") == 2
    assert "--model" not in args
    assert args[-1] == "-"
    assert "source `meteociel`" in captured["kwargs"]["input"]
    assert "source `open-meteo`" in captured["kwargs"]["input"]
    assert captured["kwargs"]["check"] is False
    assert result["llm_provider"] == "codex"
    assert result["llm_model"] == "account-default"
    assert result["plafond_thermique_m"] == 2500
    assert result["force_thermique_ms"] == 2.2
    assert result["score_volabilite"] == 72


def test_codex_passes_explicit_model(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    image = tmp_path / "emagram.png"
    image.write_bytes(b"png")
    captured_args = []

    def run(args: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        captured_args.extend(args)
        return subprocess.CompletedProcess(args, 0, stdout=json.dumps(_analysis()), stderr="")

    monkeypatch.setattr(codex_analyzer.subprocess, "run", run)

    codex_analyzer.analyze_emagram_with_codex(
        screenshot_paths=[str(image)],
        spot_name="Arguel",
        coordinates=(47.2, 6.0),
        model_name="gpt-test",
    )

    assert captured_args[captured_args.index("--model") + 1] == "gpt-test"


def test_codex_maps_usage_limit_to_quota_error(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    image = tmp_path / "emagram.png"
    image.write_bytes(b"png")

    def run(args: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args,
            1,
            stdout="",
            stderr="You have reached your usage limit",
        )

    monkeypatch.setattr(codex_analyzer.subprocess, "run", run)

    with pytest.raises(QuotaExhaustedError):
        codex_analyzer.analyze_emagram_with_codex(
            screenshot_paths=[str(image)],
            spot_name="Arguel",
            coordinates=(47.2, 6.0),
        )


def test_codex_reports_missing_login(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    image = tmp_path / "emagram.png"
    image.write_bytes(b"png")

    def run(args: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args, 1, stdout="", stderr="Not logged in")

    monkeypatch.setattr(codex_analyzer.subprocess, "run", run)

    with pytest.raises(RuntimeError, match="Not logged in"):
        codex_analyzer.analyze_emagram_with_codex(
            screenshot_paths=[str(image)],
            spot_name="Arguel",
            coordinates=(47.2, 6.0),
        )


def test_codex_reports_timeout(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    image = tmp_path / "emagram.png"
    image.write_bytes(b"png")

    def run(args: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        raise subprocess.TimeoutExpired(args, 12)

    monkeypatch.setattr(codex_analyzer.subprocess, "run", run)

    with pytest.raises(RuntimeError, match="timed out after 12s"):
        codex_analyzer.analyze_emagram_with_codex(
            screenshot_paths=[str(image)],
            spot_name="Arguel",
            coordinates=(47.2, 6.0),
            timeout_seconds=12,
        )


@pytest.mark.parametrize("force", ["NaN", "Infinity", "-Infinity"])
def test_codex_rejects_non_finite_thermal_force(force: str) -> None:
    analysis = _analysis()
    analysis["force_thermique_ms"] = force

    with pytest.raises(RuntimeError, match="non-numeric analysis fields"):
        codex_analyzer._parse_codex_response(json.dumps(analysis))


def test_codex_times_out_waiting_for_execution_slot(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    image = tmp_path / "emagram.png"
    image.write_bytes(b"png")

    class BusyLock:
        def acquire(self, timeout: float) -> bool:
            return False

        def release(self) -> None:
            raise AssertionError("A lock that was not acquired must not be released")

    monkeypatch.setattr(codex_analyzer, "_CODEX_EXEC_LOCK", BusyLock())

    with pytest.raises(RuntimeError, match="timed out waiting for execution slot"):
        codex_analyzer.analyze_emagram_with_codex(
            screenshot_paths=[str(image)],
            spot_name="Arguel",
            coordinates=(47.2, 6.0),
            timeout_seconds=1,
        )
