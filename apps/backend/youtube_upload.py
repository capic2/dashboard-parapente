"""OAuth and durable resumable uploads for flight videos."""

from __future__ import annotations

import base64
import hashlib
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urlencode, urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session
from spatialmedia import metadata_utils

import config
from database import SessionLocal
from flight_storage import pano_video_path
from models import Flight, GoproOverlayJob, HighlightVideoJob, YoutubeCredential, YoutubeUploadJob
from schemas import youtube_video_id_from_url

logger = logging.getLogger(__name__)

_ALGORITHM = "HS256"
_OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl"
_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
_ACTIVE_STATUSES = {"queued", "uploading"}
_CANCELLED_STATUS = "cancelled"
_RANGE_PATTERN = re.compile(r"bytes=0-(\d+)")
_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="youtube-upload")
_SUBMITTED: set[str] = set()
_SUBMITTED_LOCK = threading.Lock()
_LOG_TAIL_LINE_COUNT = 100


class YoutubeConfigurationError(RuntimeError):
    pass


class YoutubeOAuthError(RuntimeError):
    pass


class YoutubeVideoNotAssociatedError(RuntimeError):
    pass


class YoutubeVideoDeletionForbiddenError(RuntimeError):
    pass


class YoutubeRemoteDeletionError(RuntimeError):
    pass


class YoutubeVideoAssociationPayload(TypedDict):
    url: str
    video_id: str
    can_delete_from_youtube: bool
    exists_on_youtube: bool | None


def _youtube_upload_log_path(job_id: str) -> Path:
    return Path(config.VIDEO_EXPORT_DIR) / ".logs" / "youtube-uploads" / f"{job_id}.log"


def _log_job(job_id: str, message: str) -> None:
    logger.info("YouTube upload job %s: %s", job_id, message)
    try:
        log_path = _youtube_upload_log_path(job_id)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(f"[{timestamp}] {message}\n")
    except OSError:
        logger.warning("Unable to persist logs for YouTube upload job %s", job_id)


def _job_log_tail(job_id: str) -> list[str]:
    log_path = _youtube_upload_log_path(job_id)
    if not log_path.exists():
        return []
    try:
        return log_path.read_text(errors="replace").splitlines()[-_LOG_TAIL_LINE_COUNT:]
    except OSError:
        return []


def _safe_log_error(exc: Exception) -> str:
    return re.sub(r"https?://\S+", "[redacted-url]", str(exc))[:1000]


def is_configured() -> bool:
    return bool(
        config.YOUTUBE_CLIENT_ID and config.YOUTUBE_CLIENT_SECRET and config.YOUTUBE_REDIRECT_URI
    )


def _require_configuration() -> None:
    if not is_configured():
        raise YoutubeConfigurationError(
            "YouTube upload is not configured. Set BACKEND_YOUTUBE_CLIENT_ID, "
            "BACKEND_YOUTUBE_CLIENT_SECRET and BACKEND_YOUTUBE_REDIRECT_URI."
        )


def _fernet() -> Fernet:
    secret = str(config.JWT_SECRET or "").encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise YoutubeOAuthError("Stored YouTube authorization can no longer be decrypted") from exc


def create_authorization_url(*, user_id: int, return_to: str) -> str:
    _require_configuration()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    state = jwt.encode(
        {
            "purpose": "youtube_oauth",
            "user_id": user_id,
            "return_to": return_to,
            "exp": expires_at,
        },
        config.JWT_SECRET,
        algorithm=_ALGORITHM,
    )
    return f"{_AUTH_URL}?{urlencode({
        'client_id': config.YOUTUBE_CLIENT_ID,
        'redirect_uri': config.YOUTUBE_REDIRECT_URI,
        'response_type': 'code',
        'scope': _OAUTH_SCOPE,
        'access_type': 'offline',
        'prompt': 'consent',
        'include_granted_scopes': 'true',
        'state': state,
    })}"


def decode_oauth_state(state: str) -> tuple[int, str]:
    try:
        payload = jwt.decode(state, config.JWT_SECRET, algorithms=[_ALGORITHM])
    except JWTError as exc:
        raise YoutubeOAuthError("Invalid or expired YouTube authorization state") from exc
    if payload.get("purpose") != "youtube_oauth" or not isinstance(payload.get("user_id"), int):
        raise YoutubeOAuthError("Invalid YouTube authorization state")
    return_to = payload.get("return_to", "/flights")
    if (
        not isinstance(return_to, str)
        or not return_to.startswith("/")
        or return_to.startswith("//")
    ):
        return_to = "/flights"
    return payload["user_id"], return_to


def exchange_authorization_code(db: Session, *, user_id: int, code: str) -> None:
    _require_configuration()
    response = httpx.post(
        _TOKEN_URL,
        data={
            "client_id": config.YOUTUBE_CLIENT_ID,
            "client_secret": config.YOUTUBE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": config.YOUTUBE_REDIRECT_URI,
        },
        timeout=30,
    )
    if response.is_error:
        raise YoutubeOAuthError("Google rejected the YouTube authorization code")
    token_payload = response.json()
    refresh_token = token_payload.get("refresh_token")
    if not isinstance(refresh_token, str) or not refresh_token:
        raise YoutubeOAuthError("Google did not return a refresh token; reconnect YouTube")
    credential = db.get(YoutubeCredential, user_id)
    if credential is None:
        credential = YoutubeCredential(user_id=user_id, refresh_token_encrypted="")
        db.add(credential)
    credential.refresh_token_encrypted = encrypt_secret(refresh_token)
    granted_scope = token_payload.get("scope")
    credential.oauth_scope = granted_scope if isinstance(granted_scope, str) else _OAUTH_SCOPE
    db.commit()


def is_connected(db: Session, user_id: int) -> bool:
    credential = db.get(YoutubeCredential, user_id)
    return credential is not None and _OAUTH_SCOPE in credential.oauth_scope.split()


def disconnect(db: Session, user_id: int) -> None:
    credential = db.get(YoutubeCredential, user_id)
    if credential is not None:
        db.delete(credential)
        db.commit()


def _access_token(user_id: int) -> str:
    with SessionLocal() as db:
        credential = db.get(YoutubeCredential, user_id)
        if credential is None:
            raise YoutubeOAuthError("YouTube is not connected")
        if _OAUTH_SCOPE not in credential.oauth_scope.split():
            raise YoutubeOAuthError("YouTube authorization must be renewed before deleting videos")
        refresh_token = decrypt_secret(credential.refresh_token_encrypted)
    response = httpx.post(
        _TOKEN_URL,
        data={
            "client_id": config.YOUTUBE_CLIENT_ID,
            "client_secret": config.YOUTUBE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if response.is_error:
        raise YoutubeOAuthError("Unable to refresh the YouTube authorization")
    access_token = response.json().get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise YoutubeOAuthError("Google returned an invalid access token")
    return access_token


def job_payload(job: YoutubeUploadJob) -> dict[str, Any]:
    return {
        "job_id": job.id,
        "flight_id": job.flight_id,
        "source_type": job.source_type,
        "gopro_overlay_job_id": job.gopro_overlay_job_id,
        "highlight_video_job_id": job.highlight_video_job_id,
        "status": job.status,
        "progress": job.progress or 0,
        "youtube_url": job.youtube_url,
        "error": job.error,
        "updated_at": job.updated_at,
        "log_tail": _job_log_tail(job.id),
    }


def latest_job(
    db: Session,
    flight_id: str,
    *,
    source_type: str | None = None,
    gopro_overlay_job_id: str | None = None,
    highlight_video_job_id: str | None = None,
) -> YoutubeUploadJob | None:
    query = db.query(YoutubeUploadJob).filter(YoutubeUploadJob.flight_id == flight_id)
    if source_type is not None:
        query = query.filter(YoutubeUploadJob.source_type == source_type)
    if gopro_overlay_job_id is not None:
        query = query.filter(YoutubeUploadJob.gopro_overlay_job_id == gopro_overlay_job_id)
    if highlight_video_job_id is not None:
        query = query.filter(YoutubeUploadJob.highlight_video_job_id == highlight_video_job_id)
    return query.order_by(YoutubeUploadJob.created_at.desc()).first()


def youtube_video_availability(
    video_ids_by_user: dict[int, set[str]],
) -> dict[str, bool | None]:
    """Return remote availability, preserving unknown results when YouTube is unavailable."""
    availability = {
        video_id: None for video_ids in video_ids_by_user.values() for video_id in video_ids
    }
    for user_id, video_ids in video_ids_by_user.items():
        try:
            access_token = _access_token(user_id)
        except (YoutubeOAuthError, httpx.HTTPError, ValueError) as exc:
            logger.warning("Unable to verify YouTube videos for user %s: %s", user_id, exc)
            continue

        ordered_ids = sorted(video_ids)
        for offset in range(0, len(ordered_ids), 50):
            batch = ordered_ids[offset : offset + 50]
            try:
                response = httpx.get(
                    _VIDEOS_URL,
                    params={"part": "id", "id": ",".join(batch)},
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30,
                )
                response.raise_for_status()
                items = response.json().get("items", [])
                existing_ids = {
                    item["id"]
                    for item in items
                    if isinstance(item, dict) and isinstance(item.get("id"), str)
                }
                for video_id in batch:
                    availability[video_id] = video_id in existing_ids
            except (httpx.HTTPError, ValueError, AttributeError) as exc:
                logger.warning("Unable to verify YouTube video batch: %s", _safe_log_error(exc))
    return availability


def existing_youtube_video_ids(video_ids_by_user: dict[int, set[str]]) -> set[str]:
    """Return uploaded video IDs that YouTube still exposes to their owner."""
    return {
        video_id
        for video_id, exists in youtube_video_availability(video_ids_by_user).items()
        if exists is True
    }


def youtube_video_associations(
    db: Session, *, flight: Flight, user_id: int
) -> list[YoutubeVideoAssociationPayload]:
    """Return local links and whether the connected user may delete each video."""
    associations = [(url, youtube_video_id_from_url(url)) for url in flight.youtube_urls]
    video_ids = {video_id for _, video_id in associations}
    youtube_connected = is_connected(db, user_id)
    deletable_video_ids = {
        video_id
        for (video_id,) in (
            db.query(YoutubeUploadJob.youtube_video_id)
            .filter(
                YoutubeUploadJob.flight_id == flight.id,
                YoutubeUploadJob.user_id == user_id,
                YoutubeUploadJob.status == "completed",
                YoutubeUploadJob.youtube_video_id.in_(video_ids),
            )
            .all()
        )
        if video_id is not None
    }
    availability = (
        youtube_video_availability({user_id: deletable_video_ids})
        if youtube_connected and deletable_video_ids
        else {}
    )
    return [
        {
            "url": url,
            "video_id": video_id,
            "can_delete_from_youtube": youtube_connected and video_id in deletable_video_ids,
            "exists_on_youtube": availability.get(video_id),
        }
        for url, video_id in associations
    ]


def _completed_upload_for_user(
    db: Session, *, flight_id: str, video_id: str, user_id: int
) -> YoutubeUploadJob | None:
    return (
        db.query(YoutubeUploadJob)
        .filter(
            YoutubeUploadJob.flight_id == flight_id,
            YoutubeUploadJob.youtube_video_id == video_id,
            YoutubeUploadJob.user_id == user_id,
            YoutubeUploadJob.status == "completed",
        )
        .first()
    )


def _delete_remote_video(*, video_id: str, user_id: int) -> None:
    try:
        access_token = _access_token(user_id)
        response = httpx.delete(
            _VIDEOS_URL,
            params={"id": video_id},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
    except httpx.RequestError as exc:
        raise YoutubeRemoteDeletionError(
            "YouTube could not be reached; retry deleting the video later"
        ) from exc

    if response.status_code in {200, 204, 404}:
        return
    if response.status_code in {401, 403}:
        raise YoutubeOAuthError(
            "YouTube authorization cannot delete this video; reconnect YouTube and try again"
        )
    if response.status_code >= 500:
        raise YoutubeRemoteDeletionError(
            "YouTube is temporarily unavailable; retry deleting the video later"
        )
    raise YoutubeRemoteDeletionError(
        f"YouTube rejected the video deletion ({response.status_code}); the local link was kept"
    )


def remove_youtube_video(
    db: Session,
    *,
    flight: Flight,
    video_id: str,
    user_id: int,
    delete_from_youtube: bool,
) -> None:
    """Optionally delete a video remotely, then atomically remove its local association."""
    associated_urls = [
        url for url in flight.youtube_urls if youtube_video_id_from_url(url) == video_id
    ]
    if not associated_urls:
        raise YoutubeVideoNotAssociatedError("This YouTube video is not associated with the flight")

    if delete_from_youtube:
        job = _completed_upload_for_user(
            db, flight_id=flight.id, video_id=video_id, user_id=user_id
        )
        if job is None:
            raise YoutubeVideoDeletionForbiddenError(
                "Only the user who uploaded this video can delete it from YouTube"
            )
        _delete_remote_video(video_id=video_id, user_id=user_id)

    associated_url_set = set(associated_urls)
    flight.youtube_urls = [url for url in flight.youtube_urls if url not in associated_url_set]
    db.commit()


def active_job(db: Session, flight_id: str) -> YoutubeUploadJob | None:
    return (
        db.query(YoutubeUploadJob)
        .filter(
            YoutubeUploadJob.flight_id == flight_id,
            YoutubeUploadJob.status.in_(_ACTIVE_STATUSES),
        )
        .order_by(YoutubeUploadJob.created_at.desc())
        .first()
    )


def _is_cancelled(job_id: str) -> bool:
    with SessionLocal() as db:
        job = db.get(YoutubeUploadJob, job_id)
        return job is not None and job.status == _CANCELLED_STATUS


def _update_active_job(job_id: str, **changes: Any) -> bool:
    """Update a job only while it is active, preserving concurrent cancellation."""
    with SessionLocal() as db:
        updated = (
            db.query(YoutubeUploadJob)
            .filter(
                YoutubeUploadJob.id == job_id,
                YoutubeUploadJob.status.in_(_ACTIVE_STATUSES),
            )
            .update({**changes, "updated_at": datetime.utcnow()})
        )
        db.commit()
        return updated == 1


def cancel_upload(db: Session, *, job_id: str, user_id: int) -> YoutubeUploadJob | None:
    """Persist cancellation and stop the RQ job when one exists."""
    updated = (
        db.query(YoutubeUploadJob)
        .filter(
            YoutubeUploadJob.id == job_id,
            YoutubeUploadJob.user_id == user_id,
            YoutubeUploadJob.status.in_(_ACTIVE_STATUSES),
        )
        .update(
            {
                "status": _CANCELLED_STATUS,
                "upload_session_encrypted": None,
                "error": None,
                "updated_at": datetime.utcnow(),
            }
        )
    )
    db.commit()
    if updated != 1:
        return None
    _log_job(job_id, "YouTube upload cancelled")

    from job_queue import delete_job, is_rq_enabled

    if is_rq_enabled():
        try:
            delete_job(
                f"youtube-upload-{job_id}",
                queue_name=config.YOUTUBE_UPLOAD_QUEUE_NAME,
            )
        except Exception:
            logger.exception("Unable to stop RQ YouTube upload job %s", job_id)
    return db.get(YoutubeUploadJob, job_id)


def _start_session(job: YoutubeUploadJob, video_path: Path, access_token: str) -> str:
    _log_job(job.id, "Creating resumable YouTube upload session")
    response = httpx.post(
        _UPLOAD_URL,
        params={"uploadType": "resumable", "part": "snippet,status"},
        headers={
            "Authorization": f"Bearer {access_token}",
            "X-Upload-Content-Length": str(video_path.stat().st_size),
            "X-Upload-Content-Type": "video/mp4",
        },
        json={
            "snippet": {
                "title": job.title,
                "description": job.description,
                "categoryId": "17",
            },
            "status": {
                "privacyStatus": job.privacy_status,
                "embeddable": True,
                "selfDeclaredMadeForKids": False,
            },
        },
        timeout=30,
    )
    if response.is_error:
        raise RuntimeError(f"YouTube rejected the upload metadata ({response.status_code})")
    session_url = response.headers.get("location")
    parsed = urlparse(session_url or "")
    if parsed.scheme != "https" or parsed.hostname != "www.googleapis.com":
        raise RuntimeError("YouTube returned an invalid resumable upload URL")
    _update_active_job(job.id, upload_session_encrypted=encrypt_secret(session_url))
    _log_job(job.id, "Resumable YouTube upload session created")
    return session_url


def _uploaded_offset(response: httpx.Response) -> int:
    match = _RANGE_PATTERN.fullmatch(response.headers.get("range", ""))
    return int(match.group(1)) + 1 if match else 0


def _completion_id(response: httpx.Response) -> str | None:
    if response.status_code not in {200, 201}:
        return None
    value = response.json().get("id")
    return value if isinstance(value, str) and value else None


def _session_offset(
    session_url: str, *, access_token: str, total_size: int
) -> tuple[int, str | None]:
    response = httpx.put(
        session_url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Length": "0",
            "Content-Range": f"bytes */{total_size}",
        },
        content=b"",
        timeout=30,
    )
    if response.status_code == 308:
        return _uploaded_offset(response), None
    video_id = _completion_id(response)
    if video_id:
        return total_size, video_id
    if response.status_code in {404, 410}:
        return 0, None
    response.raise_for_status()
    return 0, None


def _finish_upload(job_id: str, video_id: str) -> None:
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    with SessionLocal() as db:
        job = db.get(YoutubeUploadJob, job_id)
        if job is None:
            return
        flight = db.get(Flight, job.flight_id)
        if flight is None:
            raise RuntimeError("Flight was deleted during the YouTube upload")
        completed = (
            db.query(YoutubeUploadJob)
            .filter(
                YoutubeUploadJob.id == job_id,
                YoutubeUploadJob.status.in_(_ACTIVE_STATUSES),
            )
            .update(
                {
                    "status": "completed",
                    "progress": 100,
                    "youtube_video_id": video_id,
                    "youtube_url": youtube_url,
                    "upload_session_encrypted": None,
                    "completed_at": datetime.utcnow(),
                    "error": None,
                    "updated_at": datetime.utcnow(),
                }
            )
        )
        if completed != 1:
            db.rollback()
            return
        urls = flight.youtube_urls
        if youtube_url not in urls:
            flight.youtube_urls = [*urls, youtube_url]
        db.commit()
    _log_job(job_id, f"YouTube upload completed: {youtube_url}")


def _source_video_path(db: Session, job: YoutubeUploadJob) -> Path:
    if job.source_type == "pano":
        flight = db.get(Flight, job.flight_id)
        if flight is None:
            raise RuntimeError("Flight is no longer available")
        return pano_video_path(db, flight)
    if job.source_type != "gopro_overlay":
        if job.source_type != "highlight":
            raise RuntimeError("YouTube upload has an unsupported video source")
        if not job.highlight_video_job_id:
            raise RuntimeError("YouTube upload has no highlights source")
        highlight = db.get(HighlightVideoJob, job.highlight_video_job_id)
        if (
            highlight is None
            or highlight.flight_id != job.flight_id
            or highlight.status != "completed"
            or not highlight.output_path
        ):
            raise RuntimeError("Best-moments video is no longer available")
        return Path(highlight.output_path)
    if not job.gopro_overlay_job_id:
        raise RuntimeError("YouTube upload has no GoPro overlay source")
    overlay = db.get(GoproOverlayJob, job.gopro_overlay_job_id)
    if overlay is None or overlay.flight_id != job.flight_id or overlay.status != "completed":
        raise RuntimeError("GoPro overlay video is no longer available")
    return Path(overlay.output_path)


def _panorama_upload_path(job_id: str) -> Path:
    return Path(config.VIDEO_EXPORT_DIR) / ".youtube-uploads" / f"{job_id}.spherical.mp4"


def _has_spherical_panorama_metadata(video_path: Path) -> bool:
    def debug_metadata(message: object, *extra: object) -> None:
        logger.debug("Spatial metadata inspector: %s", " ".join(map(str, (message, *extra))))

    try:
        parsed_metadata = metadata_utils.parse_metadata(str(video_path), debug_metadata)
    except Exception:
        logger.debug("Unable to parse spatial metadata from %s", video_path, exc_info=True)
        return False
    parsed_video = getattr(parsed_metadata, "video", {})
    return isinstance(parsed_video, dict) and any(
        isinstance(track_metadata, dict)
        and track_metadata.get("Spherical") == "true"
        and track_metadata.get("ProjectionType") == "equirectangular"
        for track_metadata in parsed_video.values()
    )


def _prepare_upload_video(job_id: str, source_type: str, source_path: Path) -> Path:
    """Return a YouTube-ready source, injecting 360 metadata for panoramas."""
    if source_type != "pano":
        return source_path

    upload_path = _panorama_upload_path(job_id)
    if upload_path.is_file() and upload_path.stat().st_size > 0:
        if _has_spherical_panorama_metadata(upload_path):
            return upload_path
        upload_path.unlink()

    upload_path.parent.mkdir(parents=True, exist_ok=True)
    partial_path = upload_path.with_suffix(".part.mp4")
    partial_path.unlink(missing_ok=True)
    spherical_xml = metadata_utils.generate_spherical_xml("equirectangular")
    if not isinstance(spherical_xml, str):
        raise RuntimeError("Unable to generate panorama metadata")
    metadata = metadata_utils.Metadata()
    metadata.video = spherical_xml

    def debug_metadata(message: object, *extra: object) -> None:
        logger.debug("Spatial metadata injector: %s", " ".join(map(str, (message, *extra))))

    try:
        metadata_utils.inject_metadata(
            str(source_path), str(partial_path), metadata, debug_metadata
        )
        if not partial_path.is_file() or partial_path.stat().st_size <= 0:
            raise RuntimeError("Unable to inject panorama metadata")
        if not _has_spherical_panorama_metadata(partial_path):
            raise RuntimeError("Injected panorama metadata could not be verified")
        partial_path.replace(upload_path)
    except Exception:
        partial_path.unlink(missing_ok=True)
        raise
    return upload_path


def process_youtube_upload(job_id: str) -> None:
    """RQ/thread job target for a resumable YouTube upload."""
    prepared_video_path: Path | None = None
    try:
        _log_job(job_id, "Starting YouTube upload")
        _require_configuration()
        with SessionLocal() as db:
            claimed = (
                db.query(YoutubeUploadJob)
                .filter(
                    YoutubeUploadJob.id == job_id,
                    YoutubeUploadJob.status.in_(_ACTIVE_STATUSES),
                )
                .update(
                    {
                        "status": "uploading",
                        "started_at": func.coalesce(YoutubeUploadJob.started_at, datetime.utcnow()),
                        "error": None,
                        "updated_at": datetime.utcnow(),
                    }
                )
            )
            db.commit()
            if claimed != 1:
                return
            job = db.get(YoutubeUploadJob, job_id)
            if job is None:
                return
            video_path = _source_video_path(db, job)
            source_type = job.source_type
            user_id = job.user_id
            encrypted_session = job.upload_session_encrypted
            db.expunge(job)

        if not video_path.is_file():
            raise RuntimeError("Source video is no longer available")
        source_size = video_path.stat().st_size
        if source_size <= 0:
            raise RuntimeError("Source video is empty")
        video_path = _prepare_upload_video(job_id, source_type, video_path)
        if source_type == "pano":
            prepared_video_path = video_path
            _log_job(job_id, "Panorama metadata ready for interactive 360° playback")
        total_size = video_path.stat().st_size
        if total_size <= 0:
            raise RuntimeError("Source video is empty")
        _log_job(job_id, f"Source video ready ({total_size} bytes)")

        _log_job(job_id, "Refreshing YouTube authorization")
        access_token = _access_token(user_id)
        _log_job(job_id, "YouTube authorization ready")
        if _is_cancelled(job_id):
            return
        session_url = decrypt_secret(encrypted_session) if encrypted_session else None
        offset = 0
        if session_url:
            _log_job(job_id, "Checking existing resumable upload session")
            offset, completed_id = _session_offset(
                session_url, access_token=access_token, total_size=total_size
            )
            if completed_id:
                _finish_upload(job_id, completed_id)
                return
            if offset == 0:
                session_url = None
            else:
                _log_job(
                    job_id,
                    f"Resuming YouTube upload at {int(offset * 100 / total_size)}%",
                )
        if not session_url:
            session_url = _start_session(job, video_path, access_token)
        if _is_cancelled(job_id):
            return

        chunk_size = max(256 * 1024, config.YOUTUBE_UPLOAD_CHUNK_SIZE)
        chunk_size -= chunk_size % (256 * 1024)
        with video_path.open("rb") as video_file:
            video_file.seek(offset)
            while offset < total_size:
                if _is_cancelled(job_id):
                    return
                chunk = video_file.read(min(chunk_size, total_size - offset))
                if not chunk:
                    raise RuntimeError("Unexpected end of generated video")
                end = offset + len(chunk) - 1
                for attempt in range(5):
                    if _is_cancelled(job_id):
                        return
                    response = httpx.put(
                        session_url,
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "Content-Type": "video/mp4",
                            "Content-Length": str(len(chunk)),
                            "Content-Range": f"bytes {offset}-{end}/{total_size}",
                        },
                        content=chunk,
                        timeout=120,
                    )
                    if response.status_code not in {500, 502, 503, 504}:
                        break
                    _log_job(
                        job_id,
                        f"YouTube temporarily unavailable; retry {attempt + 1}/5",
                    )
                    if attempt == 4:
                        response.raise_for_status()
                    time.sleep(2**attempt)
                video_id = _completion_id(response)
                if video_id:
                    _finish_upload(job_id, video_id)
                    return
                if response.status_code != 308:
                    response.raise_for_status()
                    raise RuntimeError("YouTube did not acknowledge the uploaded video chunk")
                next_offset = _uploaded_offset(response)
                if next_offset <= offset:
                    raise RuntimeError("YouTube upload did not make progress")
                offset = next_offset
                video_file.seek(offset)
                progress = min(99, int(offset * 100 / total_size))
                _update_active_job(job_id, progress=progress)
                _log_job(job_id, f"YouTube upload progress: {progress}%")
        raise RuntimeError("YouTube upload ended without a video identifier")
    except Exception as exc:
        safe_error = _safe_log_error(exc)
        logger.exception("YouTube upload job %s failed", job_id)
        _log_job(job_id, f"YouTube upload failed: {safe_error}")
        _update_active_job(job_id, status="failed", error=safe_error)
    finally:
        if prepared_video_path is not None:
            try:
                prepared_video_path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Unable to remove prepared panorama for YouTube upload %s", job_id)
        with _SUBMITTED_LOCK:
            _SUBMITTED.discard(job_id)


def _enqueue_rq(job_id: str) -> None:
    from job_queue import enqueue_once

    enqueue_once(
        "youtube_upload.process_youtube_upload",
        job_id,
        job_id=f"youtube-upload-{job_id}",
        timeout=config.JOB_QUEUE_TIMEOUT_SECONDS,
        queue_name=config.YOUTUBE_UPLOAD_QUEUE_NAME,
    )


def _remove_legacy_rq_job(job_id: str) -> None:
    """Remove a pending upload that was enqueued on the shared video queue."""
    from job_queue import delete_job, get_queue

    rq_job_id = f"youtube-upload-{job_id}"
    existing_job = get_queue(config.JOB_QUEUE_NAME).fetch_job(rq_job_id)
    if existing_job is None or existing_job.origin == config.YOUTUBE_UPLOAD_QUEUE_NAME:
        return
    delete_job(rq_job_id, queue_name=existing_job.origin or config.JOB_QUEUE_NAME)


def enqueue_youtube_upload(job_id: str) -> None:
    from job_queue import is_rq_enabled

    if is_rq_enabled():
        _log_job(job_id, "YouTube upload queued")
        _enqueue_rq(job_id)
        return
    with _SUBMITTED_LOCK:
        if job_id in _SUBMITTED:
            return
        _SUBMITTED.add(job_id)
    _log_job(job_id, "YouTube upload queued")
    _EXECUTOR.submit(process_youtube_upload, job_id)


def enqueue_pending_youtube_uploads(
    *, recover_active: bool = False, migrate_legacy_queue: bool = False
) -> int:
    with SessionLocal() as db:
        jobs = (
            db.query(YoutubeUploadJob)
            .filter(YoutubeUploadJob.status.in_(_ACTIVE_STATUSES))
            .order_by(YoutubeUploadJob.created_at)
            .all()
        )
        if recover_active:
            for job in jobs:
                job.status = "queued"
            db.commit()
        job_ids = [job.id for job in jobs]
    for job_id in job_ids:
        if migrate_legacy_queue:
            _remove_legacy_rq_job(job_id)
        enqueue_youtube_upload(job_id)
    return len(job_ids)
