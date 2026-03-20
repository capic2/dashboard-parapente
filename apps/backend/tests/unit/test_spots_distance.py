"""
Unit tests for spots/distance.py - Haversine distance and bounding box calculations

Tests geographical calculations:
- Haversine distance between GPS coordinates
- Bounding box calculation for radius search
- Edge cases (poles, equator, antipodes)
"""

import pytest
from spots.distance import haversine_distance, calculate_bounding_box


@pytest.mark.unit
class TestHaversineDistance:
    """Test Haversine distance formula"""
    
    def test_same_point_zero_distance(self):
        """Same coordinates → 0 km"""
        distance = haversine_distance(47.2, 6.0, 47.2, 6.0)
        assert distance == 0.0
    
    def test_paris_lyon_distance(self):
        """Paris to Lyon ≈ 390 km (known distance)"""
        # Paris: 48.8566° N, 2.3522° E
        # Lyon: 45.7640° N, 4.8357° E
        distance = haversine_distance(48.8566, 2.3522, 45.7640, 4.8357)
        
        # Should be approximately 390 km (±10 km tolerance)
        assert 380 <= distance <= 400
    
    def test_arguel_chalais_distance(self):
        """Arguel to Chalais ≈ 25 km"""
        # Arguel: 47.2, 6.0
        # Chalais: 47.183333, 6.216667
        distance = haversine_distance(47.2, 6.0, 47.183333, 6.216667)
        
        # Should be approximately 20-30 km
        assert 15 <= distance <= 35
    
    def test_short_distance(self):
        """Short distance (few km)"""
        # 0.1 degree difference ≈ 11 km at this latitude
        distance = haversine_distance(47.0, 6.0, 47.1, 6.0)
        
        assert 10 <= distance <= 12
    
    def test_long_distance(self):
        """Long distance (thousands of km)"""
        # Paris to New York ≈ 5800 km
        distance = haversine_distance(48.8566, 2.3522, 40.7128, -74.0060)
        
        assert 5700 <= distance <= 5900
    
    def test_opposite_hemisphere(self):
        """Coordinates in opposite hemispheres"""
        # Northern hemisphere to Southern hemisphere
        distance = haversine_distance(45.0, 6.0, -45.0, 6.0)
        
        # Should be approximately 10,000 km (quarter of Earth)
        assert 9500 <= distance <= 10500
    
    def test_across_equator(self):
        """Distance across equator"""
        distance = haversine_distance(10.0, 0.0, -10.0, 0.0)
        
        # 20 degrees latitude ≈ 2222 km
        assert 2150 <= distance <= 2300
    
    def test_east_west_distance_equator(self):
        """East-West distance at equator"""
        # 10 degrees longitude at equator ≈ 1111 km
        distance = haversine_distance(0.0, 0.0, 0.0, 10.0)
        
        assert 1050 <= distance <= 1150
    
    def test_east_west_distance_high_latitude(self):
        """East-West distance at high latitude (shorter)"""
        # At 60° latitude, 10° longitude ≈ 555 km (half of equator)
        distance = haversine_distance(60.0, 0.0, 60.0, 10.0)
        
        assert 500 <= distance <= 600
    
    def test_antipodes_half_earth(self):
        """Antipodes (opposite sides of Earth) ≈ 20000 km"""
        # Maximum possible distance on Earth
        distance = haversine_distance(0.0, 0.0, 0.0, 180.0)
        
        # Half of Earth's circumference ≈ 20000 km
        assert 19500 <= distance <= 20500
    
    def test_negative_coordinates(self):
        """Negative coordinates (Southern hemisphere, Western hemisphere)"""
        # Southern hemisphere, Western hemisphere
        distance = haversine_distance(-33.8688, 151.2093, -34.6037, -58.3816)
        # Sydney to Buenos Aires ≈ 11800 km
        
        assert 11500 <= distance <= 12100
    
    def test_pole_to_pole(self):
        """North Pole to South Pole ≈ 20000 km"""
        distance = haversine_distance(90.0, 0.0, -90.0, 0.0)
        
        # Half of Earth's circumference
        assert 19500 <= distance <= 20500


@pytest.mark.unit
class TestCalculateBoundingBox:
    """Test bounding box calculation"""
    
    def test_bounding_box_50km(self):
        """Bounding box 50 km around Arguel"""
        lat, lon = 47.2, 6.0
        radius_km = 50
        
        min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)
        
        # Min should be less than center
        assert min_lat < lat
        assert min_lon < lon
        
        # Max should be greater than center
        assert max_lat > lat
        assert max_lon > lon
    
    def test_bounding_box_symmetry(self):
        """Bounding box should be roughly symmetric"""
        lat, lon = 45.0, 6.0
        radius_km = 100
        
        min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)
        
        # Latitude difference should be roughly symmetric
        lat_diff_min = lat - min_lat
        lat_diff_max = max_lat - lat
        
        # Should be within 10% of each other
        assert abs(lat_diff_min - lat_diff_max) < 0.5
    
    def test_small_radius(self):
        """Small radius (1 km)"""
        lat, lon = 47.0, 6.0
        radius_km = 1
        
        min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)
        
        # Box should be small
        lat_diff = max_lat - min_lat
        lon_diff = max_lon - min_lon
        
        assert lat_diff < 0.05  # Less than 0.05 degrees
        assert lon_diff < 0.05
    
    def test_large_radius(self):
        """Large radius (500 km)"""
        lat, lon = 47.0, 6.0
        radius_km = 500
        
        min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)
        
        # Box should be large
        lat_diff = max_lat - min_lat
        lon_diff = max_lon - min_lon
        
        assert lat_diff > 5  # More than 5 degrees
        assert lon_diff > 5
    
    def test_equator_bounding_box(self):
        """Bounding box at equator"""
        lat, lon = 0.0, 0.0
        radius_km = 100
        
        min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)
        
        # At equator, lon/lat degrees are roughly equal
        lat_diff = max_lat - min_lat
        lon_diff = max_lon - min_lon
        
        # Should be close to each other at equator
        assert abs(lat_diff - lon_diff) < 0.5
    
    def test_high_latitude_bounding_box(self):
        """Bounding box at high latitude (longitude degrees wider)"""
        lat, lon = 70.0, 0.0  # High latitude
        radius_km = 100
        
        min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)
        
        # At high latitude, longitude degrees span more
        lat_diff = max_lat - min_lat
        lon_diff = max_lon - min_lon
        
        # Longitude difference should be larger than latitude
        assert lon_diff > lat_diff
    
    def test_zero_radius(self):
        """Zero radius → point"""
        lat, lon = 47.0, 6.0
        radius_km = 0
        
        min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius_km)
        
        # Should return the point itself (or very close)
        assert abs(min_lat - lat) < 0.001
        assert abs(max_lat - lat) < 0.001
        assert abs(min_lon - lon) < 0.001
        assert abs(max_lon - lon) < 0.001
    
    def test_bbox_contains_center(self):
        """Bounding box always contains center point"""
        lat, lon = 47.2, 6.0
        
        for radius in [1, 10, 50, 100, 500]:
            min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(lat, lon, radius)
            
            assert min_lat <= lat <= max_lat
            assert min_lon <= lon <= max_lon


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_distance_symmetry(self):
        """Distance(A→B) = Distance(B→A)"""
        lat1, lon1 = 47.2, 6.0
        lat2, lon2 = 48.8, 2.3
        
        dist1 = haversine_distance(lat1, lon1, lat2, lon2)
        dist2 = haversine_distance(lat2, lon2, lat1, lon1)
        
        assert dist1 == dist2
    
    def test_very_close_points(self):
        """Very close points (meters apart)"""
        # 0.0001 degree ≈ 11 meters
        distance = haversine_distance(47.0, 6.0, 47.0001, 6.0)
        
        # Should be very small but not zero
        assert 0 < distance < 0.1  # Less than 100 meters
    
    def test_180_longitude_wraparound(self):
        """Longitude wraps at ±180°"""
        # 179° to -179° is 2° difference, not 358°
        distance1 = haversine_distance(0.0, 179.0, 0.0, -179.0)
        distance2 = haversine_distance(0.0, 0.0, 0.0, 2.0)
        
        # Should be approximately equal
        assert abs(distance1 - distance2) < 50  # Within 50 km
    
    def test_consistent_units(self):
        """All distances in kilometers"""
        distances = [
            haversine_distance(47.0, 6.0, 47.1, 6.0),
            haversine_distance(48.8, 2.3, 45.7, 4.8),
            haversine_distance(0.0, 0.0, 0.0, 180.0),
        ]
        
        # All should be positive kilometers
        for dist in distances:
            assert dist > 0
            assert dist < 25000  # Less than Earth's half circumference
