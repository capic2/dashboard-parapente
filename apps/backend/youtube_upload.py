"""OAuth and durable resumable uploads for generated flight videos."""

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
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

import config
from database import SessionLocal
from models import Flight, YoutubeCredential, YoutubeUploadJob

logger = logging.getLogger(__name__)

_ALGORITHM = "HS256"
_OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
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
    refresh_token = response.json().get("refresh_token")
    if not isinstance(refresh_token, str) or not refresh_token:
        raise YoutubeOAuthError("Google did not return a refresh token; reconnect YouTube")
    credential = db.get(YoutubeCredential, user_id)
    if credential is None:
        credential = YoutubeCredential(user_id=user_id, refresh_token_encrypted="")
        db.add(credential)
    credential.refresh_token_encrypted = encrypt_secret(refresh_token)
    db.commit()


def is_connected(db: Session, user_id: int) -> bool:
    return db.get(YoutubeCredential, user_id) is not None


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
        "status": job.status,
        "progress": job.progress or 0,
        "youtube_url": job.youtube_url,
        "error": job.error,
        "log_tail": _job_log_tail(job.id),
    }


def latest_job(db: Session, flight_id: str) -> YoutubeUploadJob | None:
    return (
        db.query(YoutubeUploadJob)
        .filter(YoutubeUploadJob.flight_id == flight_id)
        .order_by(YoutubeUploadJob.created_at.desc())
        .first()
    )


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


def process_youtube_upload(job_id: str) -> None:
    """RQ/thread job target for a resumable YouTube upload."""
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
            flight = db.get(Flight, job.flight_id)
            if flight is None or not flight.video_file_path:
                raise RuntimeError("Generated flight video is no longer available")
            video_path = Path(flight.video_file_path)
            user_id = job.user_id
            encrypted_session = job.upload_session_encrypted
            db.expunge(job)

        if not video_path.is_file():
            raise RuntimeError("Generated flight video is no longer available")
        total_size = video_path.stat().st_size
        if total_size <= 0:
            raise RuntimeError("Generated flight video is empty")
        _log_job(job_id, f"Generated video ready ({total_size} bytes)")

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
