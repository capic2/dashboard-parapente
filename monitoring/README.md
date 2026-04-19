# Monitoring stack

Stack reusable for multiple projects in Portainer.

## Services

- Grafana
- Prometheus
- Alertmanager
- Loki
- Promtail
- node_exporter
- cAdvisor

## App connection

1. Add `BACKEND_METRICS_TOKEN` to the app stack.
2. Add the same `MONITORING_METRICS_TOKEN` to this stack.
3. Add one file per app in `monitoring/prometheus/targets/`.
4. Expose `/metrics` in the app.

## Access

- Grafana: `http://localhost:3000` from the host.
- Prometheus: `http://localhost:9090` from the host.
- Loki: `http://localhost:3100` from the host.

These ports are bound to `127.0.0.1` only.
