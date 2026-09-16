from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import auth


def _request(host: str) -> Request:
    return Request({"type": "http", "headers": [(b"host", host.encode())], "query_string": b""})


def test_internal_staging_auto_login_only_applies_to_the_configured_origin(monkeypatch):
    user = Mock(is_active=True)
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = user
    monkeypatch.setattr(auth.config, "ENVIRONMENT", "staging")
    monkeypatch.setattr(auth.config, "INTERNAL_STAGING_AUTO_LOGIN_HOST", "192.168.1.106:18001")
    monkeypatch.setattr(auth.config, "ADMIN_EMAIL", "admin@example.test")

    assert auth.get_current_user(_request("192.168.1.106:18001"), db) is user

    with pytest.raises(HTTPException, match="Invalid or expired token"):
        auth.get_current_user(_request("dashboard.capic.ignorelist.com"), db)
