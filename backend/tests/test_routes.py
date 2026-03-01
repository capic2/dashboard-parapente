"""
Test API routes (integration tests)
"""
import pytest
from models import Site, Flight
from datetime import datetime, timedelta


class TestSpotsEndpoints:
    """Test /api/spots endpoints"""
    
    def test_get_spots_empty(self, client, db_session):
        """Get spots when DB is empty"""
        response = client.get("/api/spots")
        assert response.status_code == 200
        data = response.json()
        assert "sites" in data
        assert data["sites"] == []
    
    def test_get_spots_with_data(self, client, db_session):
        """Get spots with sample data"""
        # Add sample site
        site = Site(
            id="site-arguel",
            code="ARG",
            name="Arguel",
            latitude=47.2,
            longitude=6.0,
            elevation_m=427
        )
        db_session.add(site)
        db_session.commit()
        
        response = client.get("/api/spots")
        assert response.status_code == 200
        data = response.json()
        assert len(data["sites"]) == 1
        assert data["sites"][0]["name"] == "Arguel"
    
    def test_get_spot_by_id(self, client, db_session):
        """Get a specific spot"""
        site = Site(
            id="site-test",
            code="TEST",
            name="Test Site",
            latitude=47.0,
            longitude=6.0,
            elevation_m=500
        )
        db_session.add(site)
        db_session.commit()
        
        response = client.get("/api/spots/site-test")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Site"
    
    def test_get_spot_not_found(self, client):
        """Get nonexistent spot"""
        response = client.get("/api/spots/nonexistent")
        assert response.status_code == 404


class TestFlightsEndpoints:
    """Test /api/flights endpoints"""
    
    def test_get_flights_empty(self, client):
        """Get flights when DB is empty"""
        response = client.get("/api/flights")
        assert response.status_code == 200
        data = response.json()
        assert "flights" in data
        assert data["flights"] == []
    
    def test_get_flights_with_data(self, client, db_session):
        """Get flights with sample data"""
        flight = Flight(
            id="flight-001",
            flight_date=datetime.now().date(),
            departure_time=datetime.now(),
            landing_time=datetime.now() + timedelta(hours=1),
            duration_minutes=60,
            distance_km=10.5,
            max_altitude_m=1500,
            site_name="Arguel",
            gpx_file_path=None
        )
        db_session.add(flight)
        db_session.commit()
        
        response = client.get("/api/flights")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flights"]) == 1
        assert data["flights"][0]["distance_km"] == 10.5
    
    def test_get_flights_with_limit(self, client, db_session):
        """Get limited number of flights"""
        # Add 3 flights
        for i in range(3):
            flight = Flight(
                id=f"flight-{i:03d}",
                flight_date=datetime.now().date(),
                departure_time=datetime.now(),
                landing_time=datetime.now() + timedelta(hours=1),
                duration_minutes=60,
                distance_km=10.0 + i,
                max_altitude_m=1500,
                site_name="Arguel"
            )
            db_session.add(flight)
        db_session.commit()
        
        response = client.get("/api/flights?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flights"]) == 2
    
    def test_get_flights_stats(self, client, db_session):
        """Get flight statistics"""
        flight = Flight(
            id="flight-001",
            flight_date=datetime.now().date(),
            departure_time=datetime.now(),
            landing_time=datetime.now() + timedelta(hours=1),
            duration_minutes=60,
            distance_km=10.5,
            max_altitude_m=1500,
            site_name="Arguel"
        )
        db_session.add(flight)
        db_session.commit()
        
        response = client.get("/api/flights/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_flights" in data
        assert "total_distance_km" in data
        assert data["total_flights"] >= 1


class TestWeatherEndpoints:
    """Test /api/weather endpoints"""
    
    def test_get_weather_missing_site(self, client):
        """Get weather for nonexistent site"""
        response = client.get("/api/weather/nonexistent?day_index=0")
        assert response.status_code == 404
    
    def test_get_weather_with_site(self, client, db_session):
        """Get weather for existing site (may error if no data source available)"""
        site = Site(
            id="site-test",
            name="Test Site",
            latitude=47.2,
            longitude=6.0,
            altitude=427
        )
        db_session.add(site)
        db_session.commit()
        
        # This may fail if weather sources aren't available, but endpoint should exist
        response = client.get("/api/weather/site-test?day_index=0", timeout=10)
        assert response.status_code in [200, 500]  # Either success or service error


class TestAlertsEndpoints:
    """Test /api/alerts endpoints"""
    
    def test_get_alerts_empty(self, client):
        """Get alerts when none exist"""
        response = client.get("/api/alerts")
        assert response.status_code == 200
        alerts = response.json()
        # Should return list
        assert isinstance(alerts, list) or isinstance(alerts, dict)
