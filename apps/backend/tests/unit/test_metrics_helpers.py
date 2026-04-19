"""Tests for backend metrics helpers."""

from metrics import (
    inc_scheduler_run,
    inc_weather_fetch,
    observe_scheduler_run,
    observe_weather_fetch,
    render_metrics,
    reset_metrics,
)


def test_scheduler_and_weather_metrics_render():
    reset_metrics()

    inc_scheduler_run("success")
    observe_scheduler_run(1.25)
    inc_weather_fetch("site-arguel", 0, "success")
    observe_weather_fetch("site-arguel", 0.42)

    metrics_text = render_metrics()

    assert 'dashboard_scheduler_runs_total{result="success"} 1' in metrics_text
    assert (
        'dashboard_weather_fetch_total{day="0",result="success",site="site-arguel"} 1'
        in metrics_text
    )
    assert (
        'dashboard_scheduler_run_duration_seconds_count{job="scheduled_weather_fetch"} 1'
        in metrics_text
    )
    assert (
        'dashboard_weather_fetch_duration_seconds_count{site="site-arguel"} 1'
        in metrics_text
    )
