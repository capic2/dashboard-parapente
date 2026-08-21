import base64
import hashlib
import hmac
import json
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import String, and_, cast, exists, func, or_, select
from sqlalchemy.orm import Query, Session, aliased
from sqlalchemy.sql.elements import ColumnElement

import config
from models import Flight, GoproOverlayJob, Site, YoutubeUploadJob
from schemas import FlightSummariesResponse, FlightSummary, youtube_video_id_from_url
from youtube_upload import existing_youtube_video_ids

FlightGpxStatus = Literal["all", "with", "missing"]
FlightSortBy = Literal[
    "flight_date", "site_name", "duration_minutes", "max_altitude_m", "distance_km"
]
SortOrder = Literal["asc", "desc"]

_CURSOR_SIGNING_KEY = hmac.new(
    config.JWT_SECRET.encode(), b"flight-summary-cursor-v1", hashlib.sha256
).digest()

_SEARCH_REPLACEMENTS = {
    "À": "A",
    "Â": "A",
    "Ä": "A",
    "Ç": "C",
    "É": "E",
    "È": "E",
    "Ê": "E",
    "Ë": "E",
    "Î": "I",
    "Ï": "I",
    "Ô": "O",
    "Ö": "O",
    "Ù": "U",
    "Û": "U",
    "Ü": "U",
    "à": "a",
    "â": "a",
    "ä": "a",
    "ç": "c",
    "é": "e",
    "è": "e",
    "ê": "e",
    "ë": "e",
    "î": "i",
    "ï": "i",
    "ô": "o",
    "ö": "o",
    "ù": "u",
    "û": "u",
    "ü": "u",
}


class InvalidFlightSummaryCursor(ValueError):
    pass


def _resolve_file_path(file_path: str | None) -> Path | None:
    if not file_path:
        return None
    path = Path(file_path)
    if path.is_absolute() or path.exists():
        return path
    return Path(__file__).parent / path


def _file_exists(file_path: str | None) -> bool:
    path = _resolve_file_path(file_path)
    return bool(path and path.is_file())


def _youtube_video_ids(value: str | None) -> set[str]:
    try:
        urls = json.loads(value or "[]")
    except (TypeError, json.JSONDecodeError):
        return set()
    if not isinstance(urls, list):
        return set()

    video_ids: set[str] = set()
    for url in urls:
        if not isinstance(url, str):
            continue
        try:
            video_ids.add(youtube_video_id_from_url(url))
        except ValueError:
            continue
    return video_ids


def _completed_youtube_uploads(value: str | None) -> list[tuple[int, str]]:
    try:
        uploads = json.loads(value or "[]")
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(uploads, list):
        return []

    return [
        (upload["user_id"], upload["video_id"])
        for upload in uploads
        if isinstance(upload, dict)
        and isinstance(upload.get("user_id"), int)
        and isinstance(upload.get("video_id"), str)
    ]


def _flight_directory(flight_date: date, sequence: int) -> Path:
    return Path(config.PARAGLIDING_DATA_ROOT) / flight_date.strftime("%Y%m%d") / f"{sequence:02d}"


def _null_safe_equal(left: Any, right: Any) -> ColumnElement[bool]:
    return or_(left == right, and_(left.is_(None), right.is_(None)))


def _flight_sequence_expression() -> ColumnElement[int]:
    candidate = aliased(Flight)
    same_departure = _null_safe_equal(candidate.departure_time, Flight.departure_time)
    same_creation = _null_safe_equal(candidate.created_at, Flight.created_at)
    earlier = or_(
        and_(candidate.departure_time.isnot(None), Flight.departure_time.is_(None)),
        candidate.departure_time < Flight.departure_time,
        and_(
            same_departure,
            or_(
                and_(candidate.created_at.isnot(None), Flight.created_at.is_(None)),
                candidate.created_at < Flight.created_at,
                and_(same_creation, candidate.id < Flight.id),
            ),
        ),
    )
    return (
        select(func.count(candidate.id))
        .where(candidate.flight_date == Flight.flight_date, earlier)
        .correlate(Flight)
        .scalar_subquery()
        + 1
    )


def _encode_cursor(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    signature = hmac.new(_CURSOR_SIGNING_KEY, body, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(body + signature).decode().rstrip("=")


def _decode_cursor(cursor: str) -> dict[str, Any]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        body, signature = raw[:-32], raw[-32:]
        expected = hmac.new(_CURSOR_SIGNING_KEY, body, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            raise InvalidFlightSummaryCursor("Invalid cursor")
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise InvalidFlightSummaryCursor("Invalid cursor")
        return payload
    except InvalidFlightSummaryCursor:
        raise
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise InvalidFlightSummaryCursor("Invalid cursor") from exc


def _cursor_context(
    *,
    q: str | None,
    site_id: str | None,
    gpx_status: FlightGpxStatus,
    sort_by: FlightSortBy,
    sort_order: SortOrder,
) -> dict[str, Any]:
    return {
        "v": 1,
        "q": q,
        "site_id": site_id,
        "gpx_status": gpx_status,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }


def _ordering(sort_by: FlightSortBy) -> list[ColumnElement[Any]]:
    if sort_by == "flight_date":
        return [Flight.flight_date, Flight.departure_time, Flight.id]
    if sort_by == "site_name":
        return [func.lower(Site.name), Flight.id]
    return [getattr(Flight, sort_by), Flight.id]


def _serialize_cursor_value(value: Any) -> Any:
    return value.isoformat() if isinstance(value, date | datetime) else value


def _fold_search_term(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    ).lower()


def _fold_search_column(expression: ColumnElement[Any]) -> ColumnElement[Any]:
    folded = func.coalesce(expression, "")
    for source, replacement in _SEARCH_REPLACEMENTS.items():
        folded = func.replace(folded, source, replacement)
    return func.lower(folded)


def _deserialize_cursor_values(
    values: list[Any], sort_by: FlightSortBy
) -> list[str | int | float | date | datetime | None]:
    try:
        if sort_by == "flight_date":
            return [
                date.fromisoformat(values[0]),
                datetime.fromisoformat(values[1]) if values[1] is not None else None,
                str(values[2]),
            ]
        if sort_by in {"duration_minutes", "max_altitude_m"}:
            return [int(values[0]) if values[0] is not None else None, str(values[1])]
        if sort_by == "distance_km":
            return [float(values[0]) if values[0] is not None else None, str(values[1])]
        return [str(values[0]) if values[0] is not None else None, str(values[1])]
    except (IndexError, TypeError, ValueError) as exc:
        raise InvalidFlightSummaryCursor("Invalid cursor") from exc


def _after_cursor(
    expressions: list[ColumnElement[Any]], values: list[Any], sort_order: SortOrder
) -> ColumnElement[bool]:
    branches: list[ColumnElement[bool]] = []
    equal_prefix: list[ColumnElement[bool]] = []
    for expression, value in zip(expressions, values, strict=True):
        if value is not None:
            comparison = expression > value if sort_order == "asc" else expression < value
            branches.append(and_(*equal_prefix, or_(comparison, expression.is_(None))))
            equal_prefix.append(expression == value)
        else:
            equal_prefix.append(expression.is_(None))
    return or_(*branches)


def _apply_filters(
    query: Query[Any],
    *,
    q: str | None,
    site_id: str | None,
    gpx_status: FlightGpxStatus,
) -> Query[Any]:
    if site_id:
        query = query.filter(Flight.site_id == site_id)
    if gpx_status == "with":
        query = query.filter(Flight.gpx_file_path.isnot(None), Flight.gpx_file_path != "")
    elif gpx_status == "missing":
        query = query.filter(or_(Flight.gpx_file_path.is_(None), Flight.gpx_file_path == ""))
    if q:
        escaped_q = (
            _fold_search_term(q).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        pattern = f"%{escaped_q}%"
        query = query.filter(
            or_(
                _fold_search_column(Flight.title).like(pattern, escape="\\"),
                _fold_search_column(Flight.name).like(pattern, escape="\\"),
                _fold_search_column(Site.name).like(pattern, escape="\\"),
                cast(Flight.flight_date, String).like(pattern, escape="\\"),
            )
        )
    return query


def list_flight_summaries(
    db: Session,
    *,
    page_size: int,
    cursor: str | None,
    q: str | None,
    site_id: str | None,
    gpx_status: FlightGpxStatus,
    sort_by: FlightSortBy,
    sort_order: SortOrder,
) -> FlightSummariesResponse:
    normalized_q = q.strip().lower() if q and q.strip() else None
    context = _cursor_context(
        q=normalized_q,
        site_id=site_id,
        gpx_status=gpx_status,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    cursor_values = None
    if cursor:
        payload = _decode_cursor(cursor)
        if {key: payload.get(key) for key in context} != context:
            raise InvalidFlightSummaryCursor("Cursor does not match the current query")
        raw_values = payload.get("values")
        if not isinstance(raw_values, list):
            raise InvalidFlightSummaryCursor("Invalid cursor")
        cursor_values = _deserialize_cursor_values(raw_values, sort_by)

    base_query = _apply_filters(
        db.query(Flight).outerjoin(Site, Flight.site_id == Site.id),
        q=normalized_q,
        site_id=site_id,
        gpx_status=gpx_status,
    )
    total = base_query.with_entities(func.count(Flight.id)).scalar() or 0

    expressions = _ordering(sort_by)
    completed_overlay_path = (
        select(GoproOverlayJob.output_path)
        .where(
            GoproOverlayJob.flight_id == Flight.id,
            GoproOverlayJob.status == "completed",
        )
        .order_by(GoproOverlayJob.completed_at.desc(), GoproOverlayJob.created_at.desc())
        .limit(1)
        .correlate(Flight)
        .scalar_subquery()
    )
    completed_youtube_uploads = (
        select(
            func.json_group_array(
                func.json_object(
                    "user_id",
                    YoutubeUploadJob.user_id,
                    "video_id",
                    YoutubeUploadJob.youtube_video_id,
                )
            )
        )
        .where(
            YoutubeUploadJob.flight_id == Flight.id,
            YoutubeUploadJob.status == "completed",
            YoutubeUploadJob.youtube_video_id.isnot(None),
        )
        .correlate(Flight)
        .scalar_subquery()
    )
    page_query = base_query.with_entities(
        Flight.id,
        Flight.site_id,
        Site.name.label("site_name"),
        Site.region.label("site_region"),
        Flight.name,
        Flight.title,
        Flight.flight_date,
        Flight.departure_time,
        Flight.duration_minutes,
        Flight.max_altitude_m,
        Flight.distance_km,
        Flight.elevation_gain_m,
        Flight.gpx_file_path,
        Flight.video_export_job_id,
        Flight.video_export_status,
        Flight.video_file_path,
        Flight.youtube_urls_json,
        Flight.gopro_overlay_job_id,
        Flight.gopro_overlay_status,
        Flight.gopro_overlay_file_path,
        _flight_sequence_expression().label("flight_sequence"),
        completed_overlay_path.label("completed_overlay_path"),
        completed_youtube_uploads.label("completed_youtube_uploads"),
        exists()
        .where(
            GoproOverlayJob.flight_id == Flight.id,
            GoproOverlayJob.status == "completed",
        )
        .label("has_completed_gopro_overlay"),
    )
    if cursor_values is not None:
        page_query = page_query.filter(_after_cursor(expressions, cursor_values, sort_order))
    order = [
        (expression.asc() if sort_order == "asc" else expression.desc()).nullslast()
        for expression in expressions
    ]
    rows = page_query.order_by(*order).limit(page_size + 1).all()
    has_more = len(rows) > page_size
    rows = rows[:page_size]
    youtube_video_ids_by_user: dict[int, set[str]] = {}
    associated_youtube_ids: dict[str, set[str]] = {}
    uploaded_youtube_ids: dict[str, set[str]] = {}
    for row in rows:
        associated_youtube_ids[row.id] = _youtube_video_ids(row.youtube_urls_json)
        uploaded_youtube_ids[row.id] = set()
        for user_id, video_id in _completed_youtube_uploads(row.completed_youtube_uploads):
            if video_id not in associated_youtube_ids[row.id]:
                continue
            uploaded_youtube_ids[row.id].add(video_id)
            youtube_video_ids_by_user.setdefault(user_id, set()).add(video_id)
    existing_youtube_ids = existing_youtube_video_ids(youtube_video_ids_by_user)

    flights = [
        FlightSummary(
            id=row.id,
            site_id=row.site_id,
            site_name=row.site_name,
            site_region=row.site_region,
            name=row.name,
            title=row.title,
            flight_date=row.flight_date,
            departure_time=row.departure_time,
            duration_minutes=row.duration_minutes,
            max_altitude_m=row.max_altitude_m,
            distance_km=row.distance_km,
            elevation_gain_m=row.elevation_gain_m,
            has_gpx=_file_exists(row.gpx_file_path),
            video_export_job_id=row.video_export_job_id,
            video_export_status=row.video_export_status,
            video_export_progress=None,
            has_video=row.video_export_status == "completed" and _file_exists(row.video_file_path),
            has_camera=(
                _flight_directory(row.flight_date, row.flight_sequence) / "camera.mp4"
            ).is_file(),
            has_youtube_video=bool(uploaded_youtube_ids[row.id] & existing_youtube_ids),
            gopro_overlay_job_id=row.gopro_overlay_job_id,
            gopro_overlay_status=row.gopro_overlay_status,
            gopro_overlay_progress=None,
            has_gopro_overlay=bool(
                (row.gopro_overlay_status == "completed" or row.has_completed_gopro_overlay)
                and (
                    _file_exists(row.gopro_overlay_file_path)
                    or _file_exists(row.completed_overlay_path)
                    or (
                        _flight_directory(row.flight_date, row.flight_sequence) / "final.mp4"
                    ).is_file()
                )
            ),
        )
        for row in rows
    ]
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        if sort_by == "flight_date":
            values = [last.flight_date, last.departure_time, last.id]
        elif sort_by == "site_name":
            values = [last.site_name.lower() if last.site_name else None, last.id]
        else:
            values = [getattr(last, sort_by), last.id]
        next_cursor = _encode_cursor(
            {**context, "values": [_serialize_cursor_value(value) for value in values]}
        )
    return FlightSummariesResponse(flights=flights, total=total, next_cursor=next_cursor)
