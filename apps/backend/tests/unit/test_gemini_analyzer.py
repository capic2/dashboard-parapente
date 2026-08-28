import json

from llm.gemini_analyzer import _parse_gemini_response


def test_parse_gemini_response_repairs_truncated_string() -> None:
    response = json.dumps(
        {
            "plafond_thermique_m": 2400,
            "force_thermique_ms": 2.1,
            "heures_volables": "12h-17h",
            "score_volabilite": 70,
            "conseils_vol": "Vol possible avec prudence.",
            "alertes_securite": [],
            "details_analyse": "L'inversion limite probablement les thermiques.",
        },
        ensure_ascii=False,
    )
    truncated = response[:-12]

    result = _parse_gemini_response(truncated)

    assert result["plafond_thermique_m"] == 2400
    assert result["force_thermique_ms"] == 2.1
    assert result["score_volabilite"] == 70
    assert result["details_analyse"].startswith("L'inversion")

