"""Deployment drain state and atomic job admission coordination."""

from __future__ import annotations

import json
import logging
import math
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Any

import config
from job_queue import get_redis_connection

_STATE_KEY = "{deployment-drain}:state"
_ADMISSIONS_KEY = "{deployment-drain}:admissions"
logger = logging.getLogger(__name__)

_ADMIT_SCRIPT = """
redis.call('zremrangebyscore', KEYS[2], '-inf', ARGV[2])
if redis.call('exists', KEYS[1]) == 1 then
  return -1
end
redis.call('zadd', KEYS[2], ARGV[3], ARGV[1])
return redis.call('zcard', KEYS[2])
"""

_RELEASE_ADMISSION_SCRIPT = """
return redis.call('zrem', KEYS[1], ARGV[1])
"""

_RENEW_ADMISSION_SCRIPT = """
if redis.call('zscore', KEYS[1], ARGV[1]) then
  redis.call('zadd', KEYS[1], ARGV[2], ARGV[1])
  return 1
end
return 0
"""

_COUNT_ADMISSIONS_SCRIPT = """
redis.call('zremrangebyscore', KEYS[1], '-inf', ARGV[1])
return redis.call('zcard', KEYS[1])
"""

_BEGIN_SCRIPT = """
local current = redis.call('get', KEYS[1])
if current then
  return current
end
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
return ARGV[1]
"""

_MARK_SCRIPT = """
local current = redis.call('get', KEYS[1])
if not current then
  return 0
end
local state = cjson.decode(current)
if state.deployment_id ~= ARGV[1] then
  return -1
end
state.phase = 'deploying'
state.phase_changed_at = ARGV[2]
local ttl = redis.call('ttl', KEYS[1])
if ttl <= 0 then
  return 0
end
redis.call('set', KEYS[1], cjson.encode(state), 'EX', ttl)
return 1
"""

_RENEW_SCRIPT = """
local current = redis.call('get', KEYS[1])
if not current then
  return 0
end
local state = cjson.decode(current)
if state.deployment_id ~= ARGV[1] then
  return -1
end
state.expires_at = ARGV[2]
redis.call('set', KEYS[1], cjson.encode(state), 'EX', ARGV[3])
return cjson.encode(state)
"""

_RELEASE_SCRIPT = """
local current = redis.call('get', KEYS[1])
if not current then
  return 0
end
local state = cjson.decode(current)
if state.deployment_id ~= ARGV[1] then
  return -1
end
redis.call('del', KEYS[1])
return 1
"""


class DeploymentDrainError(Exception):
    """Base deployment drain domain error."""


class DeploymentDrainActive(DeploymentDrainError):
    """Raised when a deployment drain blocks a new job admission."""


class DeploymentDrainConflict(DeploymentDrainError):
    """Raised when another deployment owns the active drain."""


class DeploymentDrainNotFound(DeploymentDrainError):
    """Raised when no matching drain exists."""


def _active_drain_message() -> str:
    lease_minutes = max(1, math.ceil(config.DEPLOY_DRAIN_LEASE_SECONDS / 60))
    return (
        "A deployment is draining jobs; retry after it completes "
        f"(the safety lease expires within {lease_minutes} minutes)"
    )


class DeploymentDrainService:
    """Coordinate drain ownership and admissions across API processes."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._admission_depth: ContextVar[int] = ContextVar("deployment_admission_depth", default=0)
        self._memory_state: dict[str, Any] | None = None
        self._memory_admissions = 0

    @property
    def _use_memory(self) -> bool:
        return config.IS_TEST_ENV or config.USE_FAKE_REDIS

    def _clear_expired_memory_state(self) -> None:
        if self._memory_state is None:
            return
        expires_at = datetime.fromisoformat(self._memory_state["expires_at"])
        if expires_at <= datetime.now(timezone.utc):
            self._memory_state = None

    def get_state(self) -> dict[str, Any] | None:
        if self._use_memory:
            with self._lock:
                self._clear_expired_memory_state()
                return self._memory_state.copy() if self._memory_state else None

        raw = get_redis_connection().get(_STATE_KEY)
        if raw is None:
            return None
        return json.loads(raw)

    def admissions_in_progress(self) -> int:
        if self._use_memory:
            with self._lock:
                return self._memory_admissions
        return int(
            get_redis_connection().eval(
                _COUNT_ADMISSIONS_SCRIPT,
                1,
                _ADMISSIONS_KEY,
                time.time(),
            )
        )

    def begin(self, deployment_id: str, target_version: str, run_url: str) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        state = {
            "phase": "waiting",
            "deployment_id": deployment_id,
            "target_version": target_version,
            "run_url": run_url,
            "requested_at": now.isoformat(),
            "phase_changed_at": now.isoformat(),
            "expires_at": (now + timedelta(seconds=config.DEPLOY_DRAIN_LEASE_SECONDS)).isoformat(),
        }

        if self._use_memory:
            with self._lock:
                self._clear_expired_memory_state()
                if self._memory_state is None:
                    self._memory_state = state
                current = self._memory_state.copy()
        else:
            raw = get_redis_connection().eval(
                _BEGIN_SCRIPT,
                1,
                _STATE_KEY,
                json.dumps(state),
                config.DEPLOY_DRAIN_LEASE_SECONDS,
            )
            current = json.loads(raw)

        if current["deployment_id"] != deployment_id:
            raise DeploymentDrainConflict(
                f"Deployment drain is already owned by {current['deployment_id']}"
            )
        return self.get_owned(deployment_id)

    def get_owned(self, deployment_id: str) -> dict[str, Any]:
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=config.DEPLOY_DRAIN_LEASE_SECONDS)
        ).isoformat()
        if self._use_memory:
            with self._lock:
                self._clear_expired_memory_state()
                if self._memory_state is None:
                    raise DeploymentDrainNotFound("Deployment drain not found")
                if self._memory_state["deployment_id"] != deployment_id:
                    raise DeploymentDrainConflict("Deployment drain is owned by another deployment")
                self._memory_state["expires_at"] = expires_at
                return self._memory_state.copy()

        raw = get_redis_connection().eval(
            _RENEW_SCRIPT,
            1,
            _STATE_KEY,
            deployment_id,
            expires_at,
            config.DEPLOY_DRAIN_LEASE_SECONDS,
        )
        if raw == 0:
            raise DeploymentDrainNotFound("Deployment drain not found")
        if raw == -1:
            raise DeploymentDrainConflict("Deployment drain is owned by another deployment")
        return json.loads(raw)

    def mark_deploying(self, deployment_id: str) -> dict[str, Any]:
        if self._use_memory:
            with self._lock:
                self._clear_expired_memory_state()
                if self._memory_state is None:
                    raise DeploymentDrainNotFound("Deployment drain not found")
                if self._memory_state["deployment_id"] != deployment_id:
                    raise DeploymentDrainConflict("Deployment drain is owned by another deployment")
                self._memory_state["phase"] = "deploying"
                self._memory_state["phase_changed_at"] = datetime.now(timezone.utc).isoformat()
                return self._memory_state.copy()

        result = int(
            get_redis_connection().eval(
                _MARK_SCRIPT,
                1,
                _STATE_KEY,
                deployment_id,
                datetime.now(timezone.utc).isoformat(),
            )
        )
        if result == 0:
            raise DeploymentDrainNotFound("Deployment drain not found")
        if result == -1:
            raise DeploymentDrainConflict("Deployment drain is owned by another deployment")
        return self.get_owned(deployment_id)

    def release(self, deployment_id: str) -> None:
        if self._use_memory:
            with self._lock:
                self._clear_expired_memory_state()
                if self._memory_state is None:
                    raise DeploymentDrainNotFound("Deployment drain not found")
                if self._memory_state["deployment_id"] != deployment_id:
                    raise DeploymentDrainConflict("Deployment drain is owned by another deployment")
                self._memory_state = None
                return

        result = int(get_redis_connection().eval(_RELEASE_SCRIPT, 1, _STATE_KEY, deployment_id))
        if result == 0:
            raise DeploymentDrainNotFound("Deployment drain not found")
        if result == -1:
            raise DeploymentDrainConflict("Deployment drain is owned by another deployment")

    @contextmanager
    def admission(self) -> Iterator[None]:
        depth = self._admission_depth.get()
        if depth:
            token = self._admission_depth.set(depth + 1)
            try:
                yield
            finally:
                self._admission_depth.reset(token)
            return

        if self._use_memory:
            with self._lock:
                self._clear_expired_memory_state()
                if self._memory_state is not None:
                    raise DeploymentDrainActive(_active_drain_message())
                self._memory_admissions += 1
            token = self._admission_depth.set(1)
            try:
                yield
            finally:
                self._admission_depth.reset(token)
                with self._lock:
                    self._memory_admissions = max(0, self._memory_admissions - 1)
            return

        redis = get_redis_connection()
        admission_token = str(uuid.uuid4())
        admission_expires_at = time.time() + config.DEPLOY_DRAIN_LEASE_SECONDS
        admitted = int(
            redis.eval(
                _ADMIT_SCRIPT,
                2,
                _STATE_KEY,
                _ADMISSIONS_KEY,
                admission_token,
                time.time(),
                admission_expires_at,
            )
        )
        if admitted == -1:
            raise DeploymentDrainActive(_active_drain_message())

        stop_renewal = threading.Event()

        def renew_admission() -> None:
            interval = max(1, config.DEPLOY_DRAIN_LEASE_SECONDS / 3)
            while not stop_renewal.wait(interval):
                try:
                    renewed = redis.eval(
                        _RENEW_ADMISSION_SCRIPT,
                        1,
                        _ADMISSIONS_KEY,
                        admission_token,
                        time.time() + config.DEPLOY_DRAIN_LEASE_SECONDS,
                    )
                    if not renewed:
                        return
                except Exception:
                    logger.error("Could not renew deployment admission lease", exc_info=True)
                    return

        renewal_thread = threading.Thread(target=renew_admission, daemon=True)
        renewal_thread.start()
        token = self._admission_depth.set(1)
        try:
            yield
        finally:
            self._admission_depth.reset(token)
            stop_renewal.set()
            renewal_thread.join(timeout=1)
            redis.eval(
                _RELEASE_ADMISSION_SCRIPT,
                1,
                _ADMISSIONS_KEY,
                admission_token,
            )

    def reset_for_tests(self) -> None:
        """Reset process-local state between tests."""
        with self._lock:
            self._memory_state = None
            self._memory_admissions = 0


deployment_drain = DeploymentDrainService()


def job_admission() -> Iterator[None]:
    """Return the shared synchronous admission context manager."""
    return deployment_drain.admission()
