"""
Authentication module: JWT tokens + password hashing.

Public routes don't need auth. All other /api routes require a valid JWT.
"""

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import config
from database import get_db
from models import User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def create_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": email, "exp": expire}, config.JWT_SECRET, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: decode JWT and return the authenticated User."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
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
