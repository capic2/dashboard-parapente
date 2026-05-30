from emagram_multi_source import validate_ai_thermal_consistency


def test_strong_ai_thermal_is_contradicted_by_low_cape_and_unknown_li():
    result = validate_ai_thermal_consistency(
        {"force_thermique_ms": 3.2},
        {"consensus": [{"hour": 14, "cape": 20, "lifted_index": None}]},
        14,
    )

    assert result["status"] == "contradicted"
    assert result["metrics"]["cape_jkg"] == 20.0


def test_strong_ai_thermal_without_instability_indices_is_low_confidence():
    result = validate_ai_thermal_consistency(
        {"force_thermique_ms": 3.1},
        {"consensus": [{"hour": 13, "cape": None, "lifted_index": None}]},
        13,
    )

    assert result["status"] == "low_confidence"


def test_moderate_ai_thermal_with_cape_is_plausible():
    result = validate_ai_thermal_consistency(
        {"force_thermique_ms": 2.0},
        {"consensus": [{"hour": 13, "cape": 600, "lifted_index": -2}]},
        13,
    )

    assert result["status"] == "plausible"


def test_missing_hourly_weather_is_not_checked():
    result = validate_ai_thermal_consistency({"force_thermique_ms": 2.0}, None, 13)

    assert result["status"] == "not_checked"
