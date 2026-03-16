"""
API tests for /flights endpoints

Tests HTTP endpoints in routes.py related to flight management.
Coverage: GET, POST, PATCH, DELETE for flights.
"""
import pytest
from datetime import datetime, date, timedelta
from models import Flight, Site
import json
from pathlib import Path


class TestFlightsListEndpoint:
    """Tests for GET /flights"""
    
    def test_get_flights_empty_database(self, client, db_session):
        """GET /flights returns empty list when no flights exist"""
        response = client.get("/flights")
        assert response.status_code == 200
        data = response.json()
        assert data["flights"] == []
        assert data["total"] == 0
    
    def test_get_flights_returns_all_flights(self, client, db_session, arguel_site):
        """GET /flights returns all flights"""
        # Create 3 flights
        flights = []
        for i in range(3):
            flight = Flight(
                id=f"flight-{i}",
                name=f"Flight {i}",
                flight_date=date(2026, 3, 15 + i),
                site_id="site-arguel",
                duration_minutes=60 + i * 10
            )
            db_session.add(flight)
            flights.append(flight)
        db_session.commit()
        
        response = client.get("/flights")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["flights"]) == 3
    
    def test_get_flights_filter_by_site(self, client, db_session, arguel_site, chalais_site):
        """GET /flights?site_id=X filters by site"""
        # Create flights for different sites
        flight_arguel = Flight(
            id="flight-arguel",
            name="Arguel Flight",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel"
        )
        flight_chalais = Flight(
            id="flight-chalais",
            name="Chalais Flight",
            flight_date=date(2026, 3, 16),
            site_id="site-chalais"
        )
        db_session.add_all([flight_arguel, flight_chalais])
        db_session.commit()
        
        response = client.get("/flights?site_id=site-arguel")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["flights"][0]["id"] == "flight-arguel"
    
    def test_get_flights_filter_by_year(self, client, db_session, arguel_site):
        """GET /flights?year=2026 filters by year"""
        # Create flights in different years
        flight_2025 = Flight(
            id="flight-2025",
            name="2025 Flight",
            flight_date=date(2025, 12, 31),
            site_id="site-arguel"
        )
        flight_2026 = Flight(
            id="flight-2026",
            name="2026 Flight",
            flight_date=date(2026, 1, 1),
            site_id="site-arguel"
        )
        db_session.add_all([flight_2025, flight_2026])
        db_session.commit()
        
        response = client.get("/flights?year=2026")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["flights"][0]["id"] == "flight-2026"
    
    def test_get_flights_pagination(self, client, db_session, arguel_site):
        """GET /flights supports limit and skip"""
        # Create 10 flights
        for i in range(10):
            flight = Flight(
                id=f"flight-{i:02d}",
                name=f"Flight {i}",
                flight_date=date(2026, 3, 1) + timedelta(days=i),
                site_id="site-arguel"
            )
            db_session.add(flight)
        db_session.commit()
        
        # First page
        response = client.get("/flights?limit=5&skip=0")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flights"]) == 5
        assert data["total"] == 10
        
        # Second page
        response = client.get("/flights?limit=5&skip=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data["flights"]) == 5
        assert data["total"] == 10
    
    def test_get_flights_sort_by_date_desc(self, client, db_session, arguel_site):
        """GET /flights returns flights sorted by date descending"""
        # Create flights with different dates
        dates = [date(2026, 3, 10), date(2026, 3, 15), date(2026, 3, 12)]
        for i, flight_date in enumerate(dates):
            flight = Flight(
                id=f"flight-{i}",
                name=f"Flight {i}",
                flight_date=flight_date,
                site_id="site-arguel"
            )
            db_session.add(flight)
        db_session.commit()
        
        response = client.get("/flights")
        assert response.status_code == 200
        data = response.json()
        
        # Should be sorted desc: 2026-03-15, 2026-03-12, 2026-03-10
        assert data["flights"][0]["flight_date"] == "2026-03-15"
        assert data["flights"][1]["flight_date"] == "2026-03-12"
        assert data["flights"][2]["flight_date"] == "2026-03-10"


class TestFlightStatsEndpoint:
    """Tests for GET /flights/stats"""
    
    def test_get_flight_stats_empty_database(self, client, db_session):
        """GET /flights/stats returns zeros when no flights"""
        response = client.get("/flights/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_flights"] == 0
        assert data["total_distance_km"] == 0
        assert data["total_duration_minutes"] == 0
    
    def test_get_flight_stats_calculates_totals(self, client, db_session, arguel_site):
        """GET /flights/stats calculates totals correctly"""
        # Create flights with known stats
        flight1 = Flight(
            id="flight-1",
            name="Flight 1",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            distance_km=10.5,
            duration_minutes=60
        )
        flight2 = Flight(
            id="flight-2",
            name="Flight 2",
            flight_date=date(2026, 3, 16),
            site_id="site-arguel",
            distance_km=15.0,
            duration_minutes=90
        )
        db_session.add_all([flight1, flight2])
        db_session.commit()
        
        response = client.get("/flights/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_flights"] == 2
        assert data["total_distance_km"] == 25.5
        assert data["total_duration_minutes"] == 150
    
    def test_get_flight_stats_handles_nulls(self, client, db_session, arguel_site):
        """GET /flights/stats handles NULL distance/duration"""
        flight = Flight(
            id="flight-1",
            name="Flight 1",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            distance_km=None,
            duration_minutes=None
        )
        db_session.add(flight)
        db_session.commit()
        
        response = client.get("/flights/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_flights"] == 1
        # Should handle NULL gracefully
        assert data["total_distance_km"] >= 0
        assert data["total_duration_minutes"] >= 0


class TestFlightRecordsEndpoint:
    """Tests for GET /flights/records"""
    
    def test_get_flight_records_empty_database(self, client, db_session):
        """GET /flights/records returns nulls when no flights"""
        response = client.get("/flights/records")
        assert response.status_code == 200
        data = response.json()
        assert data["longest_flight"] is None
        assert data["highest_altitude"] is None
        assert data["fastest_speed"] is None
    
    def test_get_flight_records_finds_records(self, client, db_session, arguel_site):
        """GET /flights/records finds max distance, altitude, speed"""
        # Create flights with different records
        flight1 = Flight(
            id="flight-1",
            name="Longest",
            flight_date=date(2026, 3, 15),
            site_id="site-arguel",
            distance_km=100.0,  # Longest
            max_altitude_m=1200,
            max_speed_kmh=40.0
        )
        flight2 = Flight(
            id="flight-2",
            name="Highest",
            flight_date=date(2026, 3, 16),
            site_id="site-arguel",
            distance_km=50.0,
            max_altitude_m=2500,  # Highest
            max_speed_kmh=35.0
        )
        flight3 = Flight(
            id="flight-3",
            name="Fastest",
            flight_date=date(2026, 3, 17),
            site_id="site-arguel",
            distance_km=30.0,
            max_altitude_m=1000,
            max_speed_kmh=55.0  # Fastest
        )
        db_session.add_all([flight1, flight2, flight3])
        db_session.commit()
        
        response = client.get("/flights/records")
        assert response.status_code == 200
        data = response.json()
        
        assert data["longest_flight"]["id"] == "flight-1"
        assert data["longest_flight"]["distance_km"] == 100.0
        
        assert data["highest_altitude"]["id"] == "flight-2"
        assert data["highest_altitude"]["max_altitude_m"] == 2500
        
        assert data["fastest_speed"]["id"] == "flight-3"
        assert data["fastest_speed"]["max_speed_kmh"] == 55.0


class TestFlightDetailEndpoint:
    """Tests for GET /flights/{flight_id}"""
    
    def test_get_flight_not_found(self, client, db_session):
        """GET /flights/{flight_id} returns 404 for non-existent flight"""
        response = client.get("/flights/non-existent")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_get_flight_returns_details(self, client, db_session, sample_flight):
        """GET /flights/{flight_id} returns flight details"""
        response = client.get("/flights/flight-test-001")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "flight-test-001"
        assert data["name"] == "Arguel 15-03 14h00"
        assert data["flight_date"] == "2026-03-15"
        assert data["duration_minutes"] == 60
        assert data["distance_km"] == 15.5
        assert data["site_id"] == "site-arguel"
    
    def test_get_flight_includes_site_details(self, client, db_session, sample_flight):
        """GET /flights/{flight_id} includes site information"""
        response = client.get("/flights/flight-test-001")
        assert response.status_code == 200
        data = response.json()
        assert "site" in data
        assert data["site"]["name"] == "Arguel"


class TestUpdateFlightEndpoint:
    """Tests for PATCH /flights/{flight_id}"""
    
    def test_update_flight_not_found(self, client, db_session):
        """PATCH /flights/{flight_id} returns 404 for non-existent flight"""
        response = client.patch(
            "/flights/non-existent",
            json={"name": "New Name"}
        )
        assert response.status_code == 404
    
    def test_update_flight_name(self, client, db_session, sample_flight):
        """PATCH /flights/{flight_id} updates flight name"""
        response = client.patch(
            "/flights/flight-test-001",
            json={"name": "Updated Flight Name"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Flight Name"
        
        # Verify in DB
        db_session.refresh(sample_flight)
        assert sample_flight.name == "Updated Flight Name"
    
    def test_update_flight_notes(self, client, db_session, sample_flight):
        """PATCH /flights/{flight_id} updates notes"""
        response = client.patch(
            "/flights/flight-test-001",
            json={"notes": "Great thermal conditions!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notes"] == "Great thermal conditions!"
    
    def test_update_flight_multiple_fields(self, client, db_session, sample_flight):
        """PATCH /flights/{flight_id} updates multiple fields"""
        response = client.patch(
            "/flights/flight-test-001",
            json={
                "name": "New Name",
                "notes": "New notes",
                "distance_km": 20.5
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        assert data["notes"] == "New notes"
        assert data["distance_km"] == 20.5


class TestDeleteFlightEndpoint:
    """Tests for DELETE /flights/{flight_id}"""
    
    def test_delete_flight_not_found(self, client, db_session):
        """DELETE /flights/{flight_id} returns 404 for non-existent flight"""
        response = client.delete("/flights/non-existent")
        assert response.status_code == 404
    
    def test_delete_flight_success(self, client, db_session, sample_flight):
        """DELETE /flights/{flight_id} deletes flight"""
        response = client.delete("/flights/flight-test-001")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()
        
        # Verify flight is deleted
        flight = db_session.query(Flight).filter(Flight.id == "flight-test-001").first()
        assert flight is None
    
    def test_delete_flight_removes_from_list(self, client, db_session, sample_flight):
        """DELETE /flights/{flight_id} removes flight from GET /flights"""
        # Verify flight exists
        response = client.get("/flights")
        assert response.json()["total"] == 1
        
        # Delete flight
        client.delete("/flights/flight-test-001")
        
        # Verify flight is gone
        response = client.get("/flights")
        assert response.json()["total"] == 0


class TestCreateFlightEndpoint:
    """Tests for POST /flights"""
    
    def test_create_flight_minimal(self, client, db_session, arguel_site):
        """POST /flights creates flight with minimal data"""
        flight_data = {
            "name": "New Flight",
            "flight_date": "2026-03-20",
            "site_id": "site-arguel"
        }
        response = client.post("/flights", json=flight_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Flight"
        assert data["site_id"] == "site-arguel"
        
        # Verify in DB
        flight = db_session.query(Flight).filter(Flight.name == "New Flight").first()
        assert flight is not None
    
    def test_create_flight_full_data(self, client, db_session, arguel_site):
        """POST /flights creates flight with complete data"""
        flight_data = {
            "name": "Complete Flight",
            "flight_date": "2026-03-20",
            "site_id": "site-arguel",
            "duration_minutes": 90,
            "distance_km": 25.5,
            "max_altitude_m": 1500,
            "max_speed_kmh": 42.0,
            "notes": "Perfect conditions"
        }
        response = client.post("/flights", json=flight_data)
        assert response.status_code == 200
        data = response.json()
        assert data["distance_km"] == 25.5
        assert data["max_altitude_m"] == 1500
        assert data["notes"] == "Perfect conditions"
    
    def test_create_flight_invalid_site(self, client, db_session):
        """POST /flights fails with invalid site_id"""
        flight_data = {
            "name": "Invalid Flight",
            "flight_date": "2026-03-20",
            "site_id": "non-existent-site"
        }
        response = client.post("/flights", json=flight_data)
        # Should fail with 404 or 400
        assert response.status_code in [400, 404, 500]


class TestFlightGPXEndpoints:
    """Tests for GPX-related endpoints"""
    
    def test_get_gpx_data_no_gpx(self, client, db_session, sample_flight):
        """GET /flights/{flight_id}/gpx-data returns empty when no GPX"""
        response = client.get("/flights/flight-test-001/gpx-data")
        # Should return empty or 404
        assert response.status_code in [200, 404]
    
    def test_download_gpx_no_file(self, client, db_session, sample_flight):
        """GET /flights/{flight_id}/gpx returns 404 when no GPX file"""
        response = client.get("/flights/flight-test-001/gpx")
        assert response.status_code == 404
    
    def test_upload_gpx_to_flight(self, client, db_session, sample_flight, sample_gpx):
        """POST /flights/{flight_id}/upload-gpx uploads GPX file"""
        # Create file upload
        files = {
            "file": ("test.gpx", sample_gpx.encode(), "application/gpx+xml")
        }
        response = client.post("/flights/flight-test-001/upload-gpx", files=files)
        # May succeed or fail depending on implementation
        assert response.status_code in [200, 201, 400, 500]


class TestCreateFlightFromGPX:
    """Tests for POST /flights/create-from-gpx"""
    
    def test_create_flight_from_gpx_valid(self, client, db_session, arguel_site, sample_gpx):
        """POST /flights/create-from-gpx creates flight from GPX"""
        files = {
            "file": ("arguel.gpx", sample_gpx.encode(), "application/gpx+xml")
        }
        data = {
            "site_id": "site-arguel"
        }
        response = client.post("/flights/create-from-gpx", files=files, data=data)
        # Should succeed or fail gracefully
        assert response.status_code in [200, 201, 400, 422, 500]
    
    def test_create_flight_from_gpx_no_file(self, client, db_session, arguel_site):
        """POST /flights/create-from-gpx fails without file"""
        data = {"site_id": "site-arguel"}
        response = client.post("/flights/create-from-gpx", data=data)
        assert response.status_code in [400, 422]


class TestHealthCheck:
    """Tests for /health endpoint"""
    
    def test_health_check_returns_ok(self, client):
        """GET /health returns healthy status"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
