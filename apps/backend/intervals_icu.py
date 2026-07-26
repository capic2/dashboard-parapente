from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx

MAX_ACTIVITY_FILE_BYTES = 50 * 1024 * 1024
MAX_ACTIVITY_LIST_BYTES = 5 * 1024 * 1024
PARIS_TIME_ZONE = ZoneInfo("Europe/Paris")


class IntervalsError(Exception):
    """Base error for actionable Intervals.icu failures."""


class IntervalsConfigurationError(IntervalsError):
    pass


class IntervalsAuthenticationError(IntervalsError):
    pass


class IntervalsRateLimitError(IntervalsError):
    pass


class IntervalsTransportError(IntervalsError):
    pass


class IntervalsResponseError(IntervalsError):
    pass


@dataclass(frozen=True, slots=True)
class ExternalActivity:
    id: str
    name: str
    start_date: datetime
    activity_type: str
    source: str
    file_type: str
    external_url: str | None


def _activity_from_json(payload: dict[str, Any]) -> ExternalActivity:
    activity_id = str(payload.get("id") or "").strip()
    local_start = payload.get("start_date_local")
    start_value = local_start or payload.get("start_date")
    if not activity_id or not isinstance(start_value, str):
        raise IntervalsResponseError("Intervals.icu returned activity data without an id or date.")
    try:
        start_date = datetime.fromisoformat(start_value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise IntervalsResponseError("Intervals.icu returned an invalid activity date.") from exc

    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=PARIS_TIME_ZONE)
    else:
        start_date = start_date.astimezone(PARIS_TIME_ZONE)

    return ExternalActivity(
        id=activity_id,
        name=str(payload.get("name") or f"Intervals activity {activity_id}"),
        start_date=start_date,
        activity_type=str(payload.get("type") or ""),
        source=str(payload.get("source") or ""),
        file_type=str(
            payload.get("file_type")
            or payload.get("icu_original_file_type")
            or payload.get("original_file_type")
            or ""
        ),
        external_url=(
            str(payload["external_url"])
            if payload.get("external_url")
            else f"https://intervals.icu/activities/{activity_id}"
        ),
    )


class IntervalsClient:
    def __init__(
        self,
        api_key: str | None,
        base_url: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = client

    def _auth(self) -> httpx.BasicAuth:
        if not self.api_key:
            raise IntervalsConfigurationError("BACKEND_INTERVALS_ICU_API_KEY is not configured.")
        return httpx.BasicAuth("API_KEY", self.api_key)

    @staticmethod
    def _raise_for_response(response: httpx.Response) -> None:
        if response.status_code in {401, 403}:
            raise IntervalsAuthenticationError("Intervals.icu rejected the configured API key.")
        if response.status_code == 429:
            raise IntervalsRateLimitError("Intervals.icu rate limit reached. Try again later.")
        if response.is_error:
            raise IntervalsResponseError(
                f"Intervals.icu request failed with HTTP {response.status_code}."
            )

    async def _get(self, path: str, *, params: dict[str, str] | None = None) -> httpx.Response:
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=30.0)
        try:
            response = await client.get(
                f"{self.base_url}/{path.lstrip('/')}", params=params, auth=self._auth()
            )
        except httpx.RequestError as exc:
            raise IntervalsTransportError("Intervals.icu is currently unreachable.") from exc
        finally:
            if owns_client:
                await client.aclose()

        self._raise_for_response(response)
        return response

    async def list_activities(
        self, date_from: date, date_to: date, allowed_types: list[str]
    ) -> list[ExternalActivity]:
        response = await self._get(
            "athlete/0/activities",
            params={"oldest": date_from.isoformat(), "newest": date_to.isoformat()},
        )
        try:
            if len(response.content) > MAX_ACTIVITY_LIST_BYTES:
                raise IntervalsResponseError("Intervals.icu activities response exceeds 5 MB.")
            payload = response.json()
        except ValueError as exc:
            raise IntervalsResponseError("Intervals.icu returned invalid JSON.") from exc
        if not isinstance(payload, list):
            raise IntervalsResponseError("Intervals.icu returned an unexpected activities payload.")

        allowed = set(allowed_types)
        activities = [
            _activity_from_json(item)
            for item in payload
            if isinstance(item, dict)
            and item.get("source") == "ZEPP"
            and (not allowed or item.get("type") in allowed)
        ]
        return sorted(activities, key=lambda activity: (activity.start_date, activity.id))

    async def download_original(self, activity_id: str) -> bytes:
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=30.0)
        try:
            async with client.stream(
                "GET",
                f"{self.base_url}/activity/{quote(activity_id, safe='')}/file",
                auth=self._auth(),
            ) as response:
                self._raise_for_response(response)
                content_length = response.headers.get("content-length")
                if content_length:
                    try:
                        exceeds_limit = int(content_length) > MAX_ACTIVITY_FILE_BYTES
                    except ValueError:
                        exceeds_limit = False
                    if exceeds_limit:
                        raise IntervalsResponseError("Intervals.icu activity file exceeds 50 MB.")
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > MAX_ACTIVITY_FILE_BYTES:
                        raise IntervalsResponseError("Intervals.icu activity file exceeds 50 MB.")
                return bytes(content)
        except httpx.RequestError as exc:
            raise IntervalsTransportError("Intervals.icu is currently unreachable.") from exc
        finally:
            if owns_client:
                await client.aclose()
