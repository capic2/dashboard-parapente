"""
Test API routes (integration tests)
"""

from datetime import datetime

from models import Flight, ParaglidingSpot, Site


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
            elevation_m=427,
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
            elevation_m=500,
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
            duration_minutes=60,
            distance_km=10.5,
            max_altitude_m=1500,
            name="Arguel 01-03 10h30",
            gpx_file_path=None,
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
                duration_minutes=60,
                distance_km=10.0 + i,
                max_altitude_m=1500,
                name=f"Flight {i}",
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
            duration_minutes=60,
            distance_km=10.5,
            max_altitude_m=1500,
            name="Arguel 01-03 10h30",
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
            code="TEST",
            name="Test Site",
            latitude=47.2,
            longitude=6.0,
            elevation_m=427,
        )
        db_session.add(site)
        db_session.commit()

        # This may fail if weather sources aren't available, but endpoint should exist
        response = client.get("/api/weather/site-test?day_index=0", timeout=10)
        assert response.status_code in [200, 500]  # Either success or service error


class TestLocationWeatherEndpoints:
    """Test city search and nearby flight option endpoints"""

    def test_search_locations(self, client, monkeypatch):
        def fake_search_locations(query, country="FR", limit=5):
            assert query == "Besan"
            assert country == "FR"
            assert limit == 5
            return [
                {
                    "id": "osm-besancon",
                    "name": "Besançon",
                    "display_name": "Besançon, Doubs, France",
                    "latitude": 47.238,
                    "longitude": 6.024,
                    "country": "FR",
                }
            ]

        monkeypatch.setattr("spots.search_locations", fake_search_locations)

        response = client.get("/api/locations/search?query=Besan")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "Besan"
        assert data["locations"][0]["name"] == "Besançon"

    def test_nearby_flight_options_split_takeoffs_landings_and_both(self, client, db_session):
        db_session.add_all(
            [
                ParaglidingSpot(
                    id="takeoff-near",
                    name="Déco proche",
                    type="takeoff",
                    latitude=47.24,
                    longitude=6.03,
                    elevation_m=450,
                    country="FR",
                    source="test",
                ),
                ParaglidingSpot(
                    id="landing-near",
                    name="Atterro proche",
                    type="landing",
                    latitude=47.23,
                    longitude=6.02,
                    elevation_m=250,
                    country="FR",
                    source="test",
                ),
                ParaglidingSpot(
                    id="both-near",
                    name="Site polyvalent proche",
                    type="both",
                    latitude=47.238,
                    longitude=6.024,
                    elevation_m=350,
                    country="FR",
                    source="test",
                ),
            ]
        )
        db_session.commit()

        response = client.get(
            "/api/locations/nearby-flight-options?lat=47.238&lon=6.024&name=Besançon&radius_km=10&limit=3"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["city_option"]["name"] == "Besançon"
        assert [spot["id"] for spot in data["takeoffs"]] == ["both-near", "takeoff-near"]
        assert [spot["id"] for spot in data["landings"]] == ["both-near", "landing-near"]

    def test_weather_by_coordinates(self, client, monkeypatch):
        async def fake_forecast(*args, **kwargs):
            return {
                "success": True,
                "total_sources": 1,
                "sunrise": "07:00",
                "sunset": "18:00",
                "cached_at": "2026-05-06T10:00:00Z",
                "consensus": [
                    {
                        "hour": 12,
                        "temperature": 18,
                        "wind_speed": 12,
                        "wind_gust": 18,
                        "wind_direction": 240,
                        "precipitation": 0,
                        "cloud_cover": 20,
                        "cape": 300,
                        "lifted_index": -1,
                    }
                ],
            }

        monkeypatch.setattr("routes.get_normalized_forecast", fake_forecast)

        response = client.get("/api/weather/coordinates?lat=47.238&lon=6.024&name=Besançon")

        assert response.status_code == 200
        data = response.json()
        assert data["site_id"] == "coordinates"
        assert data["site_name"] == "Besançon"
        assert data["coordinates"] == {"latitude": 47.238, "longitude": 6.024}
        assert data["para_index"] >= 0


class TestAlertsEndpoints:
    """Test /api/alerts endpoints"""

    def test_get_alerts_empty(self, client):
        """Get alerts when none exist"""
        response = client.get("/api/alerts")
        assert response.status_code == 200
        alerts = response.json()
        # Should return list
        assert isinstance(alerts, list) or isinstance(alerts, dict)
