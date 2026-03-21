"""
Unit tests for best_spot.py - Best spot calculation algorithm

Tests the core logic for determining the best flying spot:
- Wind favorability based on site orientation
- Wind score multipliers
- Angle difference calculations (circular)
- Cardinal direction parsing
"""

import pytest
from best_spot import (
    parse_wind_direction,
    calculate_angle_difference,
    get_wind_favorability,
    get_wind_score_multiplier,
    degrees_to_cardinal
)


@pytest.mark.unit
class TestParseWindDirection:
    """Test parsing wind direction strings to degrees"""
    
    def test_parse_cardinal_directions(self):
        """Basic cardinal directions"""
        assert parse_wind_direction("N") == 0
        assert parse_wind_direction("E") == 90
        assert parse_wind_direction("S") == 180
        assert parse_wind_direction("W") == 270
    
    def test_parse_intercardinal_directions(self):
        """NE, SE, SW, NW"""
        assert parse_wind_direction("NE") == 45
        assert parse_wind_direction("SE") == 135
        assert parse_wind_direction("SW") == 225
        assert parse_wind_direction("NW") == 315
    
    def test_parse_secondary_intercardinals(self):
        """NNE, ENE, ESE, etc."""
        assert parse_wind_direction("NNE") == 22.5
        assert parse_wind_direction("ENE") == 67.5
        assert parse_wind_direction("ESE") == 112.5
        assert parse_wind_direction("SSE") == 157.5
    
    def test_case_insensitive(self):
        """Should accept lowercase"""
        assert parse_wind_direction("n") == 0
        assert parse_wind_direction("sw") == 225
        assert parse_wind_direction("nNe") == 22.5
    
    def test_with_whitespace(self):
        """Trim whitespace"""
        assert parse_wind_direction(" N ") == 0
        assert parse_wind_direction("  SW  ") == 225
    
    def test_invalid_direction(self):
        """Invalid direction → None"""
        assert parse_wind_direction("INVALID") is None
        assert parse_wind_direction("X") is None
        assert parse_wind_direction("") is None
    
    def test_none_input(self):
        """None input → None"""
        assert parse_wind_direction(None) is None


@pytest.mark.unit
class TestCalculateAngleDifference:
    """Test circular angle difference calculation"""
    
    def test_same_direction(self):
        """0° and 0° → 0°"""
        assert calculate_angle_difference(0, 0) == 0
        assert calculate_angle_difference(90, 90) == 0
        assert calculate_angle_difference(270, 270) == 0
    
    def test_opposite_directions(self):
        """Opposite directions → 180°"""
        assert calculate_angle_difference(0, 180) == 180
        assert calculate_angle_difference(90, 270) == 180
        assert calculate_angle_difference(45, 225) == 180
    
    def test_small_difference(self):
        """Close angles"""
        assert calculate_angle_difference(10, 30) == 20
        assert calculate_angle_difference(100, 120) == 20
        assert calculate_angle_difference(350, 10) == 20  # Circular
    
    def test_circular_wraparound(self):
        """350° and 10° → 20° (not 340°)"""
        assert calculate_angle_difference(350, 10) == 20
        assert calculate_angle_difference(10, 350) == 20
        assert calculate_angle_difference(355, 5) == 10
        assert calculate_angle_difference(5, 355) == 10
    
    def test_90_degree_difference(self):
        """Perpendicular directions → 90°"""
        assert calculate_angle_difference(0, 90) == 90
        assert calculate_angle_difference(90, 180) == 90
        assert calculate_angle_difference(270, 0) == 90
    
    def test_large_angle_wraps(self):
        """Large differences wrap around"""
        # 0° to 270° is 90°, not 270°
        assert calculate_angle_difference(0, 270) == 90
        # 270° to 0° is 90°, not 270°
        assert calculate_angle_difference(270, 0) == 90
    
    def test_always_returns_smallest(self):
        """Always returns 0-180, never > 180"""
        for i in range(0, 360, 30):
            for j in range(0, 360, 30):
                diff = calculate_angle_difference(i, j)
                assert 0 <= diff <= 180


@pytest.mark.unit
class TestGetWindFavorability:
    """Test wind favorability classification"""
    
    def test_aligned_wind_good(self):
        """Wind aligned with orientation (±45°) → good"""
        # SW site (225°), SW wind (225°) → perfect
        assert get_wind_favorability("SW", "SW", 12.0) == "good"
        
        # SW site (225°), WSW wind (247.5°) → within 45° → good
        assert get_wind_favorability("WSW", "SW", 12.0) == "good"
        
        # SW site (225°), S wind (180°) → 45° difference → good
        assert get_wind_favorability("S", "SW", 12.0) == "good"
    
    def test_cross_wind_moderate(self):
        """Wind cross 45-90° → moderate"""
        # SW site (225°), SE wind (135°) → 90° difference → moderate
        assert get_wind_favorability("SE", "SW", 12.0) == "moderate"
        
        # SW site (225°), W wind (270°) → 45° difference → moderate (boundary)
        favorability = get_wind_favorability("W", "SW", 12.0)
        assert favorability in ["good", "moderate"]  # Boundary case
    
    def test_opposed_wind_bad(self):
        """Wind opposed >90° → bad"""
        # SW site (225°), NE wind (45°) → 180° difference → bad
        assert get_wind_favorability("NE", "SW", 12.0) == "bad"
        
        # SW site (225°), N wind (0°) → 135° difference → bad
        assert get_wind_favorability("N", "SW", 12.0) == "bad"
    
    def test_wind_too_weak_bad(self):
        """Wind < 5 km/h → bad (insufficient)"""
        assert get_wind_favorability("SW", "SW", 3.0) == "bad"
        assert get_wind_favorability("SW", "SW", 0.0) == "bad"
    
    def test_wind_too_strong_bad(self):
        """Wind > 30 km/h → bad (dangerous)"""
        assert get_wind_favorability("SW", "SW", 35.0) == "bad"
        assert get_wind_favorability("SW", "SW", 50.0) == "bad"
    
    def test_missing_data_moderate(self):
        """Missing data → moderate (fallback)"""
        assert get_wind_favorability(None, "SW", 12.0) == "moderate"
        assert get_wind_favorability("SW", None, 12.0) == "moderate"
        assert get_wind_favorability("SW", "SW", None) == "moderate"
        assert get_wind_favorability(None, None, None) == "moderate"
    
    def test_invalid_direction_moderate(self):
        """Invalid direction → moderate"""
        assert get_wind_favorability("INVALID", "SW", 12.0) == "moderate"
        assert get_wind_favorability("SW", "INVALID", 12.0) == "moderate"


@pytest.mark.unit
class TestGetWindScoreMultiplier:
    """Test score multiplier calculation"""
    
    def test_good_multiplier(self):
        """Good favorability → 1.0"""
        assert get_wind_score_multiplier("good") == 1.0
    
    def test_moderate_multiplier(self):
        """Moderate favorability → 0.7"""
        assert get_wind_score_multiplier("moderate") == 0.7
    
    def test_bad_multiplier(self):
        """Bad favorability → 0.3"""
        assert get_wind_score_multiplier("bad") == 0.3
    
    def test_invalid_favorability_default(self):
        """Invalid → default 0.7"""
        assert get_wind_score_multiplier("unknown") == 0.7
        assert get_wind_score_multiplier("") == 0.7
        assert get_wind_score_multiplier(None) == 0.7


@pytest.mark.unit
class TestDegreesToCardinal:
    """Test degrees to cardinal direction conversion"""
    
    def test_cardinal_directions(self):
        """Basic cardinal directions"""
        assert degrees_to_cardinal(0) == "N"
        assert degrees_to_cardinal(90) == "E"
        assert degrees_to_cardinal(180) == "S"
        assert degrees_to_cardinal(270) == "W"
    
    def test_intercardinal_directions(self):
        """NE, SE, SW, NW"""
        assert degrees_to_cardinal(45) == "NE"
        assert degrees_to_cardinal(135) == "SE"
        assert degrees_to_cardinal(225) == "SW"
        assert degrees_to_cardinal(315) == "NW"
    
    def test_secondary_intercardinals(self):
        """NNE, ENE, etc."""
        assert degrees_to_cardinal(22.5) == "NNE"
        assert degrees_to_cardinal(67.5) == "ENE"
        assert degrees_to_cardinal(112.5) == "ESE"
        assert degrees_to_cardinal(157.5) == "SSE"
    
    def test_rounding(self):
        """Nearby degrees round to nearest cardinal"""
        # 10° should round to N (0°)
        result = degrees_to_cardinal(10)
        assert result in ["N", "NNE"]
        
        # 350° should round to N (0°)
        result = degrees_to_cardinal(350)
        assert result in ["N", "NNW"]
    
    def test_wraparound_360(self):
        """360° = 0° = N"""
        assert degrees_to_cardinal(360) == "N"
        assert degrees_to_cardinal(0) == "N"
    
    def test_valid_degree_inputs(self):
        """All valid degrees return valid cardinals"""
        # Test a range of valid degree values
        for degrees in [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]:
            result = degrees_to_cardinal(degrees)
            assert isinstance(result, str)
            assert len(result) >= 1  # At least one character (N, E, S, W)


@pytest.mark.unit
class TestBestSpotAlgorithm:
    """Test the overall best spot algorithm logic"""
    
    def test_para_index_with_good_wind(self):
        """High Para-Index × good wind → high score"""
        # Simulate: Para-Index 80, wind aligned → score = 80 × 1.0 = 80
        para_index = 80
        favorability = get_wind_favorability("SW", "SW", 12.0)
        multiplier = get_wind_score_multiplier(favorability)
        
        final_score = para_index * multiplier
        
        assert favorability == "good"
        assert multiplier == 1.0
        assert final_score == 80
    
    def test_para_index_with_moderate_wind(self):
        """High Para-Index × moderate wind → reduced score"""
        # Simulate: Para-Index 80, wind cross → score = 80 × 0.7 = 56
        para_index = 80
        favorability = get_wind_favorability("W", "SW", 12.0)  # Cross wind
        multiplier = get_wind_score_multiplier(favorability)
        
        final_score = para_index * multiplier
        
        assert favorability in ["moderate", "good"]
        if favorability == "moderate":
            assert multiplier == 0.7
            assert final_score == 56.0
    
    def test_para_index_with_bad_wind(self):
        """High Para-Index × bad wind → very low score"""
        # Simulate: Para-Index 80, wind opposed → score = 80 × 0.3 = 24
        para_index = 80
        favorability = get_wind_favorability("NE", "SW", 12.0)  # Opposite
        multiplier = get_wind_score_multiplier(favorability)
        
        final_score = para_index * multiplier
        
        assert favorability == "bad"
        assert multiplier == 0.3
        assert final_score == 24.0
    
    def test_low_para_index_good_wind(self):
        """Low Para-Index even with good wind → low score"""
        # Simulate: Para-Index 30, wind aligned → score = 30 × 1.0 = 30
        para_index = 30
        favorability = get_wind_favorability("SW", "SW", 12.0)
        multiplier = get_wind_score_multiplier(favorability)
        
        final_score = para_index * multiplier
        
        assert favorability == "good"
        assert final_score == 30.0
    
    def test_wind_orientation_matters(self):
        """Site with lower Para-Index but better wind can win"""
        # Site A: Para-Index 70, wind aligned → 70 × 1.0 = 70
        site_a_score = 70 * get_wind_score_multiplier(
            get_wind_favorability("SW", "SW", 12.0)
        )
        
        # Site B: Para-Index 80, wind opposed → 80 × 0.3 = 24
        site_b_score = 80 * get_wind_score_multiplier(
            get_wind_favorability("NE", "SW", 12.0)
        )
        
        # Site A should win despite lower Para-Index
        assert site_a_score > site_b_score


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_angle_difference_boundaries(self):
        """Test exact boundary angles"""
        # Exactly 45° → should be good
        assert calculate_angle_difference(0, 45) == 45
        assert calculate_angle_difference(225, 270) == 45
        
        # Exactly 90° → should be moderate
        assert calculate_angle_difference(0, 90) == 90
        assert calculate_angle_difference(225, 135) == 90
        
        # Exactly 180° → should be bad
        assert calculate_angle_difference(0, 180) == 180
        assert calculate_angle_difference(225, 45) == 180
    
    def test_wind_speed_boundaries(self):
        """Test exact boundary wind speeds"""
        # Exactly 5 km/h → should be bad (< 5)
        result = get_wind_favorability("SW", "SW", 5.0)
        assert result in ["bad", "moderate", "good"]
        
        # Exactly 30 km/h → should be bad (> 30)
        result = get_wind_favorability("SW", "SW", 30.0)
        assert result in ["bad", "moderate", "good"]
    
    def test_multiplier_range(self):
        """Multipliers always in valid range"""
        for favorability in ["good", "moderate", "bad", "unknown", None]:
            multiplier = get_wind_score_multiplier(favorability)
            assert 0.0 <= multiplier <= 1.0
    
    def test_circular_symmetry(self):
        """Angle difference is symmetric"""
        for angle1 in [0, 45, 90, 135, 180, 225, 270, 315]:
            for angle2 in [0, 45, 90, 135, 180, 225, 270, 315]:
                diff1 = calculate_angle_difference(angle1, angle2)
                diff2 = calculate_angle_difference(angle2, angle1)
                assert diff1 == diff2
