"""
Test database models and schemas
"""

from datetime import date, datetime, timedelta

import pytest

from models import Flight, Site, WeatherForecast


class TestSiteModel:
    """Test Site model"""

    def test_create_site(self, db_session):
        """Create a site"""
        site = Site(
            id="site-arguel",
            code="ARG",
            name="Arguel",
            latitude=47.2,
            longitude=6.0,
            elevation_m=427,
            region="Doubs",
        )
        db_session.add(site)
        db_session.commit()

        retrieved = db_session.query(Site).filter_by(id="site-arguel").first()
        assert retrieved is not None
        assert retrieved.name == "Arguel"
        assert retrieved.latitude == 47.2
        assert retrieved.elevation_m == 427

    def test_site_unique_code(self, db_session):
        """Site codes must be unique"""
        site1 = Site(id="site-1", code="ABC", name="Site 1", latitude=1, longitude=1)
        site2 = Site(id="site-2", code="ABC", name="Site 2", latitude=2, longitude=2)
        db_session.add(site1)
        db_session.commit()

        db_session.add(site2)
        with pytest.raises(Exception):  # Should fail with unique constraint
            db_session.commit()

    def test_site_timestamps(self, db_session):
        """Sites should have creation and update timestamps"""
        site = Site(id="site-test", code="TEST", name="Test", latitude=1, longitude=1)
        db_session.add(site)
        db_session.commit()

        retrieved = db_session.query(Site).filter_by(id="site-test").first()
        assert retrieved.created_at is not None
        assert retrieved.updated_at is not None


class TestFlightModel:
    """Test Flight model"""

    def test_create_flight(self, db_session):
        """Create a flight"""
        now = datetime.now()
        flight = Flight(
            id="flight-001",
            name="Arguel 01-03 10h30",
            flight_date=now.date(),
            departure_time=now,
            duration_minutes=60,
            distance_km=15.5,
            max_altitude_m=1800,
            max_speed_kmh=45.2,
        )
        db_session.add(flight)
        db_session.commit()

        retrieved = db_session.query(Flight).filter_by(id="flight-001").first()
        assert retrieved is not None
        assert retrieved.distance_km == 15.5
        assert retrieved.duration_minutes == 60
        assert retrieved.max_speed_kmh == 45.2

    def test_flight_with_site(self, db_session):
        """Flight can reference a site"""
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

        flight = Flight(
            id="flight-002",
            name="Arguel 01-03 10h30",
            site_id="site-arguel",
            flight_date=datetime.now().date(),
            departure_time=datetime.now(),
            duration_minutes=90,
            distance_km=20,
            max_altitude_m=2000,
        )
        db_session.add(flight)
        db_session.commit()

        retrieved = db_session.query(Flight).filter_by(id="flight-002").first()
        assert retrieved.site_id == "site-arguel"
        assert retrieved.site.name == "Arguel"

    def test_flight_with_strava_id(self, db_session):
        """Flights can have Strava IDs (unique)"""
        flight = Flight(
            id="flight-003",
            strava_id="123456789",
            name="Arguel 01-03 10h30",
            flight_date=datetime.now().date(),
            departure_time=datetime.now(),
            duration_minutes=60,
            distance_km=10,
        )
        db_session.add(flight)
        db_session.commit()

        retrieved = db_session.query(Flight).filter_by(strava_id="123456789").first()
        assert retrieved is not None
        assert retrieved.id == "flight-003"

    def test_flight_ordering(self, db_session):
        """Flights should be ordered by date (newest first)"""
        base_date = date.today()

        # Add flights in non-chronological order
        for i in [2, 0, 1]:
            flight = Flight(
                id=f"flight-{i}",
                name=f"Flight {i}",
                flight_date=base_date - timedelta(days=i),
                departure_time=datetime.now(),
                duration_minutes=60,
                distance_km=10,
            )
            db_session.add(flight)
        db_session.commit()

        flights = db_session.query(Flight).order_by(Flight.flight_date.desc()).all()
        assert flights[0].id == "flight-0"  # Most recent
        assert flights[1].id == "flight-1"
        assert flights[2].id == "flight-2"  # Oldest


class TestWeatherForecastModel:
    """Test WeatherForecast model"""

    def test_create_forecast(self, db_session):
        """Create a weather forecast"""
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

        forecast = WeatherForecast(
            id="forecast-001",
            site_id="site-arguel",
            forecast_date=date.today(),
            para_index=75,
            wind_avg_kmh=10,
            wind_max_kmh=15,
            temperature_avg_c=18,
            temperature_min_c=15,
            temperature_max_c=21,
            cloud_cover_percent=30,
            verdict="BON",
            source="open-meteo",
        )
        db_session.add(forecast)
        db_session.commit()

        retrieved = db_session.query(WeatherForecast).filter_by(id="forecast-001").first()
        assert retrieved is not None
        assert retrieved.para_index == 75
        assert retrieved.verdict == "BON"
        assert retrieved.source == "open-meteo"
        assert retrieved.site.name == "Arguel"

    def test_forecast_verdict_values(self, db_session):
        """Forecasts can have different verdict values"""
        site = Site(id="site-test", code="TEST", name="Test", latitude=1, longitude=1)
        db_session.add(site)
        db_session.commit()

        verdicts = ["BON", "MOYEN", "LIMITE", "MAUVAIS"]
        for i, verdict in enumerate(verdicts):
            forecast = WeatherForecast(
                id=f"forecast-{i}",
                site_id="site-test",
                forecast_date=date.today(),
                para_index=i * 25,
                verdict=verdict,
                source="open-meteo",
            )
            db_session.add(forecast)
        db_session.commit()

        for i, verdict in enumerate(verdicts):
            retrieved = db_session.query(WeatherForecast).filter_by(id=f"forecast-{i}").first()
            assert retrieved.verdict == verdict
