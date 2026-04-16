"""Tests for authentication module: seed_admin_user, authenticate_user."""

import os
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["TESTING"] = "true"
os.environ["BACKEND_USE_FAKE_REDIS"] = "true"
os.environ["BACKEND_WEATHERAPI_KEY"] = "test_weather_key"
os.environ["BACKEND_METEOBLUE_API_KEY"] = "test_meteoblue_key"

from database import Base
from models import User
from auth import hash_password, verify_password, seed_admin_user, authenticate_user
import config


@pytest.fixture()
def db_engine():
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture()
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def patch_session(db_engine, monkeypatch):
    """Patch database.SessionLocal so seed_admin_user uses test DB."""
    Session = sessionmaker(bind=db_engine)
    monkeypatch.setattr("database.SessionLocal", Session)
    return Session


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("secret123")
        assert verify_password("secret123", hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("secret123")
        assert not verify_password("wrong", hashed)


class TestSeedAdminUser:
    def test_creates_admin_when_no_users(self, patch_session, monkeypatch):
        monkeypatch.setattr(config, "ADMIN_EMAIL", "admin@test.com")
        monkeypatch.setattr(config, "ADMIN_PASSWORD", "pass123")

        seed_admin_user()

        session = patch_session()
        user = session.query(User).filter(User.email == "admin@test.com").first()
        assert user is not None
        assert user.is_active is True
        assert verify_password("pass123", user.hashed_password)
        session.close()

    def test_updates_password_when_changed(self, patch_session, monkeypatch):
        monkeypatch.setattr(config, "ADMIN_EMAIL", "admin@test.com")
        monkeypatch.setattr(config, "ADMIN_PASSWORD", "old_password")

        seed_admin_user()

        # Change password in config and re-seed
        monkeypatch.setattr(config, "ADMIN_PASSWORD", "new_password")
        seed_admin_user()

        session = patch_session()
        user = session.query(User).filter(User.email == "admin@test.com").first()
        assert verify_password("new_password", user.hashed_password)
        assert not verify_password("old_password", user.hashed_password)
        session.close()

    def test_no_update_when_password_unchanged(self, patch_session, monkeypatch):
        monkeypatch.setattr(config, "ADMIN_EMAIL", "admin@test.com")
        monkeypatch.setattr(config, "ADMIN_PASSWORD", "same_pass")

        seed_admin_user()

        session = patch_session()
        user = session.query(User).filter(User.email == "admin@test.com").first()
        original_hash = user.hashed_password
        session.close()

        # Re-seed with same password
        seed_admin_user()

        session = patch_session()
        user = session.query(User).filter(User.email == "admin@test.com").first()
        assert user.hashed_password == original_hash
        session.close()

    def test_skips_when_other_users_exist_and_no_admin(
        self, patch_session, db_session, monkeypatch
    ):
        monkeypatch.setattr(config, "ADMIN_EMAIL", "admin@test.com")
        monkeypatch.setattr(config, "ADMIN_PASSWORD", "pass")

        # Create a non-admin user first
        other = User(email="other@test.com", hashed_password=hash_password("x"), is_active=True)
        db_session.add(other)
        db_session.commit()

        seed_admin_user()

        session = patch_session()
        admin = session.query(User).filter(User.email == "admin@test.com").first()
        assert admin is None
        session.close()

    def test_skips_when_no_credentials(self, patch_session, monkeypatch):
        monkeypatch.setattr(config, "ADMIN_EMAIL", "")
        monkeypatch.setattr(config, "ADMIN_PASSWORD", "")

        seed_admin_user()

        session = patch_session()
        assert session.query(User).count() == 0
        session.close()


class TestAuthenticateUser:
    def test_valid_credentials(self, db_session):
        user = User(email="user@test.com", hashed_password=hash_password("mypass"), is_active=True)
        db_session.add(user)
        db_session.commit()

        result = authenticate_user(db_session, "user@test.com", "mypass")
        assert result is not None
        assert result.email == "user@test.com"

    def test_wrong_password(self, db_session):
        user = User(email="user@test.com", hashed_password=hash_password("mypass"), is_active=True)
        db_session.add(user)
        db_session.commit()

        result = authenticate_user(db_session, "user@test.com", "wrong")
        assert result is None

    def test_inactive_user(self, db_session):
        user = User(email="user@test.com", hashed_password=hash_password("mypass"), is_active=False)
        db_session.add(user)
        db_session.commit()

        result = authenticate_user(db_session, "user@test.com", "mypass")
        assert result is None

    def test_unknown_email(self, db_session):
        result = authenticate_user(db_session, "nobody@test.com", "pass")
        assert result is None
