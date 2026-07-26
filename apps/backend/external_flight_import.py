import hashlib
import logging
import re
import uuid
from collections.abc import Callable
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from flight_storage import ensure_flight_directory
from flight_tracks import TrackPoint, calculate_track_stats, normalize_track
from intervals_icu import ExternalActivity, IntervalsError
from models import Flight, Site
from spots.distance import haversine_distance

logger = logging.getLogger(__name__)
PARIS_TIME_ZONE = ZoneInfo("Europe/Paris")


class ActivityFileProvider(Protocol):
    async def download_original(self, activity_id: str) -> bytes: ...


def match_site(db: Session, point: TrackPoint, max_distance_km: float = 5.0) -> str | None:
    closest: tuple[float, str] | None = None
    for site in db.query(Site).all():
        if site.latitude is None or site.longitude is None:
            continue
        distance = haversine_distance(point["lat"], point["lon"], site.latitude, site.longitude)
        if closest is None or distance < closest[0]:
            closest = distance, site.id
    return closest[1] if closest and closest[0] <= max_distance_km else None


def _safe_activity_id(activity_id: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", activity_id).strip("_")[:48] or "activity"
    digest = hashlib.sha256(activity_id.encode()).hexdigest()[:12]
    return f"{stem}_{digest}"


def _flight_summary(flight: Flight) -> dict[str, str | date]:
    return {
        "id": flight.id,
        "external_provider": str(flight.external_provider),
        "external_activity_id": str(flight.external_activity_id),
        "name": flight.name or flight.title or "Flight",
        "date": flight.flight_date,
    }


def _local_departure(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(PARIS_TIME_ZONE).replace(tzinfo=None)


def _legacy_track_matches(
    candidate: Flight, points: list[TrackPoint], stats: dict[str, Any]
) -> bool:
    if not candidate.gpx_file_path:
        return False
    try:
        _, legacy_points = normalize_track(Path(candidate.gpx_file_path).read_bytes(), "gpx")
    except (OSError, ValueError):
        return False
    if (
        haversine_distance(
            legacy_points[0]["lat"],
            legacy_points[0]["lon"],
            points[0]["lat"],
            points[0]["lon"],
        )
        > 1
    ):
        return False
    duration = int(stats["duration_minutes"])
    if candidate.duration_minutes and duration:
        if abs(candidate.duration_minutes - duration) > max(5, round(duration * 0.15)):
            return False
    distance = float(stats["distance_km"])
    if candidate.distance_km and distance:
        if abs(candidate.distance_km - distance) > max(1, distance * 0.2):
            return False
    return True


def _find_legacy_flight(
    db: Session,
    activity: ExternalActivity,
    points: list[TrackPoint],
    stats: dict[str, Any],
) -> Flight | None:
    """Reconcile one legacy flight only when time and track characteristics agree."""
    departure = _local_departure(activity.start_date)
    candidates = (
        db.query(Flight)
        .filter(
            Flight.external_provider == "strava",
            Flight.departure_time >= departure - timedelta(minutes=2),
            Flight.departure_time <= departure + timedelta(minutes=2),
        )
        .all()
    )
    matches = [
        candidate for candidate in candidates if _legacy_track_matches(candidate, points, stats)
    ]
    return matches[0] if len(matches) == 1 else None


async def import_external_activities(
    db: Session,
    provider_name: str,
    provider: ActivityFileProvider,
    activities: list[ExternalActivity],
    *,
    should_stop: Callable[[], bool] | None = None,
) -> dict[str, object]:
    imported = updated = skipped = failed = 0
    summaries: list[dict[str, str | date]] = []

    for activity in sorted(activities, key=lambda item: (item.start_date, item.id)):
        if should_stop and should_stop():
            raise RuntimeError("Intervals.icu synchronization lost its distributed lock")
        written_path: Path | None = None
        temporary_path: Path | None = None
        try:
            existing = (
                db.query(Flight)
                .filter(
                    Flight.external_provider == provider_name,
                    Flight.external_activity_id == activity.id,
                )
                .first()
            )
            if existing:
                summaries.append(_flight_summary(existing))
                skipped += 1
                db.rollback()
                continue
            db.rollback()

            original = await provider.download_original(activity.id)
            gpx, points = normalize_track(original, activity.file_type)
            stats = calculate_track_stats(points)

            outcome: str
            pending_summary: dict[str, str | date]
            with db.begin():
                # Recheck under the write transaction in case another importer won the race.
                existing = (
                    db.query(Flight)
                    .filter(
                        Flight.external_provider == provider_name,
                        Flight.external_activity_id == activity.id,
                    )
                    .first()
                )
                if existing:
                    outcome = "skipped"
                    pending_summary = _flight_summary(existing)
                else:
                    legacy = _find_legacy_flight(db, activity, points, stats)
                    if legacy:
                        legacy.external_provider = provider_name
                        legacy.external_activity_id = activity.id
                        legacy.external_url = activity.external_url
                        db.flush()
                        outcome = "skipped"
                        pending_summary = _flight_summary(legacy)
                    else:
                        flight = Flight(id=str(uuid.uuid4()))
                        db.add(flight)

                        departure = _local_departure(stats["departure_time"] or activity.start_date)
                        flight.external_provider = provider_name
                        flight.external_activity_id = activity.id
                        flight.external_url = activity.external_url
                        flight.name = activity.name
                        flight.title = activity.name
                        flight.flight_date = departure.date()
                        flight.departure_time = departure
                        flight.site_id = match_site(db, points[0])
                        flight.duration_minutes = int(stats["duration_minutes"])
                        flight.max_altitude_m = int(stats["max_altitude_m"])
                        flight.max_speed_kmh = float(stats["max_speed_kmh"])
                        flight.distance_km = float(stats["distance_km"])
                        flight.elevation_gain_m = int(stats["elevation_gain_m"])
                        flight.gpx_max_altitude_m = flight.max_altitude_m
                        flight.gpx_elevation_gain_m = flight.elevation_gain_m
                        db.flush()

                        filename = f"intervals_{_safe_activity_id(activity.id)}.gpx"
                        written_path = ensure_flight_directory(db, flight) / filename
                        temporary_path = written_path.with_name(
                            f".{written_path.name}.{uuid.uuid4()}.tmp"
                        )
                        temporary_path.write_bytes(gpx)
                        temporary_path.replace(written_path)
                        flight.gpx_file_path = str(written_path)
                        db.flush()
                        outcome = "imported"
                        pending_summary = _flight_summary(flight)

            summaries.append(pending_summary)
            if outcome == "imported":
                imported += 1
            else:
                skipped += 1
        except ValueError as exc:
            db.rollback()
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
            if written_path is not None:
                written_path.unlink(missing_ok=True)
            skipped += 1
            logger.warning("Skipping %s activity %s: %s", provider_name, activity.id, exc)
        except IntervalsError:
            db.rollback()
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
            if written_path is not None:
                written_path.unlink(missing_ok=True)
            raise
        except Exception:
            db.rollback()
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
            if written_path is not None:
                written_path.unlink(missing_ok=True)
            failed += 1
            logger.exception("Failed to import %s activity %s", provider_name, activity.id)

    return {
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "flights": summaries,
    }
