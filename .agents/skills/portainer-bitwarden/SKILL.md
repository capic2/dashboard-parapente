---
name: portainer-bitwarden
description: "Use Bitwarden to authenticate to the dashboard-parapente Portainer instance for read-only container, stack, and log diagnostics."
---

# Portainer via Bitwarden

Use this skill whenever the user asks to inspect the production Portainer deployment, Docker containers, workers, Redis, stacks, or logs.

## Authentication

- Synchronize Bitwarden before searching: `mcp__bitwarden__sync`.
- Use the exact Bitwarden item named `portainer`. Do not substitute `portainer2`, `.env pour portainer`, or an IP-address item.
- The item URI is `https://portainer.capic.ignorelist.com`.
- Read the API token from the item's login password (`mcp__bitwarden__get` with `object: "item"`). Never print, quote, log, or save the token in files.
- Authenticate Portainer API calls with `X-API-Key: <token>`.
- The Portainer local Docker endpoint is endpoint ID `2`; verify this with `GET /api/endpoints` before using it.

Example read-only API shape (the token stays in the environment and TLS verification remains enabled):

```bash
python3 - <<'PY'
import os
import urllib.request

request = urllib.request.Request(
    "https://portainer.capic.ignorelist.com/api/endpoints",
    headers={"X-API-Key": os.environ["PORTAINER_TOKEN"]},
)
with urllib.request.urlopen(request) as response:
    print(response.read().decode())
PY
```

## Diagnostics

For Docker inspection, use the Portainer proxy API under `/api/endpoints/2/docker/`:

- Containers: `GET /containers/json?all=1`
- Container details and environment: `GET /containers/{id}/json` (only report non-sensitive variables)
- Logs: `GET /containers/{id}/logs?stdout=1&stderr=1&timestamps=1&tail=200`

When diagnosing queues, check the relevant worker container and its logs. For this deployment, the main video worker is `parapente-backend-worker` and listens on `video_exports`; specialized workers listen on their own queues. Compare timestamps for enqueue, worker pickup, and completion rather than inferring execution from queue length alone: RQ removes a job from the queue when a worker reserves it.

## Safety

- Default to read-only calls. Do not restart containers, redeploy stacks, change environment variables, or mutate jobs unless the user explicitly asks.
- Redact credentials, API tokens, JWTs, secrets, and sensitive environment values from all output.
- If the exact `portainer` item is not returned, sync Bitwarden again and report that blocker; do not guess another credential or URL.
