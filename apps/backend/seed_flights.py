#!/usr/bin/env python3
"""
Seed the database with sample flights for testing
Creates realistic flight data with GPX files
"""

import random
import subprocess
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal
from flight_storage import flight_directory
from models import Flight, Site

SAMPLE_FLIGHT_TITLES = {
    "Vol d'initiation Arguel",
    "Cross-country Mont Poupet",
    "Vol thermique La Côte",
    "Soaring Arguel",
    "Vol du soir Mont Poupet",
}


def create_sample_video(video_path: Path, color: str, start_time: datetime) -> None:
    """Create a tiny valid MP4 that is suitable for staging smoke tests."""
    video_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"color=c={color}:s=640x360:r=30",
            "-t",
            "1",
            "-an",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-metadata",
            f"creation_time={start_time.isoformat(timespec='seconds')}Z",
            "-y",
            str(video_path),
        ],
        check=True,
    )


def ensure_sample_media(db: Session, flights: list[Flight]) -> int:
    """Create the camera, pano, and overlay files used by staging fixtures."""
    created_count = 0
    colors = ("0x24527a", "0x6b4f8a", "0x39734a", "0x8a633b", "0x7a3f54")

    for index, flight in enumerate(flights):
        directory = flight_directory(db, flight)
        for filename in ("flight.mp4", "camera.mp4", "pano.mp4", "final.mp4"):
            path = directory / filename
            # These are disposable staging fixtures. Recreate them on every
            # startup so persistent volumes pick up metadata changes too.
            video_start = flight.created_at - timedelta(minutes=flight.duration_minutes)
            create_sample_video(path, colors[index % len(colors)], video_start)
            created_count += 1

        video_path = (directory / "flight.mp4").resolve()
        pano_path = (directory / "pano.mp4").resolve()
        overlay_path = (directory / "final.mp4").resolve()
        flight.video_file_path = str(video_path)
        flight.video_export_status = "completed"
        flight.pano_video_file_path = str(pano_path)
        flight.gopro_overlay_file_path = str(overlay_path)
        flight.gopro_overlay_status = "completed"

    return created_count


def is_sample_flight(flight: Flight) -> bool:
    """Identify flights created by this seed without touching imported flights."""
    return flight.title in SAMPLE_FLIGHT_TITLES and (flight.notes or "").startswith(
        "Sample flight created for testing."
    )


def create_sample_gpx(
    flight_id: str, start_lat: float, start_lon: float, duration_min: int
) -> Path:
    """
    Create a sample GPX file for testing
    Generates a realistic flight track with elevation changes
    """
    gpx_dir = Path(__file__).parent / "gpx_files"
    gpx_dir.mkdir(exist_ok=True)

    gpx_path = gpx_dir / f"flight_{flight_id}.gpx"

    # Generate track points (one every 10 seconds)
    num_points = (duration_min * 60) // 10

    gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Dashboard Parapente" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Sample Flight</name>
    <time>{timestamp}</time>
  </metadata>
  <trk>
    <name>Flight Track</name>
    <trkseg>
""".format(timestamp=datetime.utcnow().isoformat() + "Z")

    base_time = datetime.utcnow() - timedelta(minutes=duration_min)
    lat, lon = start_lat, start_lon
    elevation = 800  # Start at 800m
    max_elevation = 800

    for i in range(num_points):
        # Simulate circular flight pattern with some drift
        (i / num_points) * 2 * 3.14159 * 2  # 2 circles
        lat = start_lat + 0.01 * (i / num_points) + 0.005 * random.uniform(-1, 1)
        lon = start_lon + 0.01 * (i / num_points) + 0.005 * random.uniform(-1, 1)

        # Elevation changes - climb first, then descend
        if i < num_points * 0.3:
            elevation += random.uniform(5, 15)  # Climbing
        elif i < num_points * 0.8:
            elevation += random.uniform(-3, 3)  # Maintaining
        else:
            elevation -= random.uniform(5, 15)  # Descending

        elevation = max(500, min(1800, elevation))  # Clamp between 500-1800m
        max_elevation = max(max_elevation, elevation)

        point_time = base_time + timedelta(seconds=i * 10)

        gpx_content += f"""      <trkpt lat="{lat:.6f}" lon="{lon:.6f}">
        <ele>{elevation:.1f}</ele>
        <time>{point_time.isoformat()}Z</time>
      </trkpt>
"""

    gpx_content += """    </trkseg>
  </trk>
</gpx>"""

    gpx_path.write_text(gpx_content)

    return gpx_path


def seed_flights(force: bool = False, include_media: bool = False) -> int:
    """Seed an empty database with sample flights and return the count created."""
    db = SessionLocal()

    try:
        # Get existing sites
        sites = db.query(Site).all()
        if not sites:
            return 0

        # Check if flights already exist
        existing_flights = db.query(Flight).count()
        if existing_flights > 0 and not force:
            if include_media:
                sample_flights = [
                    flight for flight in db.query(Flight).all() if is_sample_flight(flight)
                ]
                ensure_sample_media(db, sample_flights)
                db.commit()
            return 0
        if existing_flights > 0:
            response = input("Delete and recreate? (y/N): ")
            if response.lower() != "y":
                return 0
            # Delete existing flights
            db.query(Flight).delete()
            db.commit()

        # Create sample flights
        flights_to_create = [
            {
                "title": "Vol d'initiation Arguel",
                "days_ago": 7,
                "duration": 45,
                "site": sites[0] if sites else None,
                "distance": 3.2,
                "max_alt": 950,
            },
            {
                "title": "Cross-country Mont Poupet",
                "days_ago": 5,
                "duration": 120,
                "site": sites[1] if len(sites) > 1 else sites[0],
                "distance": 18.5,
                "max_alt": 1420,
            },
            {
                "title": "Vol thermique La Côte",
                "days_ago": 3,
                "duration": 90,
                "site": sites[2] if len(sites) > 2 else sites[0],
                "distance": 12.3,
                "max_alt": 1350,
            },
            {
                "title": "Soaring Arguel",
                "days_ago": 2,
                "duration": 65,
                "site": sites[0] if sites else None,
                "distance": 8.7,
                "max_alt": 1120,
            },
            {
                "title": "Vol du soir Mont Poupet",
                "days_ago": 1,
                "duration": 50,
                "site": sites[1] if len(sites) > 1 else sites[0],
                "distance": 5.4,
                "max_alt": 1050,
            },
        ]

        created_count = 0

        for flight_data in flights_to_create:
            flight_id = str(uuid.uuid4())
            flight_date = date.today() - timedelta(days=flight_data["days_ago"])
            site = flight_data["site"]

            if not site:
                continue

            # Create GPX file
            gpx_path = create_sample_gpx(
                flight_id, site.latitude, site.longitude, flight_data["duration"]
            )

            # Calculate elevation gain (rough estimate)
            elevation_gain = int((flight_data["max_alt"] - site.elevation_m) * 0.7)

            flight = Flight(
                id=flight_id,
                title=flight_data["title"],
                site_id=site.id,
                flight_date=flight_date,
                duration_minutes=flight_data["duration"],
                distance_km=flight_data["distance"],
                max_altitude_m=flight_data["max_alt"],
                elevation_gain_m=elevation_gain,
                max_speed_kmh=random.uniform(25, 45),
                gpx_file_path=str(gpx_path),
                notes=f"Sample flight created for testing. Site: {site.name}",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            db.add(flight)
            created_count += 1

        db.flush()
        if include_media:
            ensure_sample_media(db, list(db.query(Flight).all()))
        db.commit()
        return created_count

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_flights()
