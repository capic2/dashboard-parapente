"""Prometheus metrics for the backend API."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import FastAPI, HTTPException, Request, Response

from config import METRICS_TOKEN, TESTING

_LOCK = Lock()
_HISTOGRAM_BUCKETS = (0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10)

_COUNTER_DEFS = {
    "dashboard_app_info": {
        "help": "Static application info metric",
        "labels": ("project", "environment"),
    },
    "dashboard_http_requests_total": {
        "help": "Total HTTP requests handled by the API",
        "labels": ("method", "path", "status"),
    },
    "dashboard_metrics_requests_total": {
        "help": "Requests to the /metrics endpoint",
        "labels": ("status",),
    },
    "dashboard_cache_operations_total": {
        "help": "Cache operations by type and result",
        "labels": ("operation", "result"),
    },
    "dashboard_scheduler_runs_total": {
        "help": "Scheduler run outcomes",
        "labels": ("result",),
    },
    "dashboard_weather_fetch_total": {
        "help": "Weather fetch outcomes per site and day",
        "labels": ("site", "day", "result"),
    },
}

_HISTOGRAM_DEFS = {
    "dashboard_http_request_duration_seconds": {
        "help": "HTTP request duration in seconds",
        "labels": ("method", "path"),
        "buckets": _HISTOGRAM_BUCKETS,
    },
    "dashboard_cache_operation_duration_seconds": {
        "help": "Cache operation duration in seconds",
        "labels": ("operation",),
        "buckets": _HISTOGRAM_BUCKETS,
    },
    "dashboard_scheduler_run_duration_seconds": {
        "help": "Scheduler run duration in seconds",
        "labels": ("job",),
        "buckets": _HISTOGRAM_BUCKETS,
    },
    "dashboard_weather_fetch_duration_seconds": {
        "help": "Weather fetch duration in seconds",
        "labels": ("site",),
        "buckets": _HISTOGRAM_BUCKETS,
    },
}

_COUNTERS: dict[str, dict[tuple[tuple[str, str], ...], int]] = defaultdict(dict)
_HISTOGRAMS: dict[str, dict[tuple[tuple[str, str], ...], dict[str, object]]] = defaultdict(dict)


def _labels_key(labels: dict[str, str]) -> tuple[tuple[str, str], ...]:
    return tuple(sorted(labels.items()))


def _quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def _check_labels(metric_name: str, labels: dict[str, str]) -> None:
    expected = _COUNTER_DEFS.get(metric_name, {}).get("labels")
    if expected is None:
        expected = _HISTOGRAM_DEFS.get(metric_name, {}).get("labels")
    if tuple(labels.keys()) != tuple(expected):
        return


def inc_counter(metric_name: str, **labels: str) -> None:
    with _LOCK:
        _check_labels(metric_name, labels)
        key = _labels_key(labels)
        current = _COUNTERS[metric_name].get(key, 0)
        _COUNTERS[metric_name][key] = current + 1


def observe_histogram(metric_name: str, value: float, **labels: str) -> None:
    with _LOCK:
        _check_labels(metric_name, labels)
        key = _labels_key(labels)
        state = _HISTOGRAMS[metric_name].setdefault(
            key,
            {
                "buckets": [0] * len(_HISTOGRAM_BUCKETS),
                "count": 0,
                "sum": 0.0,
            },
        )

        state["count"] = int(state["count"]) + 1
        state["sum"] = float(state["sum"]) + value

        for index, bucket in enumerate(_HISTOGRAM_BUCKETS):
            if value <= bucket:
                state["buckets"][index] = int(state["buckets"][index]) + 1


def _render_labels(labels: tuple[tuple[str, str], ...]) -> str:
    if not labels:
        return ""
    rendered = ",".join(f'{name}="{_quote(value)}"' for name, value in labels)
    return f"{{{rendered}}}"


def render_metrics() -> str:
    lines: list[str] = []

    with _LOCK:
        lines.append('# HELP dashboard_app_info Static application info metric')
        lines.append('# TYPE dashboard_app_info gauge')
        lines.append('dashboard_app_info{project="dashboard-parapente",environment="prod"} 1')

        for metric_name, definition in _COUNTER_DEFS.items():
            if metric_name == "dashboard_app_info":
                continue
            lines.append(f"# HELP {metric_name} {definition['help']}")
            lines.append(f"# TYPE {metric_name} counter")
            for labels, value in sorted(_COUNTERS[metric_name].items()):
                lines.append(f"{metric_name}{_render_labels(labels)} {value}")

        for metric_name, definition in _HISTOGRAM_DEFS.items():
            lines.append(f"# HELP {metric_name} {definition['help']}")
            lines.append(f"# TYPE {metric_name} histogram")
            buckets = definition["buckets"]
            for labels, state in sorted(_HISTOGRAMS[metric_name].items()):
                bucket_counts = list(state["buckets"])
                for index, bucket in enumerate(buckets):
                    bucket_labels = dict(labels)
                    bucket_labels["le"] = str(bucket)
                    lines.append(
                        f"{metric_name}_bucket{_render_labels(_labels_key(bucket_labels))} {bucket_counts[index]}"
                    )

                bucket_labels = dict(labels)
                bucket_labels["le"] = "+Inf"
                lines.append(
                    f"{metric_name}_bucket{_render_labels(_labels_key(bucket_labels))} {int(state['count'])}"
                )
                lines.append(f"{metric_name}_sum{_render_labels(labels)} {float(state['sum'])}")
                lines.append(f"{metric_name}_count{_render_labels(labels)} {int(state['count'])}")

    return "\n".join(lines) + "\n"


def reset_metrics() -> None:
    with _LOCK:
        _COUNTERS.clear()
        _HISTOGRAMS.clear()


def inc_cache_operation(operation: str, result: str) -> None:
    inc_counter("dashboard_cache_operations_total", operation=operation, result=result)


def observe_cache_operation(operation: str, duration: float) -> None:
    observe_histogram("dashboard_cache_operation_duration_seconds", duration, operation=operation)


def inc_scheduler_run(result: str) -> None:
    inc_counter("dashboard_scheduler_runs_total", result=result)


def observe_scheduler_run(duration: float, job: str = "scheduled_weather_fetch") -> None:
    observe_histogram("dashboard_scheduler_run_duration_seconds", duration, job=job)


def inc_weather_fetch(site: str, day: int, result: str) -> None:
    inc_counter(
        "dashboard_weather_fetch_total",
        site=site,
        day=str(day),
        result=result,
    )


def observe_weather_fetch(site: str, duration: float) -> None:
    observe_histogram("dashboard_weather_fetch_duration_seconds", duration, site=site)


def _is_authorized(request: Request) -> bool:
    if TESTING or not METRICS_TOKEN:
        return True

    auth_header = request.headers.get("authorization", "")
    expected = f"Bearer {METRICS_TOKEN}"
    return auth_header == expected


def _route_path(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path:
        return route_path
    return request.url.path


def setup_metrics(app: FastAPI) -> None:
    @app.middleware("http")
    async def record_http_metrics(request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        inc_counter(
            "dashboard_http_requests_total",
            method=request.method,
            path=_route_path(request),
            status=str(response.status_code),
        )
        observe_histogram(
            "dashboard_http_request_duration_seconds",
            duration,
            method=request.method,
            path=_route_path(request),
        )

        return response

    @app.get("/metrics")
    async def metrics(request: Request) -> Response:
        if not _is_authorized(request):
            inc_counter("dashboard_metrics_requests_total", status="unauthorized")
            raise HTTPException(status_code=401, detail="Unauthorized")

        inc_counter("dashboard_metrics_requests_total", status="ok")
        return Response(render_metrics(), media_type="text/plain; version=0.0.4")
