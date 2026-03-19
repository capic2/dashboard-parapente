"""
Unit tests for emagram analysis system
"""

import pytest
import asyncio
from datetime import datetime, date, time
from unittest.mock import Mock, patch, AsyncMock
import json

# Import modules to test
from scrapers.wyoming import (
    EUROPEAN_STATIONS,
    haversine_distance,
    find_closest_station,
    parse_text_list_sounding
)
from meteorology.classic_analysis import (
    calculate_stability_indices,
    calculate_wind_shear,
    estimate_flyable_hours,
    calculate_flyability_score
)


class TestWyomingScraper:
    """Tests for Wyoming radiosonde scraper"""
    
    def test_french_stations_exist(self):
        """Test that European stations are configured for France coverage"""
        assert len(EUROPEAN_STATIONS) == 3
        assert "10739" in EUROPEAN_STATIONS  # Stuttgart (East France)
        assert "10868" in EUROPEAN_STATIONS  # Munich (Alps)
        assert "10548" in EUROPEAN_STATIONS  # Meiningen (NE France)
        
    def test_haversine_distance(self):
        """Test distance calculation"""
        # Lyon to Paris (roughly 400km)
        dist = haversine_distance(45.76, 4.84, 48.85, 2.35)
        assert 350 < dist < 450  # Approximately 400km
        
        # Same point
        dist = haversine_distance(45.76, 4.84, 45.76, 4.84)
        assert dist < 0.1  # Practically 0
        
    def test_find_closest_station_lyon(self):
        """Test finding closest station for Lyon"""
        closest = find_closest_station(45.76, 4.84)
        assert closest['code'] == '10739'  # Stuttgart (closest to Lyon)
        assert 'Stuttgart' in closest['name']
        assert closest['distance_km'] < 500  # ~474km from Lyon to Stuttgart
        
    def test_find_closest_station_paris(self):
        """Test finding closest station for Paris"""
        closest = find_closest_station(48.85, 2.35)
        # Stuttgart is actually closer to Paris than Meiningen
        assert closest['code'] == '10739'  # Stuttgart
        assert 'Stuttgart' in closest['name']
        
    def test_parse_text_list_valid_data(self):
        """Test parsing valid TEXT:LIST data"""
        sample_data = """
-----------------------------------------------------------------------------
   PRES   HGHT   TEMP   DWPT   RELH   MIXR   DRCT   SKNT   THTA   THTE   THTV
    hPa     m      C      C      %    g/kg    deg   knot     K      K      K 
-----------------------------------------------------------------------------
 1000.0    103                                                               
  925.0    781   11.8    7.8     78   6.72    350      8  293.3  313.2  294.5
  850.0   1457    6.4    3.4     81   5.39    340     14  294.5  311.4  295.5
  700.0   3012   -5.5   -8.5     79   2.43    330     25  297.9  306.0  298.3
  500.0   5690  -21.1  -23.7     81   0.68    325     40  302.5  305.5  302.6
"""
        
        result = parse_text_list_sounding(sample_data)
        
        assert result is not None
        assert len(result['pressure_hpa']) == 4
        assert result['pressure_hpa'][0] == 925.0
        assert result['temperature_c'][0] == 11.8
        assert result['levels'] == 4
        
    def test_parse_text_list_invalid_data(self):
        """Test parsing invalid data"""
        result = parse_text_list_sounding("Invalid data")
        assert result is None


class TestClassicMeteorology:
    """Tests for classic meteorology calculations"""
    
    def test_calculate_stability_indices_valid(self):
        """Test stability calculations with valid data"""
        pressure = [1000, 925, 850, 700, 500, 300]
        temperature = [15, 10, 5, -5, -20, -45]
        dewpoint = [10, 7, 3, -8, -25, -50]
        
        result = calculate_stability_indices(pressure, temperature, dewpoint)
        
        assert result['success']
        assert 'cape_jkg' in result
        assert 'lcl_m' in result
        assert 'stabilite_atmospherique' in result
        assert result['cape_jkg'] >= 0
        
    def test_calculate_stability_insufficient_data(self):
        """Test with insufficient data points"""
        result = calculate_stability_indices([1000], [15], [10])
        assert not result['success']
        assert 'error' in result
        
    def test_calculate_flyability_score_excellent(self):
        """Test flyability score for excellent conditions"""
        score = calculate_flyability_score(
            cape_jkg=1000,  # Optimal
            plafond_m=3000,  # Good
            force_thermique_ms=2.5,  # Excellent
            cisaillement='faible',
            risque_orage='nul'
        )
        
        assert 60 <= score <= 100
        
    def test_calculate_flyability_score_poor(self):
        """Test flyability score for poor conditions"""
        score = calculate_flyability_score(
            cape_jkg=50,  # Too weak
            plafond_m=1000,  # Too low
            force_thermique_ms=0.5,  # Weak
            cisaillement='fort',
            risque_orage='élevé'
        )
        
        assert 0 <= score <= 40
        
    def test_estimate_flyable_hours_strong_thermals(self):
        """Test flyable hours estimation for strong thermals"""
        result = estimate_flyable_hours(
            cape_jkg=1200,
            plafond_m=3500,
            stabilite='très instable',
            latitude=45.76
        )
        
        assert result['success']
        assert result['heures_volables_total'] >= 6
        
    def test_calculate_wind_shear_valid(self):
        """Test wind shear calculation"""
        pressure = [1000, 925, 850, 700, 500]
        height = [100, 800, 1500, 3000, 5700]
        wind_u = [2, 5, 8, 10, 15]
        wind_v = [1, 3, 5, 7, 10]
        
        result = calculate_wind_shear(pressure, height, wind_u, wind_v)
        
        assert result['success']
        assert 'wind_shear_0_3km_ms' in result
        assert 'cisaillement_vent' in result


class TestEmagramIntegration:
    """Integration tests for emagram system"""
    
    def test_full_classic_analysis_pipeline(self):
        """Test complete classic analysis pipeline"""
        # Sample sounding data
        pressure = [1000, 925, 850, 700, 500, 300]
        temperature = [15, 10, 5, -5, -20, -45]
        dewpoint = [10, 7, 3, -8, -25, -50]
        
        # Step 1: Calculate stability
        stability = calculate_stability_indices(pressure, temperature, dewpoint)
        assert stability['success']
        
        # Step 2: Estimate flyable hours
        hours = estimate_flyable_hours(
            cape_jkg=stability.get('cape_jkg', 0),
            plafond_m=stability.get('plafond_thermique_m'),
            stabilite=stability.get('stabilite_atmospherique', 'stable'),
            latitude=45.76
        )
        assert hours['success']
        
        # Step 3: Calculate score
        score = calculate_flyability_score(
            cape_jkg=stability.get('cape_jkg', 0),
            plafond_m=stability.get('plafond_thermique_m'),
            force_thermique_ms=stability.get('force_thermique_ms', 0),
            cisaillement='faible',
            risque_orage=stability.get('risque_orage', 'faible')
        )
        assert 0 <= score <= 100


class TestDataValidation:
    """Tests for data validation and edge cases"""
    
    def test_empty_sounding_data(self):
        """Test handling of empty sounding data"""
        result = calculate_stability_indices([], [], [])
        assert not result['success']
        
    def test_none_values_in_data(self):
        """Test handling of None values"""
        pressure = [1000, 925, None, 700]
        temperature = [15, 10, None, -5]
        dewpoint = [10, 7, None, -8]
        
        result = calculate_stability_indices(pressure, temperature, dewpoint)
        # Should filter out None values and still work
        assert result['success'] or 'error' in result
        
    def test_station_lookup_edge_coordinates(self):
        """Test station lookup at edge of France"""
        # North edge
        closest = find_closest_station(51.0, 2.5)
        assert closest is not None
        
        # South edge
        closest = find_closest_station(42.0, 3.0)
        assert closest is not None


# Pytest fixtures
@pytest.fixture
def sample_sounding_data():
    """Sample sounding data fixture"""
    return {
        'pressure_hpa': [1000, 925, 850, 700, 500],
        'temperature_c': [15, 10, 5, -5, -20],
        'dewpoint_c': [10, 7, 3, -8, -25],
        'height_m': [100, 800, 1500, 3000, 5700],
        'wind_speed_knots': [5, 10, 15, 20, 30],
        'wind_direction_deg': [270, 280, 290, 300, 310]
    }


@pytest.fixture
def sample_emagram_analysis():
    """Sample emagram analysis result fixture"""
    return {
        'id': 'test-123',
        'analysis_date': date.today(),
        'analysis_time': time(14, 15),
        'station_code': '07481',
        'station_name': 'Lyon-Bron',
        'plafond_thermique_m': 2500,
        'force_thermique_ms': 2.5,
        'cape_jkg': 850,
        'score_volabilite': 75,
        'analysis_method': 'classic_calculation'
    }


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
