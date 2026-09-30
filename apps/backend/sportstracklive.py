"""SportsTrackLive GPX upload and per-user connection settings."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

import requests
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

import config
from database import SessionLocal
from flight_file_paths import resolve_flight_file_path
from models import Flight, SportstrackLiveCredential
from youtube_upload import YoutubeOAuthError, decrypt_secret, encrypt_secret

_UPLOAD_URL = "https://api.sportstracklive.com/v1/track_upload"
_UPLOAD_TIMEOUT_SECONDS = 30
_STALE_UPLOAD_AFTER = timedelta(minutes=5)
logger = logging.getLogger(__name__)
_AUTOMATIC_UPLOAD_TASKS: set[asyncio.Task[None]] = set()


def connection_settings(db: Session, user_id: int) -> dict[str, bool]:
    credential = db.get(SportstrackLiveCredential, user_id)
    return {
        "upload_key_configured": bool(credential and credential.upload_key_encrypted),
        "application_secret_configured": bool(config.SPORTSTRACKLIVE_SECRET_KEY),
        "auto_upload": bool(credential and credential.auto_upload),
    }


def save_connection_settings(
    db: Session,
    user_id: int,
    *,
    upload_key: str | None,
    auto_upload: bool,
) -> dict[str, bool]:
    credential = db.get(SportstrackLiveCredential, user_id)
    if upload_key:
        if credential is None:
            credential = SportstrackLiveCredential(
                user_id=user_id,
                upload_key_encrypted=encrypt_secret(upload_key.strip()),
                auto_upload=auto_upload,
            )
            db.add(credential)
        else:
            credential.upload_key_encrypted = encrypt_secret(upload_key.strip())
            credential.auto_upload = auto_upload
    elif credential is not None:
        credential.auto_upload = auto_upload

    if credential is None and auto_upload:
        raise HTTPException(status_code=400, detail="Configurez d'abord votre clé d'envoi.")

    db.commit()
    return connection_settings(db, user_id)


def remove_connection_settings(db: Session, user_id: int) -> None:
    credential = db.get(SportstrackLiveCredential, user_id)
    if credential is not None:
        db.delete(credential)
        db.commit()


def _credential_for_upload(db: Session, user_id: int) -> tuple[str, str]:
    credential = db.get(SportstrackLiveCredential, user_id)
    if credential is None or not credential.upload_key_encrypted:
        raise HTTPException(status_code=400, detail="Configurez votre clé d'envoi SportsTrackLive.")
    if not config.SPORTSTRACKLIVE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="La clé secrète d'application SportsTrackLive n'est pas configurée côté serveur.",
        )
    try:
        upload_key = decrypt_secret(credential.upload_key_encrypted)
    except YoutubeOAuthError as exc:
        raise HTTPException(
            status_code=400,
            detail="La clé SportsTrackLive enregistrée est illisible. Enregistrez-la à nouveau.",
        ) from exc
    return upload_key, config.SPORTSTRACKLIVE_SECRET_KEY


def upload_flight(
    db: Session, flight: Flight, user_id: int, *, already_claimed: bool = False
) -> dict[str, Any]:
    if not flight.gpx_file_path:
        raise HTTPException(status_code=400, detail="Ce vol n'a pas de fichier GPX à envoyer.")

    gpx_path = resolve_flight_file_path(flight.gpx_file_path)
    if not gpx_path or not gpx_path.is_file():
        raise HTTPException(status_code=404, detail="Le fichier GPX de ce vol est introuvable.")

    upload_key, secret_key = _credential_for_upload(db, user_id)
    if not already_claimed:
        now = datetime.utcnow()
        stale_upload_before = now - _STALE_UPLOAD_AFTER
        claimed = (
            db.query(Flight)
            .filter(
                Flight.id == flight.id,
                or_(
                    Flight.sportstracklive_status.is_(None),
                    Flight.sportstracklive_status == "failed",
                    Flight.sportstracklive_status == "queued",
                    and_(
                        Flight.sportstracklive_status == "uploading",
                        or_(
                            Flight.sportstracklive_upload_started_at <= stale_upload_before,
                            and_(
                                Flight.sportstracklive_upload_started_at.is_(None),
                                Flight.updated_at <= stale_upload_before,
                            ),
                        ),
                    ),
                ),
            )
            .update(
                {
                    Flight.sportstracklive_status: "uploading",
                    Flight.sportstracklive_error: None,
                    Flight.sportstracklive_upload_started_at: now,
                    Flight.updated_at: now,
                },
                synchronize_session=False,
            )
        )
        if claimed == 0:
            db.rollback()
            current_flight = db.get(Flight, flight.id)
            if current_flight and current_flight.sportstracklive_status == "uploaded":
                detail = "Ce vol est déjà envoyé à SportsTrackLive."
            else:
                detail = "L'envoi de ce vol est déjà en cours."
            raise HTTPException(status_code=409, detail=detail)
        flight.sportstracklive_status = "uploading"
        flight.sportstracklive_error = None
        flight.sportstracklive_upload_started_at = datetime.utcnow()
        db.commit()

    else:
        flight.sportstracklive_status = "uploading"
        flight.sportstracklive_error = None
        db.commit()

    try:
        with gpx_path.open("rb") as gpx_file:
            response = requests.post(
                _UPLOAD_URL,
                headers={
                    "X-STL-Upload-key": upload_key,
                    "X-STL-Secret-Key": secret_key,
                },
                data={
                    "track[category_id]": "1",
                    "track[track_type]": "classic_track",
                    "track[time_zone]": "Europe/Paris",
                },
                files={
                    "track[imported_file]": (
                        gpx_path.name,
                        gpx_file,
                        "application/gpx+xml",
                    )
                },
                timeout=_UPLOAD_TIMEOUT_SECONDS,
            )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or not payload.get("success"):
            raise ValueError("SportsTrackLive n'a pas confirmé l'import du vol.")
        track_id = int(payload["track_id"])
    except requests.RequestException as exc:
        detail = "Échec de l'envoi vers SportsTrackLive. Vérifiez les clés et réessayez."
        flight.sportstracklive_status = "failed"
        flight.sportstracklive_error = detail
        flight.sportstracklive_upload_started_at = None
        db.commit()
        raise HTTPException(status_code=502, detail=detail) from exc
    except (ValueError, TypeError, requests.JSONDecodeError, KeyError):
        detail = "Réponse invalide de SportsTrackLive."
        flight.sportstracklive_status = "failed"
        flight.sportstracklive_error = detail
        flight.sportstracklive_upload_started_at = None
        db.commit()
        raise HTTPException(status_code=502, detail=detail) from None
    except Exception as exc:
        detail = "Échec inattendu de l'envoi vers SportsTrackLive. Réessayez."
        flight.sportstracklive_status = "failed"
        flight.sportstracklive_error = detail
        flight.sportstracklive_upload_started_at = None
        db.commit()
        raise HTTPException(status_code=502, detail=detail) from exc

    flight.sportstracklive_status = "uploaded"
    flight.sportstracklive_track_id = track_id
    flight.sportstracklive_error = None
    flight.sportstracklive_upload_started_at = None
    flight.sportstracklive_uploaded_at = datetime.utcnow()
    db.commit()
    return {
        "success": True,
        "track_id": flight.sportstracklive_track_id,
        "status": flight.sportstracklive_status,
    }


def auto_upload_flight(
    db: Session, flight: Flight, user_id: int, *, already_claimed: bool = False
) -> None:
    credential = db.get(SportstrackLiveCredential, user_id)
    if credential is None or not credential.auto_upload:
        if flight.sportstracklive_status in {"queued", "uploading"}:
            flight.sportstracklive_status = "failed"
            flight.sportstracklive_error = "L'envoi automatique a été désactivé avant l'envoi."
            flight.sportstracklive_upload_started_at = None
            db.commit()
        return
    if flight.sportstracklive_status == "uploaded":
        return
    try:
        upload_flight(db, flight, user_id, already_claimed=already_claimed)
    except HTTPException as exc:
        # Keep local GPX import successful; expose the failure on the flight.
        flight.sportstracklive_status = "failed"
        flight.sportstracklive_error = str(exc.detail)
        db.commit()


def _run_automatic_upload(flight_id: str, user_id: int) -> None:
    db = SessionLocal()
    try:
        claimed = (
            db.query(Flight)
            .filter(Flight.id == flight_id, Flight.sportstracklive_status == "queued")
            .update(
                {
                    Flight.sportstracklive_status: "uploading",
                    Flight.sportstracklive_upload_started_at: datetime.utcnow(),
                    Flight.updated_at: datetime.utcnow(),
                },
                synchronize_session=False,
            )
        )
        db.commit()
        if not claimed:
            return
        flight = db.get(Flight, flight_id)
        if flight is None:
            return
        try:
            auto_upload_flight(db, flight, user_id, already_claimed=True)
        except Exception:
            logger.exception(
                "Unexpected automatic SportsTrackLive upload failure for %s", flight_id
            )
            db.rollback()
            failed_flight = db.get(Flight, flight_id)
            if failed_flight is not None and failed_flight.sportstracklive_status == "uploading":
                failed_flight.sportstracklive_status = "failed"
                failed_flight.sportstracklive_error = (
                    "Échec inattendu de l'envoi automatique vers SportsTrackLive. Réessayez."
                )
                failed_flight.sportstracklive_upload_started_at = None
                db.commit()
    finally:
        db.close()


def launch_automatic_upload_worker(flight_id: str, user_id: int) -> None:
    task = asyncio.create_task(asyncio.to_thread(_run_automatic_upload, flight_id, user_id))
    _AUTOMATIC_UPLOAD_TASKS.add(task)
    task.add_done_callback(_AUTOMATIC_UPLOAD_TASKS.discard)


def mark_automatic_upload_queued(db: Session, flight: Flight, user_id: int) -> bool:
    credential = db.get(SportstrackLiveCredential, user_id)
    if credential is None or not credential.auto_upload:
        return False
    if flight.sportstracklive_status in {"queued", "uploading", "uploaded"}:
        return False
    flight.sportstracklive_status = "queued"
    flight.sportstracklive_error = None
    flight.sportstracklive_upload_started_at = None
    db.commit()
    return True


def queue_automatic_upload(
    db: Session,
    flight: Flight,
    user_id: int,
    background_tasks: BackgroundTasks,
) -> None:
    if mark_automatic_upload_queued(db, flight, user_id):
        background_tasks.add_task(_run_automatic_upload, flight.id, user_id)
