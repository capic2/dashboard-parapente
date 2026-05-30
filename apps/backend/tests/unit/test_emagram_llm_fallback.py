from types import SimpleNamespace
from typing import Any

import pytest

import emagram_multi_source as emagram
from llm.exceptions import QuotaExhaustedError


def _analysis(provider: str) -> dict[str, Any]:
    return {
        "plafond_thermique_m": 2500,
        "force_thermique_ms": 2.2,
        "heures_volables": "12:00-17:00",
        "score_volabilite": 72,
        "conseils_vol": f"Analyse {provider}",
        "alertes_securite": [],
        "details_analyse": "Conditions exploitables",
        "llm_model": f"{provider}-model",
        "llm_tokens_used": 123,
        "llm_cost_usd": 0.0,
    }


def _site() -> SimpleNamespace:
    return SimpleNamespace(name="Arguel", latitude=47.2, longitude=6.0)


@pytest.fixture(autouse=True)
def clear_llm_cooldowns() -> None:
    emagram._LLM_QUOTA_COOLDOWNS.clear()


def _configure_providers(monkeypatch: pytest.MonkeyPatch, order: list[str]) -> None:
    monkeypatch.setattr(emagram.config, "LLM_FALLBACK_ORDER", order)
    monkeypatch.setattr(emagram.config, "LLM_QUOTA_COOLDOWN_SECONDS", 0)
    monkeypatch.setattr(emagram.config, "GROQ_API_KEY", "groq-key")
    monkeypatch.setattr(emagram.config, "GROQ_MODEL", "groq-model")
    monkeypatch.setattr(emagram.config, "OPENROUTER_API_KEY", "openrouter-key")
    monkeypatch.setattr(emagram.config, "OPENROUTER_MODEL", "openrouter-model")
    monkeypatch.setattr(emagram.config, "OPENROUTER_MODELS", ["openrouter-model"])
    monkeypatch.setattr(emagram.config, "GOOGLE_API_KEY", "google-key")
    monkeypatch.setattr(emagram.config, "GEMINI_MODEL", "gemini-model")
    monkeypatch.setattr(emagram.config, "GITHUB_MODELS_API_KEY", None)
    monkeypatch.setattr(emagram.config, "GITHUB_MODELS_BASE_URL", "https://models.github.ai")
    monkeypatch.setattr(emagram.config, "GITHUB_MODELS_MODELS", ["github-model"])
    monkeypatch.setattr(emagram.config, "HUGGINGFACE_API_KEY", None)
    monkeypatch.setattr(emagram.config, "HUGGINGFACE_BASE_URL", "https://router.huggingface.co")
    monkeypatch.setattr(emagram.config, "HUGGINGFACE_MODELS", ["huggingface-model"])
    monkeypatch.setattr(emagram.config, "CUSTOM_OPENAI_API_KEY", None)
    monkeypatch.setattr(emagram.config, "CUSTOM_OPENAI_BASE_URL", None)
    monkeypatch.setattr(emagram.config, "CUSTOM_OPENAI_MODELS", [])


def test_default_order_prefers_free_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    _configure_providers(monkeypatch, ["groq", "openrouter", "google"])

    def groq(**kwargs: Any) -> dict[str, Any]:
        calls.append("groq")
        return _analysis("groq")

    def openrouter(**kwargs: Any) -> dict[str, Any]:
        calls.append("openrouter")
        return _analysis("openrouter")

    def gemini(**kwargs: Any) -> dict[str, Any]:
        calls.append("google")
        return _analysis("google")

    monkeypatch.setattr(emagram, "analyze_emagram_with_groq", groq)
    monkeypatch.setattr(emagram, "analyze_emagram_with_openrouter", openrouter)
    monkeypatch.setattr(emagram, "analyze_emagram_with_gemini", gemini)

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is True
    assert result["llm_provider"] == "groq"
    assert calls == ["groq"]


def test_falls_back_from_groq_to_openrouter(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    _configure_providers(monkeypatch, ["groq", "openrouter", "google"])

    def groq(**kwargs: Any) -> dict[str, Any]:
        calls.append("groq")
        raise RuntimeError("temporary failure")

    def openrouter(**kwargs: Any) -> dict[str, Any]:
        calls.append("openrouter")
        return _analysis("openrouter")

    monkeypatch.setattr(emagram, "analyze_emagram_with_groq", groq)
    monkeypatch.setattr(emagram, "analyze_emagram_with_openrouter", openrouter)

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is True
    assert result["llm_provider"] == "openrouter"
    assert calls == ["groq", "openrouter"]


def test_falls_back_to_gemini_after_free_providers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []
    _configure_providers(monkeypatch, ["groq", "openrouter", "google"])

    def groq(**kwargs: Any) -> dict[str, Any]:
        calls.append("groq")
        raise RuntimeError("temporary failure")

    def openrouter(**kwargs: Any) -> dict[str, Any]:
        calls.append("openrouter")
        raise RuntimeError("temporary failure")

    def gemini(**kwargs: Any) -> dict[str, Any]:
        calls.append("google")
        return _analysis("google")

    monkeypatch.setattr(emagram, "analyze_emagram_with_groq", groq)
    monkeypatch.setattr(emagram, "analyze_emagram_with_openrouter", openrouter)
    monkeypatch.setattr(emagram, "analyze_emagram_with_gemini", gemini)

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is True
    assert result["llm_provider"] == "google"
    assert calls == ["groq", "openrouter", "google"]


def test_rotates_between_openrouter_free_models(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    _configure_providers(monkeypatch, ["openrouter", "google"])
    monkeypatch.setattr(emagram.config, "OPENROUTER_MODELS", ["free-model-1", "free-model-2"])

    def openrouter(**kwargs: Any) -> dict[str, Any]:
        calls.append(("openrouter", kwargs["model_name"]))
        if kwargs["model_name"] == "free-model-1":
            raise QuotaExhaustedError("quota")
        return _analysis("openrouter")

    monkeypatch.setattr(emagram, "analyze_emagram_with_openrouter", openrouter)

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is True
    assert result["llm_provider"] == "openrouter"
    assert calls == [("openrouter", "free-model-1"), ("openrouter", "free-model-2")]


def test_falls_back_across_openai_compatible_providers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = []
    _configure_providers(monkeypatch, ["github_models", "huggingface", "google"])
    monkeypatch.setattr(emagram.config, "GITHUB_MODELS_API_KEY", "github-key")
    monkeypatch.setattr(emagram.config, "HUGGINGFACE_API_KEY", "huggingface-key")

    def openai_compatible(**kwargs: Any) -> dict[str, Any]:
        calls.append((kwargs["provider_name"], kwargs["model_name"]))
        if kwargs["provider_name"] == "github_models":
            raise QuotaExhaustedError("quota")
        return _analysis(kwargs["provider_name"])

    monkeypatch.setattr(
        emagram,
        "analyze_emagram_with_openai_compatible",
        openai_compatible,
    )

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is True
    assert result["llm_provider"] == "huggingface"
    assert calls == [("github_models", "github-model"), ("huggingface", "huggingface-model")]


def test_skips_unconfigured_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    _configure_providers(monkeypatch, ["groq", "openrouter", "google"])
    monkeypatch.setattr(emagram.config, "GROQ_API_KEY", None)
    monkeypatch.setattr(emagram.config, "OPENROUTER_API_KEY", None)

    def gemini(**kwargs: Any) -> dict[str, Any]:
        calls.append("google")
        return _analysis("google")

    monkeypatch.setattr(emagram, "analyze_emagram_with_gemini", gemini)

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is True
    assert result["llm_provider"] == "google"
    assert calls == ["google"]


def test_all_configured_quota_exhausted_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_providers(monkeypatch, ["groq", "openrouter"])

    def exhausted(**kwargs: Any) -> dict[str, Any]:
        raise QuotaExhaustedError("quota")

    monkeypatch.setattr(emagram, "analyze_emagram_with_groq", exhausted)
    monkeypatch.setattr(emagram, "analyze_emagram_with_openrouter", exhausted)

    with pytest.raises(QuotaExhaustedError):
        emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())


def test_quota_cooldown_skips_saturated_model(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    _configure_providers(monkeypatch, ["openrouter", "google"])
    monkeypatch.setattr(emagram.config, "LLM_QUOTA_COOLDOWN_SECONDS", 60)

    def openrouter(**kwargs: Any) -> dict[str, Any]:
        calls.append("openrouter")
        raise QuotaExhaustedError("quota")

    def gemini(**kwargs: Any) -> dict[str, Any]:
        calls.append("google")
        return _analysis("google")

    monkeypatch.setattr(emagram, "analyze_emagram_with_openrouter", openrouter)
    monkeypatch.setattr(emagram, "analyze_emagram_with_gemini", gemini)

    first_result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())
    second_result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert first_result["success"] is True
    assert second_result["success"] is True
    assert calls == ["openrouter", "google", "google"]


def test_no_provider_configured_returns_clear_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_providers(monkeypatch, ["groq", "openrouter", "google"])
    monkeypatch.setattr(emagram.config, "GROQ_API_KEY", None)
    monkeypatch.setattr(emagram.config, "OPENROUTER_API_KEY", None)
    monkeypatch.setattr(emagram.config, "GOOGLE_API_KEY", None)

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is False
    assert "No LLM provider configured" in result["error"]


def test_unusable_response_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    _configure_providers(monkeypatch, ["groq", "openrouter"])

    def groq(**kwargs: Any) -> dict[str, Any]:
        calls.append("groq")
        unusable = _analysis("groq")
        unusable["conseils_vol"] = "Analyse impossible - erreur de parsing Gemini"
        return unusable

    def openrouter(**kwargs: Any) -> dict[str, Any]:
        calls.append("openrouter")
        return _analysis("openrouter")

    monkeypatch.setattr(emagram, "analyze_emagram_with_groq", groq)
    monkeypatch.setattr(emagram, "analyze_emagram_with_openrouter", openrouter)

    result = emagram._analyze_emagram_with_fallbacks(["/tmp/emagram.png"], _site())

    assert result["success"] is True
    assert result["llm_provider"] == "openrouter"
    assert calls == ["groq", "openrouter"]
