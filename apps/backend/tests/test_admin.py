"""
Test admin endpoints
"""
import pytest
from models import EmagramAnalysis
from datetime import datetime


class TestAdminEndpoints:
    """Test /api/admin endpoints"""
    
    def test_clear_cache_empty_db(self, client, db_session):
        """Clear emagram cache when DB is empty"""
        response = client.post("/api/admin/clear-emagram-cache")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["database_deleted"] == 0
        assert "redis_cleared" in data
    
    def test_clear_cache_with_analyses(self, client, db_session):
        """Clear emagram cache with existing analyses"""
        # Add sample emagram analyses
        for i in range(3):
            analysis = EmagramAnalysis(
                id=f"test-analysis-{i}",
                station_code=f"site-{i}",
                station_name=f"Test Site {i}",
                station_latitude=47.0 + i * 0.1,
                station_longitude=6.0 + i * 0.1,
                analysis_date=datetime.now().date(),
                analysis_time=datetime.now().time(),
                analysis_datetime=datetime.now(),  # Required field
                distance_km=0.0,  # Required field
                data_source="wyoming",  # Required field
                sounding_time="12Z",  # Required field
                analysis_method="test",  # Required field
                plafond_thermique_m=3000,
                force_thermique_ms=2.0,
                score_volabilite=75,
                conseils_vol="Test advice",
                analysis_status="completed"
            )
            db_session.add(analysis)
        db_session.commit()
        
        # Verify analyses exist
        count_before = db_session.query(EmagramAnalysis).count()
        assert count_before == 3
        
        # Clear emagram cache (database + Redis)
        response = client.post("/api/admin/clear-emagram-cache")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["database_deleted"] == 3
        
        # Verify analyses deleted
        count_after = db_session.query(EmagramAnalysis).count()
        assert count_after == 0
    
    def test_debug_gemini_no_api_key(self, client):
        """Debug Gemini when API key is not set or package not installed"""
        # Test by temporarily removing the API key from config
        import config
        from unittest.mock import patch
        
        # Save original value
        original_key = config.GOOGLE_API_KEY
        
        try:
            # Temporarily set to None
            config.GOOGLE_API_KEY = None
            
            response = client.get("/api/admin/debug/gemini")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            # Could fail due to missing package OR missing API key
            assert ("GOOGLE_API_KEY not set" in data["error"] or 
                    "BACKEND_GOOGLE_API_KEY not set" in data["error"] or
                    "package not installed" in data["error"])
        finally:
            # Restore original value
            config.GOOGLE_API_KEY = original_key
    
    @pytest.mark.integration
    def test_debug_gemini_with_api_key(self, client):
        """Debug Gemini with API key (integration test)"""
        # This test requires a real API key
        import os
        api_key = os.getenv("BACKEND_GOOGLE_API_KEY")
        if not api_key:
            pytest.skip("BACKEND_GOOGLE_API_KEY not set")
        
        # No patching needed - use the real config values loaded from env
        response = client.get("/api/admin/debug/gemini")
        assert response.status_code == 200
        data = response.json()
        
        # Should succeed with valid API key
        if data["success"]:
            assert "api_key_set" in data
            assert data["api_key_set"] is True
            assert "model_name" in data
        else:
            # May fail due to quota or other API issues
            assert "error" in data
