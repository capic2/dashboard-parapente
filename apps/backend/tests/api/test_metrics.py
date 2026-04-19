"""Tests for backend Prometheus metrics."""


def test_metrics_endpoint_requires_token_when_configured(client, monkeypatch):
    import metrics

    monkeypatch.setattr(metrics, "METRICS_TOKEN", "metrics-secret")
    monkeypatch.setattr(metrics, "TESTING", False)

    response = client.get("/metrics")
    assert response.status_code == 401

    authorized = client.get(
        "/metrics",
        headers={"Authorization": "Bearer metrics-secret"},
    )
    assert authorized.status_code == 200
    assert "text/plain" in authorized.headers["content-type"]
    assert "dashboard_http_requests_total" in authorized.text


def test_metrics_endpoint_records_http_requests(client):
    response = client.get("/api/weather/non-existent-spot")
    assert response.status_code == 404

    metrics_response = client.get("/metrics")
    assert metrics_response.status_code == 200
    assert (
        'dashboard_http_requests_total{method="GET",path="/api/weather/{spot_id}",status="404"}'
        in metrics_response.text
    )
