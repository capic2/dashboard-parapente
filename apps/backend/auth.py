"""
Authentication module: JWT tokens + password hashing.

Public routes don't need auth. All other /api routes require a valid JWT.
"""

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import config
from database import get_db
from models import User

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
ACCESS_TOKEN_PURPOSE = "access"
JOB_TOKEN_PURPOSES = {"video_export", "gopro_overlay"}
JOB_TOKEN_EXPIRE_HOURS = 12


def _extract_access_token(request: Request) -> str | None:
    """Read bearer token from Authorization header, auth cookie, or legacy query param."""
    auth_header = request.headers.get("authorization", "")
    scheme, _, value = auth_header.partition(" ")
    if scheme.lower() == "bearer":
        token = value.strip()
        if token:
            return token

    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        token = cookie_token.strip()
        if token:
            return token

    query_token = request.query_params.get("access_token")
    if query_token:
        token = query_token.strip()
        if token:
            return token

    return None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def create_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": email, "purpose": ACCESS_TOKEN_PURPOSE, "exp": expire},
        config.JWT_SECRET,
        algorithm=ALGORITHM,
    )


def create_job_token(
    *,
    purpose: str,
    job_id: str,
    flight_id: str | None = None,
) -> str:
    if purpose not in JOB_TOKEN_PURPOSES:
        raise ValueError("Unsupported job token purpose")

    expire = datetime.now(timezone.utc) + timedelta(hours=JOB_TOKEN_EXPIRE_HOURS)
    payload = {"purpose": purpose, "job_id": job_id, "exp": expire}
    if flight_id:
        payload["flight_id"] = flight_id
    return jwt.encode(payload, config.JWT_SECRET, algorithm=ALGORITHM)


def decode_job_token(token: str, *, purpose: str, job_id: str) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired job token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError as e:
        raise credentials_exception from e

    if payload.get("purpose") != purpose or payload.get("job_id") != job_id:
        raise credentials_exception
    return payload


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: decode JWT and return the authenticated User."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = _extract_access_token(request)
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if payload.get("purpose", ACCESS_TOKEN_PURPOSE) != ACCESS_TOKEN_PURPOSE or email is None:
            raise credentials_exception
    except JWTError as e:
        raise credentials_exception from e

    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Verify email + password, return User or None."""
    user = db.query(User).filter(User.email == email).first()
    if user and user.is_active and verify_password(password, user.hashed_password):
        return user
    return None


def seed_admin_user():
    """Create or update the admin user from env vars. Called at startup."""
    from database import SessionLocal

    if not config.ADMIN_EMAIL or not config.ADMIN_PASSWORD:
        logger.warning("ADMIN_EMAIL or ADMIN_PASSWORD not configured; skipping admin seed")
        return

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == config.ADMIN_EMAIL).first()
        if admin:
            # Update password if it changed
            if not verify_password(config.ADMIN_PASSWORD, admin.hashed_password):
                admin.hashed_password = hash_password(config.ADMIN_PASSWORD)
                admin.is_active = True
                db.commit()
                logger.info(f"Updated admin password for: {config.ADMIN_EMAIL}")
            return

        # No admin found — create if no users exist yet
        if db.query(User).count() > 0:
            return

        admin = User(
            email=config.ADMIN_EMAIL,
            hashed_password=hash_password(config.ADMIN_PASSWORD),
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.info(f"Seeded admin user: {config.ADMIN_EMAIL}")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed admin user: {e}")
    finally:
        db.close()
