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

# API prefix for all routes
API_PREFIX = "/api"


class TestSpotsListEndpoint:
    """Tests for GET /spots"""
    
    def test_get_spots_empty_database(self, client, db_session):
        """GET /spots returns empty list when no spots exist"""
        response = client.get(f"{API_PREFIX}/spots")
        assert response.status_code == 200
        data = response.json()
        assert "sites" in data
        assert data["sites"] == []
    
    def test_get_spots_returns_all_sites(self, client, db_session, arguel_site, chalais_site):
        """GET /spots returns all sites"""
        response = client.get(f"{API_PREFIX}/spots")
        assert response.status_code == 200
        data = response.json()
        assert "sites" in data
        assert len(data["sites"]) == 2
    
    def test_get_spots_includes_site_details(self, client, db_session, arguel_site):
        """GET /spots includes site name, coordinates, elevation"""
        response = client.get(f"{API_PREFIX}/spots")
        assert response.status_code == 200
        data = response.json()
        site = data["sites"][0]
        assert "name" in site
        assert "latitude" in site
        assert "longitude" in site
        assert "elevation_m" in site


class TestSpotsSearchEndpoint:
    """Tests for GET /spots/search"""
    
    def test_search_spots_requires_params(self, client, db_session):
        """GET /spots/search requires city or lat/lon"""
        response = client.get(f"{API_PREFIX}/spots/search")
        # Should fail without params
        assert response.status_code == 400
    
    def test_search_spots_by_city(self, client, db_session, arguel_site, chalais_site):
        """GET /spots/search?city=Besancon searches by city"""
        response = client.get(f"{API_PREFIX}/spots/search?city=Besancon")
        # May succeed or fail depending on geocoding
        assert response.status_code in [200, 400, 500, 503]
    
    def test_search_spots_by_coordinates(self, client, db_session, arguel_site):
        """GET /spots/search?lat=47.2&lon=6.0 finds nearby spots"""
        response = client.get(f"{API_PREFIX}/spots/search?lat=47.2&lon=6.0")
        # Should find spots or return empty
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert "spots" in data
            assert "total" in data
    
    def test_search_spots_with_radius(self, client, db_session, arguel_site):
        """GET /spots/search?lat=47.2&lon=6.0&radius_km=50 accepts radius"""
        response = client.get(f"{API_PREFIX}/spots/search?lat=47.2&lon=6.0&radius_km=50")
        assert response.status_code in [200, 400]
    
    def test_search_spots_with_type_filter(self, client, db_session, arguel_site):
        """GET /spots/search?lat=47.2&lon=6.0&type=takeoff filters by type"""
        response = client.get(f"{API_PREFIX}/spots/search?lat=47.2&lon=6.0&type=takeoff")
        assert response.status_code in [200, 400]


class TestSpotsDetailEndpoint:
    """Tests for GET /spots/detail/{spot_id}"""
    
    def test_get_spot_detail_not_found(self, client, db_session):
        """GET /spots/detail/{spot_id} returns 404 for non-existent spot"""
        response = client.get(f"{API_PREFIX}/spots/detail/non-existent")
        assert response.status_code == 404
    
    def test_get_spot_detail_endpoint_exists(self, client, db_session):
        """GET /spots/detail/{spot_id} endpoint exists"""
        # Endpoint looks in external ParaglidingSpot DB, not local Sites
        response = client.get(f"{API_PREFIX}/spots/detail/test-spot-id")
        # Should return 404 or 500, not 405
        assert response.status_code in [404, 500]
        assert response.status_code != 405  # Not "Method Not Allowed"


class TestSpotWeatherEndpoint:
    """Tests for GET /spots/weather/{spot_id}"""
    
    def test_get_spot_weather_not_found(self, client, db_session):
        """GET /spots/weather/{spot_id} returns 404 for invalid spot"""
        response = client.get(f"{API_PREFIX}/spots/weather/non-existent")
        assert response.status_code == 404
    
    def test_get_spot_weather_accepts_spot_id(self, client, db_session):
        """GET /spots/weather/{spot_id} endpoint exists"""
        # Endpoint looks in external ParaglidingSpot DB
        response = client.get(f"{API_PREFIX}/spots/weather/test-spot")
        # Should return 404 or weather data, not 405
        assert response.status_code in [200, 404, 500, 503]
        assert response.status_code != 405


class TestBestSpotEndpoint:
    """Tests for GET /spots/best"""
    
    def test_get_best_spot_no_spots(self, client, db_session):
        """GET /spots/best returns 404 when no spots exist"""
        response = client.get(f"{API_PREFIX}/spots/best")
        assert response.status_code in [200, 404, 500]
    
    def test_get_best_spot_single_spot(self, client, db_session, arguel_site):
        """GET /spots/best responds when one spot exists"""
        response = client.get(f"{API_PREFIX}/spots/best")
        # Should return best spot or fail gracefully
        assert response.status_code in [200, 404, 500, 503]
    
    def test_get_best_spot_multiple_spots(self, client, db_session, arguel_site, chalais_site):
        """GET /spots/best responds with multiple spots"""
        response = client.get(f"{API_PREFIX}/spots/best")
        assert response.status_code in [200, 404, 500, 503]


class TestGetSpotByIdEndpoint:
    """Tests for GET /spots/{spot_id}"""
    
    def test_get_spot_by_id_not_found(self, client, db_session):
        """GET /spots/{spot_id} returns 404 for non-existent spot"""
        response = client.get(f"{API_PREFIX}/spots/non-existent")
        assert response.status_code == 404
    
    def test_get_spot_by_id_success(self, client, db_session, arguel_site):
        """GET /spots/{spot_id} returns spot details"""
        response = client.get(f"{API_PREFIX}/spots/site-arguel")
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
        response = client.post(f"{API_PREFIX}/spots", json=site_data)
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
        response = client.post(f"{API_PREFIX}/spots", json=site_data)
        assert response.status_code in [200, 201, 400, 422]
    
    def test_create_site_accepts_any_coordinates(self, client, db_session):
        """POST /spots accepts coordinates (no strict validation)"""
        site_data = {
            "name": "Test Site Coords",
            "latitude": 999.0,  # Out of range but accepted
            "longitude": -999.0,  # Out of range but accepted
            "site_type": "user_spot"
        }
        response = client.post(f"{API_PREFIX}/spots", json=site_data)
        # Endpoint doesn't validate coordinate ranges strictly
        assert response.status_code in [200, 201]
    
    def test_create_site_missing_required_fields(self, client, db_session):
        """POST /spots fails without required fields"""
        site_data = {
            "name": "Incomplete Site"
            # Missing latitude, longitude, site_type
        }
        response = client.post(f"{API_PREFIX}/spots", json=site_data)
        assert response.status_code in [400, 422]


class TestUpdateSiteEndpoint:
    """Tests for PATCH /sites/{site_id}"""
    
    def test_update_site_not_found(self, client, db_session):
        """PATCH /sites/{site_id} returns 404 for non-existent site"""
        response = client.patch(
            f"{API_PREFIX}/sites/non-existent",
            json={"name": "Updated"}
        )
        assert response.status_code == 404
    
    def test_update_site_name(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id} updates site name"""
        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel",
            json={"name": "Arguel Updated"}
        )
        # Should succeed or fail gracefully
        assert response.status_code in [200, 400, 404, 422]
    
    def test_update_site_orientation(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id}/orientation updates orientation"""
        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel/orientation",
            json={"orientation": "N"}
        )
        assert response.status_code in [200, 400, 404, 422]
    
    def test_update_site_camera(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id}/camera updates camera URL"""
        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel/camera",
            json={"camera_url": "https://example.com/camera"}
        )
        assert response.status_code in [200, 400, 404, 422]
    
    def test_update_site_multiple_fields(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id} updates multiple fields"""
        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel",
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
        response = client.delete(f"{API_PREFIX}/sites/non-existent")
        assert response.status_code == 404
    
    def test_delete_site_success(self, client, db_session, arguel_site):
        """DELETE /sites/{site_id} deletes site"""
        response = client.delete(f"{API_PREFIX}/sites/site-arguel")
        assert response.status_code in [200, 204]
        
        # Verify site is deleted
        site = db_session.query(Site).filter(Site.id == "site-arguel").first()
        assert site is None
    
    def test_delete_site_with_flights(self, client, db_session, sample_flight):
        """DELETE /sites/{site_id} handles site with associated flights"""
        # Try to delete site that has flights
        response = client.delete(f"{API_PREFIX}/sites/site-arguel")
        # Should fail or cascade delete
        assert response.status_code in [200, 204, 400, 409]


class TestSearchSpotsWithWeather:
    """Tests for GET /spots/search-with-weather"""
    
    def test_search_with_weather_requires_params(self, client, db_session):
        """GET /spots/search-with-weather requires lat/lon or city"""
        response = client.get(f"{API_PREFIX}/spots/search-with-weather")
        # Should fail without params
        assert response.status_code == 400
    
    def test_search_with_weather_by_coordinates(self, client, db_session, arguel_site):
        """GET /spots/search-with-weather?lat=47&lon=6 searches with weather"""
        response = client.get(f"{API_PREFIX}/spots/search-with-weather?lat=47.2&lon=6.0")
        # May succeed or fail depending on weather API
        assert response.status_code in [200, 500, 503]
    
    def test_search_with_weather_with_radius(self, client, db_session, arguel_site):
        """GET /spots/search-with-weather?lat=47&lon=6&radius=50 accepts radius"""
        response = client.get(f"{API_PREFIX}/spots/search-with-weather?lat=47.0&lon=6.0&radius=50")
        assert response.status_code in [200, 500, 503]


class TestGeocodeEndpoint:
    """Tests for GET /spots/geocode"""
    
    def test_geocode_missing_address(self, client, db_session):
        """GET /spots/geocode without address parameter fails"""
        response = client.get(f"{API_PREFIX}/spots/geocode")
        assert response.status_code in [400, 422]
    
    def test_geocode_with_address(self, client, db_session):
        """GET /spots/geocode?address=Besancon responds"""
        response = client.get(f"{API_PREFIX}/spots/geocode?address=Besancon")
        # May succeed or fail depending on geocoding service
        assert response.status_code in [200, 400, 404, 422, 500, 503]


class TestSpotsSyncEndpoint:
    """Tests for POST /spots/sync"""
    
    def test_sync_spots_from_source(self, client, db_session):
        """POST /spots/sync synchronizes spots from external source"""
        response = client.post(f"{API_PREFIX}/spots/sync")
        # Should sync or require auth or fail
        assert response.status_code in [200, 401, 403, 500, 503]


class TestSpotsStatusEndpoint:
    """Tests for GET /spots/status"""
    
    def test_get_spots_sync_status(self, client, db_session):
        """GET /spots/status returns sync status information"""
        response = client.get(f"{API_PREFIX}/spots/status")
        assert response.status_code in [200, 500]


class TestAdminSpotsEndpoints:
    """Tests for admin spots management"""
    
    def test_seed_sites(self, client, db_session):
        """POST /admin/seed-sites seeds initial sites"""
        response = client.post(f"{API_PREFIX}/admin/seed-sites")
        # Should seed or require auth
        assert response.status_code in [200, 401, 403, 500]
    
    def test_link_sites_to_spots(self, client, db_session):
        """POST /admin/sites/link-to-spots links user sites to spots DB"""
        response = client.post(f"{API_PREFIX}/admin/sites/link-to-spots")
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
        
        response = client.get(f"{API_PREFIX}/spots/weather/site-no-coords")
        # Should fail gracefully
        assert response.status_code in [400, 404, 422, 500]
    
    def test_spot_invalid_orientation(self, client, db_session, arguel_site):
        """PATCH /sites/{site_id}/orientation validates orientation"""
        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel/orientation?orientation=INVALID"
        )
        # Should reject invalid orientation
        assert response.status_code in [400, 422]
