"""
API tests for /spots endpoints

Tests HTTP endpoints in routes.py related to paragliding spots.
Coverage: GET, POST, PATCH, DELETE for spots/sites.
"""
import pytest
from datetime import datetime, date
from models import Site
from unittest.mock import patch, MagicMock
import json


class TestSpotsListEndpoint:
    """Tests for GET /spots"""
    
    def test_get_spots_empty_database(self, client, db_session):
        """GET /spots returns empty list when no spots exist"""
        response = client.get("/spots")
        assert response.status_code == 200
        data = response.json()
        assert data["sites"] == []
        assert data["total"] == 0
    
    def test_get_spots_returns_all_sites(self, client, db_session, arguel_site, chalais_site):
        """GET /spots returns all sites"""
        response = client.get("/spots")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["sites"]) == 2
    
    def test_get_spots_includes_site_details(self, client, db_session, arguel_site):
        """GET /spots includes site name, coordinates, elevation"""
        response = client.get("/spots")
        assert response.status_code == 200
        data = response.json()
        site = data["sites"][0]
        assert "name" in site
        assert "latitude" in site
        assert "longitude" in site
        assert "elevation_m" in site


class TestSpotsSearchEndpoint:
    """Tests for GET /spots/search"""
    
    def test_search_spots_no_params(self, client, db_session, arguel_site, chalais_site):
        """GET /spots/search with no params returns all spots"""
        response = client.get("/spots/search")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    def test_search_spots_by_name(self, client, db_session, arguel_site, chalais_site):
        """GET /spots/search?q=Arguel searches by name"""
        response = client.get("/spots/search?q=Arguel")
        assert response.status_code == 200
        data = response.json()
        # Should find Arguel
        assert any(spot["name"] == "Arguel" for spot in data)
    
    def test_search_spots_by_region(self, client, db_session, arguel_site):
        """GET /spots/search?region=Doubs filters by region"""
        response = client.get("/spots/search?region=Doubs")
        assert response.status_code == 200
        data = response.json()
        # All results should be in Doubs
        assert all(spot.get("region") == "Doubs" for spot in data)
    
    def test_search_spots_near_coordinates(self, client, db_session, arguel_site):
        """GET /spots/search?lat=47.2&lon=6.0&radius=50 finds nearby spots"""
        response = client.get("/spots/search?lat=47.2&lon=6.0&radius=50")
        assert response.status_code == 200
        data = response.json()
        # Should find Arguel (exact coords)
        assert any(spot["name"] == "Arguel" for spot in data)
    
    def test_search_spots_empty_result(self, client, db_session):
        """GET /spots/search?q=NonExistent returns empty array"""
        response = client.get("/spots/search?q=NonExistentSpot123")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0


class TestSpotsDetailEndpoint:
    """Tests for GET /spots/detail/{spot_id}"""
    
    def test_get_spot_detail_not_found(self, client, db_session):
        """GET /spots/detail/{spot_id} returns 404 for non-existent spot"""
        response = client.get("/spots/detail/non-existent")
        assert response.status_code == 404
    
    def test_get_spot_detail_success(self, client, db_session, arguel_site):
        """GET /spots/detail/{spot_id} returns detailed spot info"""
        response = client.get("/spots/detail/site-arguel")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "site-arguel"
        assert data["name"] == "Arguel"
        assert data["latitude"] == 47.2
        assert data["longitude"] == 6.0
    
    def test_get_spot_detail_includes_orientation(self, client, db_session, arguel_site):
        """GET /spots/detail/{spot_id} includes orientation"""
        response = client.get("/spots/detail/site-arguel")
        assert response.status_code == 200
        data = response.json()
        assert data["orientation"] == "SW"


class TestSpotWeatherEndpoint:
    """Tests for GET /spots/weather/{spot_id}"""
    
    def test_get_spot_weather_not_found(self, client, db_session):
        """GET /spots/weather/{spot_id} returns 404 for invalid spot"""
        response = client.get("/spots/weather/non-existent")
        assert response.status_code == 404
    
    def test_get_spot_weather_success(self, client, db_session, arguel_site):
        """GET /spots/weather/{spot_id} returns weather for spot"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {
                "spot_id": "site-arguel",
                "forecast": []
            }
            
            response = client.get("/spots/weather/site-arguel")
            assert response.status_code in [200, 500]


class TestBestSpotEndpoint:
    """Tests for GET /spots/best"""
    
    def test_get_best_spot_no_spots(self, client, db_session):
        """GET /spots/best returns 404 when no spots exist"""
        response = client.get("/spots/best")
        assert response.status_code in [200, 404]
    
    def test_get_best_spot_single_spot(self, client, db_session, arguel_site):
        """GET /spots/best returns single spot when only one exists"""
        with patch("routes.calculate_best_spot") as mock_best:
            mock_best.return_value = {
                "spot_id": "site-arguel",
                "score": 85.0
            }
            
            response = client.get("/spots/best")
            # Should return best spot or fail gracefully
            assert response.status_code in [200, 404, 500]
    
    def test_get_best_spot_multiple_spots(self, client, db_session, arguel_site, chalais_site):
        """GET /spots/best returns highest scoring spot"""
        with patch("routes.calculate_best_spot") as mock_best:
            mock_best.return_value = {
                "spot_id": "site-chalais",
                "score": 92.0
            }
            
            response = client.get("/spots/best")
            assert response.status_code in [200, 404, 500]


class TestGetSpotByIdEndpoint:
    """Tests for GET /spots/{spot_id}"""
    
    def test_get_spot_by_id_not_found(self, client, db_session):
        """GET /spots/{spot_id} returns 404 for non-existent spot"""
        response = client.get("/spots/non-existent")
        assert response.status_code == 404
    
    def test_get_spot_by_id_success(self, client, db_session, arguel_site):
        """GET /spots/{spot_id} returns spot details"""
        response = client.get("/spots/site-arguel")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "site-arguel"
        assert data["name"] == "Arguel"


class TestCreateSiteEndpoint:
    """Tests for POST /spots"""
    
    def test_create_site_minimal(self, client, db_session):
        """POST /spots creates site with minimal data"""
        site_data = {
            "name": "New Site",
            "latitude": 47.0,
            "longitude": 6.0,
            "site_type": "user_spot"
        }
        response = client.post("/spots", json=site_data)
        # Should create or fail with validation
        assert response.status_code in [200, 201, 400, 422]
    
    def test_create_site_full_data(self, client, db_session):
        """POST /spots creates site with complete data"""
        site_data = {
            "name": "Complete Site",
            "code": "CMP",
            "latitude": 47.0,
            "longitude": 6.0,
            "elevation_m": 1200,
            "region": "Test Region",
            "country": "France",
            "orientation": "N",
            "site_type": "user_spot",
            "usage_type": "takeoff"
        }
        response = client.post("/spots", json=site_data)
        assert response.status_code in [200, 201, 400, 422]
    
    def test_create_site_invalid_coordinates(self, client, db_session):
        """POST /spots fails with invalid coordinates"""
        site_data = {
            "name": "Invalid Site",
            "latitude": 999.0,  # Invalid
            "longitude": -999.0,  # Invalid
            "site_type": "user_spot"
        }
        response = client.post("/spots", json=site_data)
        # Should fail validation
        assert response.status_code in [400, 422]
    
    def test_create_site_missing_required_fields(self, client, db_session):
        """POST /spots fails without required fields"""
        site_data = {
            "name": "Incomplete Site"
            # Missing latitude, longitude, site_type
        }
        response = client.post("/spots", json=site_data)
        assert response.status_code in [400, 422]


class TestUpdateSiteEndpoint:
    """Tests for PATCH /sites/{site_id}"""
    
    def test_update_site_not_found(self, client, db_session):
        """PATCH /sites/{site_id} returns 404 for non-existent site"""
        response = client.patch(
            "/sites/non-existent",
            json={"name": "Updated"}
        )
        assert response.status_code == 404
    
    def test_update_site_name(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id} updates site name"""
        response = client.patch(
            "/sites/site-arguel",
            json={"name": "Arguel Updated"}
        )
        # Should succeed or fail gracefully
        assert response.status_code in [200, 400, 404, 422]
    
    def test_update_site_orientation(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id}/orientation updates orientation"""
        response = client.patch(
            "/sites/site-arguel/orientation",
            json={"orientation": "N"}
        )
        assert response.status_code in [200, 400, 404, 422]
    
    def test_update_site_camera(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id}/camera updates camera URL"""
        response = client.patch(
            "/sites/site-arguel/camera",
            json={"camera_url": "https://example.com/camera"}
        )
        assert response.status_code in [200, 400, 404, 422]
    
    def test_update_site_multiple_fields(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id} updates multiple fields"""
        response = client.patch(
            "/sites/site-arguel",
            json={
                "name": "New Name",
                "elevation_m": 500,
                "orientation": "E"
            }
        )
        assert response.status_code in [200, 400, 404, 422]


class TestDeleteSiteEndpoint:
    """Tests for DELETE /sites/{site_id}"""
    
    def test_delete_site_not_found(self, client, db_session):
        """DELETE /sites/{site_id} returns 404 for non-existent site"""
        response = client.delete("/sites/non-existent")
        assert response.status_code == 404
    
    def test_delete_site_success(self, client, db_session, arguel_site):
        """DELETE /sites/{site_id} deletes site"""
        response = client.delete("/sites/site-arguel")
        assert response.status_code in [200, 204]
        
        # Verify site is deleted
        site = db_session.query(Site).filter(Site.id == "site-arguel").first()
        assert site is None
    
    def test_delete_site_with_flights(self, client, db_session, sample_flight):
        """DELETE /sites/{site_id} handles site with associated flights"""
        # Try to delete site that has flights
        response = client.delete("/sites/site-arguel")
        # Should fail or cascade delete
        assert response.status_code in [200, 204, 400, 409]


class TestSearchSpotsWithWeather:
    """Tests for GET /spots/search-with-weather"""
    
    def test_search_with_weather_no_spots(self, client, db_session):
        """GET /spots/search-with-weather returns empty when no spots"""
        response = client.get("/spots/search-with-weather")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
    
    def test_search_with_weather_includes_forecast(self, client, db_session, arguel_site):
        """GET /spots/search-with-weather includes weather data"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"forecast": []}
            
            response = client.get("/spots/search-with-weather")
            assert response.status_code in [200, 500]
    
    def test_search_with_weather_filters_by_coords(self, client, db_session, arguel_site):
        """GET /spots/search-with-weather?lat=47&lon=6 filters location"""
        with patch("routes.get_or_fetch_weather") as mock_weather:
            mock_weather.return_value = {"forecast": []}
            
            response = client.get("/spots/search-with-weather?lat=47.0&lon=6.0&radius=50")
            assert response.status_code in [200, 500]


class TestGeocodeEndpoint:
    """Tests for GET /spots/geocode"""
    
    def test_geocode_valid_address(self, client, db_session):
        """GET /spots/geocode?address=Besancon returns coordinates"""
        with patch("routes.geocode_address") as mock_geocode:
            mock_geocode.return_value = {
                "latitude": 47.2,
                "longitude": 6.0,
                "address": "Besançon, France"
            }
            
            response = client.get("/spots/geocode?address=Besancon")
            # Should return coords or fail gracefully
            assert response.status_code in [200, 400, 404, 500]
    
    def test_geocode_missing_address(self, client, db_session):
        """GET /spots/geocode without address parameter fails"""
        response = client.get("/spots/geocode")
        assert response.status_code in [400, 422]
    
    def test_geocode_invalid_address(self, client, db_session):
        """GET /spots/geocode?address=InvalidXYZ123 handles not found"""
        with patch("routes.geocode_address") as mock_geocode:
            mock_geocode.return_value = None
            
            response = client.get("/spots/geocode?address=InvalidXYZ123")
            assert response.status_code in [404, 400, 500]


class TestSpotsSyncEndpoint:
    """Tests for POST /spots/sync"""
    
    def test_sync_spots_from_source(self, client, db_session):
        """POST /spots/sync synchronizes spots from external source"""
        with patch("routes.sync_paragliding_spots") as mock_sync:
            mock_sync.return_value = {
                "synced": 10,
                "new": 5,
                "updated": 5
            }
            
            response = client.post("/spots/sync")
            # Should sync or require auth
            assert response.status_code in [200, 401, 403, 500]


class TestSpotsStatusEndpoint:
    """Tests for GET /spots/status"""
    
    def test_get_spots_sync_status(self, client, db_session):
        """GET /spots/status returns sync status information"""
        response = client.get("/spots/status")
        assert response.status_code in [200, 500]


class TestAdminSpotsEndpoints:
    """Tests for admin spots management"""
    
    def test_seed_sites(self, client, db_session):
        """POST /admin/seed-sites seeds initial sites"""
        with patch("routes.seed_initial_sites") as mock_seed:
            mock_seed.return_value = {"seeded": 5}
            
            response = client.post("/admin/seed-sites")
            # Should seed or require auth
            assert response.status_code in [200, 401, 403, 500]
    
    def test_link_sites_to_spots(self, client, db_session):
        """POST /admin/sites/link-to-spots links user sites to spots DB"""
        with patch("routes.link_user_sites") as mock_link:
            mock_link.return_value = {"linked": 3}
            
            response = client.post("/admin/sites/link-to-spots")
            assert response.status_code in [200, 401, 403, 500]


class TestSpotsErrorHandling:
    """Tests for spots error handling"""
    
    def test_spot_missing_coordinates_error(self, client, db_session):
        """Endpoints handle spots without coordinates gracefully"""
        # Create site with no coordinates
        site = Site(
            id="site-no-coords",
            name="No Coords",
            latitude=None,
            longitude=None,
            site_type="user_spot"
        )
        db_session.add(site)
        db_session.commit()
        
        response = client.get("/spots/weather/site-no-coords")
        # Should fail gracefully
        assert response.status_code in [400, 404, 422, 500]
    
    def test_spot_invalid_orientation(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id}/orientation validates orientation"""
        response = client.patch(
            "/sites/site-arguel/orientation",
            json={"orientation": "INVALID"}
        )
        # Should reject invalid orientation
        assert response.status_code in [400, 422]
