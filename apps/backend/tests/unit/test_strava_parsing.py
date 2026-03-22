"""
Unit tests for strava.py - GPX parsing and Strava integration

Tests GPX file parsing logic:
- Valid GPX files
- Invalid/malformed GPX
- Missing elevation data
- Missing timestamps
- Coordinate extraction
- Statistics calculation (max altitude, elevation gain)
"""

from datetime import datetime

import pytest

from strava import parse_gpx


@pytest.mark.unit
class TestParseGPX:
    """Test GPX parsing function"""

    def test_parse_valid_gpx(self, sample_gpx):
        """Parse valid GPX file from fixtures"""
        result = parse_gpx(sample_gpx)

        assert result["success"] is True
        assert "coordinates" in result
        assert "elevations" in result
        assert "max_altitude_m" in result
        assert "elevation_gain_m" in result

        # Should have multiple trackpoints
        assert len(result["coordinates"]) > 0
        assert len(result["elevations"]) > 0

        # Max altitude should be positive
        assert result["max_altitude_m"] > 0

    def test_parse_gpx_coordinates(self, sample_gpx):
        """Extract coordinates correctly"""
        result = parse_gpx(sample_gpx)

        assert result["success"] is True
        coords = result["coordinates"]

        # Each coordinate should have lat/lon
        for coord in coords:
            assert "lat" in coord
            assert "lon" in coord
            assert isinstance(coord["lat"], float)
            assert isinstance(coord["lon"], float)

            # Reasonable latitude/longitude ranges
            assert -90 <= coord["lat"] <= 90
            assert -180 <= coord["lon"] <= 180

    def test_parse_gpx_elevations(self, sample_gpx):
        """Extract elevations correctly"""
        result = parse_gpx(sample_gpx)

        assert result["success"] is True
        elevations = result["elevations"]

        # Should have elevations
        assert len(elevations) > 0

        # All elevations should be numbers
        for ele in elevations:
            assert isinstance(ele, int | float)
            # Reasonable altitude range (not on moon!)
            assert -500 < ele < 10000

    def test_parse_gpx_max_altitude(self, sample_gpx):
        """Calculate max altitude correctly"""
        result = parse_gpx(sample_gpx)

        assert result["success"] is True

        # Max altitude should match maximum elevation
        max_from_elevations = max(result["elevations"])
        assert result["max_altitude_m"] == int(max_from_elevations)

    def test_parse_gpx_elevation_gain(self, sample_gpx):
        """Calculate elevation gain correctly"""
        result = parse_gpx(sample_gpx)

        assert result["success"] is True

        # Elevation gain should be non-negative
        assert result["elevation_gain_m"] >= 0

        # Sample Arguel GPX climbs from 427m to 1350m
        # So gain should be at least 900m
        assert result["elevation_gain_m"] > 800

    def test_parse_gpx_first_trackpoint(self, sample_gpx):
        """Extract first trackpoint data"""
        result = parse_gpx(sample_gpx)

        assert result["success"] is True

        # Should have first trackpoint info
        if "first_trackpoint" in result:
            first = result["first_trackpoint"]
            assert "lat" in first
            assert "lon" in first

        # Coordinates should match first point
        if result["coordinates"]:
            first_coord = result["coordinates"][0]
            assert first_coord["lat"] is not None
            assert first_coord["lon"] is not None

    def test_parse_gpx_departure_time(self, sample_gpx):
        """Extract departure time if present"""
        result = parse_gpx(sample_gpx)

        # Departure time is optional
        if "departure_time" in result and result["departure_time"]:
            assert isinstance(result["departure_time"], datetime)

    def test_parse_gpx_simple(self):
        """Parse minimal GPX"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1" creator="Test">
          <trk>
            <name>Test Track</name>
            <trkseg>
              <trkpt lat="47.2" lon="6.0">
                <ele>500</ele>
              </trkpt>
              <trkpt lat="47.3" lon="6.1">
                <ele>600</ele>
              </trkpt>
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        assert result["success"] is True
        assert len(result["coordinates"]) == 2
        assert result["max_altitude_m"] == 600
        assert result["elevation_gain_m"] == 100  # 500→600 = +100

    def test_parse_gpx_with_namespace(self):
        """Parse GPX with proper namespace"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <trk>
            <trkseg>
              <trkpt lat="47.0" lon="6.0">
                <ele>1000</ele>
              </trkpt>
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        assert result["success"] is True
        assert len(result["coordinates"]) == 1
        assert result["max_altitude_m"] == 1000

    def test_parse_gpx_invalid_xml(self):
        """Invalid XML → error"""
        gpx = "<invalid>not xml"

        result = parse_gpx(gpx)

        # Should handle error gracefully
        assert result.get("success") is False or "error" in result

    def test_parse_gpx_no_trackpoints(self):
        """GPX with no trackpoints → error"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1">
          <trk>
            <name>Empty Track</name>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        # Should fail gracefully
        assert result.get("success") is False or "error" in result

    def test_parse_gpx_no_elevation(self):
        """GPX without elevation data"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1">
          <trk>
            <trkseg>
              <trkpt lat="47.0" lon="6.0"></trkpt>
              <trkpt lat="47.1" lon="6.1"></trkpt>
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        # Should handle missing elevation (may default to 0 or fail)
        if result.get("success"):
            # If it succeeds, elevations should be 0 or present
            assert "elevations" in result
        else:
            # Or it may fail - both are acceptable
            assert "error" in result

    def test_parse_gpx_descent_only(self):
        """GPX with only descent (negative gain)"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1">
          <trk>
            <trkseg>
              <trkpt lat="47.0" lon="6.0">
                <ele>1000</ele>
              </trkpt>
              <trkpt lat="47.1" lon="6.1">
                <ele>900</ele>
              </trkpt>
              <trkpt lat="47.2" lon="6.2">
                <ele>800</ele>
              </trkpt>
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        assert result["success"] is True
        # Descent only → elevation gain = 0
        assert result["elevation_gain_m"] == 0
        assert result["max_altitude_m"] == 1000

    def test_parse_gpx_up_and_down(self):
        """GPX with ups and downs"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1">
          <trk>
            <trkseg>
              <trkpt lat="47.0" lon="6.0"><ele>500</ele></trkpt>
              <trkpt lat="47.1" lon="6.1"><ele>600</ele></trkpt>
              <trkpt lat="47.2" lon="6.2"><ele>550</ele></trkpt>
              <trkpt lat="47.3" lon="6.3"><ele>650</ele></trkpt>
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        assert result["success"] is True
        # Gains: +100 (500→600), +100 (550→650) = 200
        assert result["elevation_gain_m"] == 200
        assert result["max_altitude_m"] == 650


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_parse_gpx_empty_string(self):
        """Empty GPX string"""
        result = parse_gpx("")

        # Should fail gracefully
        assert result.get("success") is False or "error" in result

    def test_parse_gpx_whitespace_only(self):
        """Whitespace only"""
        result = parse_gpx("   \n   ")

        assert result.get("success") is False or "error" in result

    def test_parse_gpx_single_trackpoint(self):
        """GPX with only one trackpoint"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1">
          <trk>
            <trkseg>
              <trkpt lat="47.0" lon="6.0">
                <ele>500</ele>
              </trkpt>
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        # Single point is valid (though not very useful)
        assert result.get("success") is True
        assert len(result["coordinates"]) == 1
        assert result["elevation_gain_m"] == 0  # No gain with 1 point

    def test_parse_gpx_very_large_file(self):
        """GPX with many trackpoints"""
        # Generate GPX with 1000 points
        points = "\n".join(
            [
                f'<trkpt lat="{47 + i*0.001}" lon="{6 + i*0.001}"><ele>{500 + i}</ele></trkpt>'
                for i in range(1000)
            ]
        )

        gpx = f"""<?xml version="1.0"?>
        <gpx version="1.1">
          <trk>
            <trkseg>
              {points}
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        assert result["success"] is True
        assert len(result["coordinates"]) == 1000
        assert result["elevation_gain_m"] == 999  # 500→1499 = +999

    def test_parse_gpx_negative_elevations(self):
        """GPX with negative elevations (below sea level)"""
        gpx = """<?xml version="1.0"?>
        <gpx version="1.1">
          <trk>
            <trkseg>
              <trkpt lat="47.0" lon="6.0"><ele>-50</ele></trkpt>
              <trkpt lat="47.1" lon="6.1"><ele>100</ele></trkpt>
            </trkseg>
          </trk>
        </gpx>"""

        result = parse_gpx(gpx)

        assert result["success"] is True
        assert result["max_altitude_m"] == 100
        assert result["elevation_gain_m"] == 150  # -50→100 = +150
