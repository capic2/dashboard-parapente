"""
API tests for /sites/{site_id}/landings endpoints

Tests CRUD operations for landing associations.
"""

API_PREFIX = "/api"


class TestGetLandingAssociations:
    """Tests for GET /sites/{site_id}/landings"""

    def test_empty_list(self, client, db_session, arguel_site):
        """Returns empty list when no associations exist"""
        response = client.get(f"{API_PREFIX}/sites/site-arguel/landings")
        assert response.status_code == 200
        assert response.json() == []

    def test_returns_associations_with_landing_site(
        self, client, db_session, arguel_site, landing_site
    ):
        """Returns associations with nested landing site details"""
        # Create association via API
        client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel"},
        )

        response = client.get(f"{API_PREFIX}/sites/site-arguel/landings")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["landing_site_id"] == "site-plaine-arguel"
        assert data[0]["landing_site"]["name"] == "Plaine d'Arguel"
        assert data[0]["distance_km"] is not None

    def test_site_not_found(self, client, db_session):
        """Returns 404 for non-existent site"""
        response = client.get(f"{API_PREFIX}/sites/nonexistent/landings")
        assert response.status_code == 404


class TestCreateLandingAssociation:
    """Tests for POST /sites/{site_id}/landings"""

    def test_create_association(self, client, db_session, arguel_site, landing_site):
        """Creates association with auto-calculated distance"""
        response = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["takeoff_site_id"] == "site-arguel"
        assert data["landing_site_id"] == "site-plaine-arguel"
        assert data["distance_km"] > 0
        assert data["is_primary"] is False
        assert data["landing_site"]["name"] == "Plaine d'Arguel"

    def test_create_with_primary(self, client, db_session, arguel_site, landing_site):
        """Creates primary association"""
        response = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel", "is_primary": True},
        )
        assert response.status_code == 201
        assert response.json()["is_primary"] is True

    def test_create_with_notes(self, client, db_session, arguel_site, landing_site):
        """Creates association with notes"""
        response = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={
                "landing_site_id": "site-plaine-arguel",
                "notes": "Si vent fort du nord",
            },
        )
        assert response.status_code == 201
        assert response.json()["notes"] == "Si vent fort du nord"

    def test_duplicate_returns_409(self, client, db_session, arguel_site, landing_site):
        """Duplicate association returns 409"""
        client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel"},
        )
        response = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel"},
        )
        assert response.status_code == 409

    def test_self_association_returns_400(self, client, db_session, arguel_site):
        """Self-association returns 400"""
        response = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-arguel"},
        )
        assert response.status_code == 400

    def test_nonexistent_landing_returns_404(self, client, db_session, arguel_site):
        """Non-existent landing site returns 404"""
        response = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "nonexistent"},
        )
        assert response.status_code == 404

    def test_nonexistent_takeoff_returns_404(self, client, db_session):
        """Non-existent takeoff site returns 404"""
        response = client.post(
            f"{API_PREFIX}/sites/nonexistent/landings",
            json={"landing_site_id": "site-plaine-arguel"},
        )
        assert response.status_code == 404


class TestUpdateLandingAssociation:
    """Tests for PATCH /sites/{site_id}/landings/{assoc_id}"""

    def test_update_primary(self, client, db_session, arguel_site, landing_site, chalais_site):
        """Setting primary unsets previous primary"""
        # Create two associations
        client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel", "is_primary": True},
        )
        r2 = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-chalais"},
        )
        assoc2_id = r2.json()["id"]

        # Set second as primary
        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel/landings/{assoc2_id}",
            json={"is_primary": True},
        )
        assert response.status_code == 200
        assert response.json()["is_primary"] is True

        # Verify first is no longer primary
        landings = client.get(f"{API_PREFIX}/sites/site-arguel/landings").json()
        primaries = [a for a in landings if a["is_primary"]]
        assert len(primaries) == 1
        assert primaries[0]["id"] == assoc2_id

    def test_update_notes(self, client, db_session, arguel_site, landing_site):
        """Can update notes"""
        r = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel"},
        )
        assoc_id = r.json()["id"]

        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel/landings/{assoc_id}",
            json={"notes": "Updated notes"},
        )
        assert response.status_code == 200
        assert response.json()["notes"] == "Updated notes"

    def test_not_found(self, client, db_session, arguel_site):
        """Returns 404 for non-existent association"""
        response = client.patch(
            f"{API_PREFIX}/sites/site-arguel/landings/nonexistent",
            json={"is_primary": True},
        )
        assert response.status_code == 404


class TestDeleteLandingAssociation:
    """Tests for DELETE /sites/{site_id}/landings/{assoc_id}"""

    def test_delete_association(self, client, db_session, arguel_site, landing_site):
        """Deletes association"""
        r = client.post(
            f"{API_PREFIX}/sites/site-arguel/landings",
            json={"landing_site_id": "site-plaine-arguel"},
        )
        assoc_id = r.json()["id"]

        response = client.delete(f"{API_PREFIX}/sites/site-arguel/landings/{assoc_id}")
        assert response.status_code == 200

        # Verify deleted
        landings = client.get(f"{API_PREFIX}/sites/site-arguel/landings").json()
        assert len(landings) == 0

    def test_delete_not_found(self, client, db_session, arguel_site):
        """Returns 404 for non-existent association"""
        response = client.delete(f"{API_PREFIX}/sites/site-arguel/landings/nonexistent")
        assert response.status_code == 404
