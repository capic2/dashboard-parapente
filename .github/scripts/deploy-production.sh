set -eu

DEPLOY_PATH="$REQUESTED_DEPLOY_PATH"
STACK_ID=""
PORTAINER_VOLUME=""

if [ -z "$GHCR_TOKEN" ]; then
  echo "Missing GHCR_READ_TOKEN secret for production image pull"
  exit 1
fi

is_forbidden_deploy_path() {
  path="$1"
  case "$path" in
    .codenomad|.codenomad/*|*/.codenomad|*/.codenomad/*|.agents|.agents/*|*/.agents|*/.agents/*|.opencode|.opencode/*|*/.opencode|*/.opencode/*)
      return 0
      ;;
  esac

  return 1
}

set_portainer_volume() {
  for volume_name in portainer_data portainer; do
    if docker volume inspect "$volume_name" >/dev/null 2>&1; then
      PORTAINER_VOLUME="$volume_name"
      return 0
    fi
  done

  return 1
}

resolve_from_portainer_volume() {
  if ! set_portainer_volume; then
    return 1
  fi

  STACK_ID=$(docker run --rm \
    -v "$PORTAINER_VOLUME:/data" \
    docker:27-cli sh -ceu '
      for compose_file in /data/compose/*/docker-compose.yml /data/compose/*/compose.yml; do
        [ -f "$compose_file" ] || continue
        if grep -q "dashboard-parapente" "$compose_file" || grep -q "parapente-backend" "$compose_file"; then
          basename "$(dirname "$compose_file")"
          exit 0
        fi
      done
    ' 2>/dev/null || true)

  if [ -n "$STACK_ID" ]; then
    echo "Resolved Portainer stack id from volume $PORTAINER_VOLUME: $STACK_ID"
    return 0
  fi

  return 1
}

configure_compose_cmd() {
  compose_files="-f docker-compose.yml"
  if [ "$NVIDIA_GPU_ENABLED" = "true" ] && [ -f docker-compose.gpu.yml ]; then
    compose_files="$compose_files -f docker-compose.gpu.yml"
    echo "Using GPU compose override"
  fi

  if [ -f stack.env ]; then
    compose_cmd() { docker compose -p "$COMPOSE_PROJECT_NAME" $compose_files --env-file stack.env "$@"; }
    echo "Using stack.env for docker compose"
  elif [ -f .env ]; then
    compose_cmd() { docker compose -p "$COMPOSE_PROJECT_NAME" $compose_files --env-file .env "$@"; }
    echo "Using .env for docker compose"
  else
    compose_cmd() { docker compose -p "$COMPOSE_PROJECT_NAME" $compose_files "$@"; }
    echo "No env file found (stack.env/.env), using shell environment"
  fi
}

print_backend_diagnostics() {
  echo "Backend deployment diagnostics"
  docker ps -a \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" || true

  for container_name in \
    parapente-backend \
    parapente-backend-worker \
    parapente-highlight-video-worker \
    parapente-youtube-upload-worker \
    parapente-gopro-overlay-worker \
    parapente-gopro-preview-worker \
    parapente-redis; do
    if ! docker inspect "$container_name" >/dev/null 2>&1; then
      continue
    fi

    echo "Container state: $container_name"
    docker inspect \
      --format 'status={{.State.Status}} exit_code={{.State.ExitCode}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
      "$container_name" || true
  done

  echo "Recent backend logs"
  docker logs --tail 200 parapente-backend 2>&1 || true
  echo "Recent YouTube upload worker logs"
  docker logs --tail 200 parapente-youtube-upload-worker 2>&1 || true
  echo "Recent GoPro overlay worker logs"
  docker logs --tail 200 parapente-gopro-overlay-worker 2>&1 || true
  echo "Recent GoPro preview worker logs"
  docker logs --tail 200 parapente-gopro-preview-worker 2>&1 || true
  echo "Recent backend worker logs"
  docker logs --tail 200 parapente-backend-worker 2>&1 || true
  echo "Recent highlight video worker logs"
  docker logs --tail 200 parapente-highlight-video-worker 2>&1 || true
}

verify_gpu_prerequisites() {
  [ "$NVIDIA_GPU_ENABLED" = "true" ] || return 0
  echo "Verifying NVIDIA Docker runtime before replacing production containers"
  if ! docker info --format '{{json .Runtimes}}' | grep -q '"nvidia"'; then
    echo "NVIDIA runtime is not registered in Docker; falling back to CPU deployment"
    export NVIDIA_GPU_ENABLED=false BACKEND_VIDEO_ACCELERATOR=cpu
    compose_files="-f docker-compose.yml"
    return 0
  fi
  if ! docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu24.04 nvidia-smi -L; then
    echo "NVIDIA GPU preflight failed; falling back to CPU deployment"
    export NVIDIA_GPU_ENABLED=false BACKEND_VIDEO_ACCELERATOR=cpu
    compose_files="-f docker-compose.yml"
    return 0
  fi
}

verify_workers_started() {
  attempts=1
  while [ "$attempts" -le "$LOCAL_VERIFY_MAX_ATTEMPTS" ]; do
    failed=0
    for container_name in parapente-backend parapente-backend-worker parapente-highlight-video-worker parapente-youtube-upload-worker parapente-gopro-overlay-worker parapente-gopro-preview-worker parapente-redis; do
      state=$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null || true)
      health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || true)
      if [ "$state" != "running" ] || [ "$health" != "healthy" ]; then
        failed=1
      fi
    done
    for worker_log in parapente-backend-worker parapente-highlight-video-worker parapente-gopro-overlay-worker parapente-gopro-preview-worker parapente-youtube-upload-worker; do
      if ! docker logs "$worker_log" 2>&1 | grep -q "Listening on"; then
        failed=1
      fi
    done
    if [ "$NVIDIA_GPU_ENABLED" = "true" ]; then
      gpu_devices=$(docker inspect --format '{{json .HostConfig.DeviceRequests}}' parapente-gopro-overlay-worker 2>/dev/null || true)
      gpu_accelerator=$(docker inspect --format "{{range .Config.Env}}{{println .}}{{end}}" parapente-gopro-overlay-worker 2>/dev/null | grep "^BACKEND_VIDEO_ACCELERATOR=" || true)
      if ! echo "$gpu_devices" | grep -q "\"Driver\":\"nvidia\"" || [ "$gpu_accelerator" != "BACKEND_VIDEO_ACCELERATOR=nvidia" ]; then
        echo "GoPro worker was started without the requested NVIDIA device"
        failed=1
      fi
    fi
    if [ "$failed" -eq 0 ]; then
      echo "Production backend and all RQ workers are running"
      return 0
    fi
    echo "Worker readiness check attempt $attempts/$LOCAL_VERIFY_MAX_ATTEMPTS failed"
    [ "$attempts" -lt "$LOCAL_VERIFY_MAX_ATTEMPTS" ] && sleep "$LOCAL_VERIFY_SLEEP_SECONDS"
    attempts=$((attempts + 1))
  done
  echo "Production worker readiness verification failed"
  return 1
}

describe_version_response() {
  response_file="$1"
  if ! docker run --rm -i --entrypoint python "$BACKEND_IMAGE" -c '
import hashlib
import json
import re
import sys

body = sys.stdin.buffer.read()
print(f"response_bytes={len(body)} response_sha256={hashlib.sha256(body).hexdigest()}")
try:
    payload = json.loads(body)
except (json.JSONDecodeError, UnicodeDecodeError):
    text = body.decode("utf-8", errors="replace")
    title = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
    if title:
        normalized_title = " ".join(title.group(1).split())[:200]
        print(f"response_kind=html title={normalized_title}")
    else:
        print("response_kind=non_json")
else:
    if isinstance(payload, dict):
        keys = json.dumps(sorted(str(key) for key in payload))
        version = json.dumps(str(payload.get("version", "")))
        print(f"response_kind=json_object keys={keys} version={version}")
    else:
        print(f"response_kind=json_{type(payload).__name__}")
' < "$response_file"; then
    echo "response_parser=failed"
  fi
}

verify_local_backend_version() {
  endpoint="http://127.0.0.1:8001/api/version"
  case "$LOCAL_VERIFY_MAX_ATTEMPTS" in
    ''|*[!0-9]*|0)
      echo "DEPLOY_LOCAL_VERIFY_MAX_ATTEMPTS must be a positive integer"
      return 1
      ;;
  esac
  case "$LOCAL_VERIFY_SLEEP_SECONDS" in
    ''|*[!0-9]*|0)
      echo "DEPLOY_LOCAL_VERIFY_SLEEP_SECONDS must be a positive integer"
      return 1
      ;;
  esac

  response_file=$(mktemp)
  headers_file=$(mktemp)
  error_file=$(mktemp)

  attempt=1
  while [ "$attempt" -le "$LOCAL_VERIFY_MAX_ATTEMPTS" ]; do
    if http_status=$(curl --silent --show-error --location \
      --connect-timeout 5 --max-time 10 \
      --header 'Accept: application/json' \
      --header 'Cache-Control: no-cache' \
      --output "$response_file" \
      --dump-header "$headers_file" \
      --write-out '%{http_code}' \
      "$endpoint" 2>"$error_file"); then
      curl_status=0
    else
      curl_status=$?
    fi

    content_type=$(awk 'tolower($0) ~ /^content-type:/ { value=$0 } END { sub(/^[^:]*:[[:space:]]*/, "", value); sub(/\r$/, "", value); print value }' "$headers_file")
    if deployed_version=$(docker run --rm -i --entrypoint python "$BACKEND_IMAGE" -c 'import json, re, sys; payload = json.load(sys.stdin); version = payload.get("version", "") if isinstance(payload, dict) else ""; print(version if isinstance(version, str) and re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", version) else "")' < "$response_file" 2>/dev/null); then
      parser_status=0
    else
      parser_status=$?
      deployed_version=""
    fi

    if [ "$curl_status" -eq 0 ] && [ "$http_status" -ge 200 ] && [ "$http_status" -lt 300 ] && [ "$deployed_version" = "$TARGET_VERSION" ]; then
      echo "Local backend version verified: $deployed_version"
      rm -f "$response_file" "$headers_file" "$error_file"
      return 0
    fi

    curl_error=$(tr -d '\n' < "$error_file")
    echo "Local version check attempt $attempt/$LOCAL_VERIFY_MAX_ATTEMPTS: curl_exit=$curl_status parser_exit=$parser_status http_status=${http_status:-000} content_type=${content_type:-unknown} expected=$TARGET_VERSION actual=${deployed_version:-missing} error=${curl_error:-none}"
    describe_version_response "$response_file"
    if [ "$attempt" -lt "$LOCAL_VERIFY_MAX_ATTEMPTS" ]; then
      sleep "$LOCAL_VERIFY_SLEEP_SECONDS"
    fi
    attempt=$((attempt + 1))
  done

  rm -f "$response_file" "$headers_file" "$error_file"
  echo "Local backend version verification failed"
  return 1
}

download_gpu_compose_override() {
  if [ "$NVIDIA_GPU_ENABLED" != "true" ]; then
    rm -f docker-compose.gpu.yml.tmp docker-compose.gpu.yml
    echo "NVIDIA GPU deployment disabled; using CPU compose"
    return 0
  fi
  gpu_url="https://raw.githubusercontent.com/$REPO_SLUG/$TARGET_SHA/docker-compose.gpu.yml"
  if ! gpu_status=$(curl --silent --show-error --location \
    --output docker-compose.gpu.yml.tmp \
    --write-out '%{http_code}' \
    "$gpu_url"); then
    rm -f docker-compose.gpu.yml.tmp
    echo "Failed to download GPU compose override"
    return 1
  fi

  case "$gpu_status" in
    200)
      mv docker-compose.gpu.yml.tmp docker-compose.gpu.yml
      ;;
    404)
      rm -f docker-compose.gpu.yml.tmp docker-compose.gpu.yml
      echo "GPU compose override is missing from the target commit"
      return 1
      ;;
    *)
      rm -f docker-compose.gpu.yml.tmp
      echo "GPU compose override download returned HTTP $gpu_status"
      return 1
      ;;
  esac
}

deploy_from_compose_path() {
  path="$1"

  if is_forbidden_deploy_path "$path"; then
    echo "Refusing to deploy from forbidden path: $path"
    return 1
  fi

  cd "$path"

  if [ -d .git ]; then
    echo "Refusing to deploy from a Git checkout: $path"
    return 1
  fi

  echo "Updating production compose file from $REPO_SLUG@$TARGET_SHA"
  curl -fsSL "https://raw.githubusercontent.com/$REPO_SLUG/$TARGET_SHA/docker-compose.yml" -o docker-compose.yml.tmp
  mv docker-compose.yml.tmp docker-compose.yml
  download_gpu_compose_override

  configure_compose_cmd

  verify_gpu_prerequisites

  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

  export CI_BACKEND_IMAGE="$BACKEND_IMAGE"

  # Redis is not part of the backend image update. Keep it running
  # so deployments do not pull and recreate the stateful service.
  if ! compose_cmd pull backend backend-worker highlight-video-worker youtube-upload-worker gopro-overlay-worker gopro-preview-worker database-backup ||
    ! compose_cmd up -d --remove-orphans backend backend-worker highlight-video-worker youtube-upload-worker gopro-overlay-worker gopro-preview-worker database-backup redis; then
    print_backend_diagnostics
    return 1
  fi
  # Compose can report success while a worker exits during its
  # startup preflight. Re-apply the worker once before failing the
  # deployment; its restart policy then keeps it supervised.
  if ! verify_workers_started; then
    echo "RQ worker readiness check failed; restarting GoPro worker once"
    compose_cmd up -d --no-deps --force-recreate gopro-overlay-worker gopro-preview-worker || true
  fi
  verify_workers_started || {
    print_backend_diagnostics
    return 1
  }
}

deploy_from_portainer_volume() {
  if ! docker run --rm \
    -e CI_BACKEND_IMAGE="$BACKEND_IMAGE" \
    -e COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" \
    -e GHCR_TOKEN="$GHCR_TOKEN" \
    -e GHCR_USERNAME="$GHCR_USERNAME" \
    -e REPO_SLUG="$REPO_SLUG" \
    -e TARGET_SHA="$TARGET_SHA" \
    -e TARGET_VERSION="$TARGET_VERSION" \
    -e STACK_ID="$STACK_ID" \
    -e NVIDIA_GPU_ENABLED="$NVIDIA_GPU_ENABLED" \
    -e LOCAL_VERIFY_MAX_ATTEMPTS="$LOCAL_VERIFY_MAX_ATTEMPTS" \
    -e LOCAL_VERIFY_SLEEP_SECONDS="$LOCAL_VERIFY_SLEEP_SECONDS" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$PORTAINER_VOLUME:/data" \
    -w "/data/compose/$STACK_ID" \
    docker:27-cli sh -ceu '
      apk add --no-cache curl >/dev/null
      work_dir="/data/compose/$STACK_ID"
      cd "$work_dir"

      curl -fsSL "https://raw.githubusercontent.com/$REPO_SLUG/$TARGET_SHA/docker-compose.yml" -o docker-compose.yml.tmp
      mv docker-compose.yml.tmp docker-compose.yml

      if [ "$NVIDIA_GPU_ENABLED" = "true" ]; then
        gpu_url="https://raw.githubusercontent.com/$REPO_SLUG/$TARGET_SHA/docker-compose.gpu.yml"
        if ! gpu_status=$(curl --silent --show-error --location \
          --output docker-compose.gpu.yml.tmp \
          --write-out "%{http_code}" \
          "$gpu_url"); then
          rm -f docker-compose.gpu.yml.tmp
          echo "Failed to download GPU compose override"
          exit 1
        fi
        case "$gpu_status" in
          200) mv docker-compose.gpu.yml.tmp docker-compose.gpu.yml ;;
          404)
            rm -f docker-compose.gpu.yml.tmp docker-compose.gpu.yml
            echo "GPU compose override is missing from the target commit"
            exit 1
            ;;
          *)
            rm -f docker-compose.gpu.yml.tmp
            echo "GPU compose override download returned HTTP $gpu_status"
            exit 1
            ;;
        esac
      else
        rm -f docker-compose.gpu.yml.tmp docker-compose.gpu.yml
        echo "NVIDIA GPU deployment disabled; using CPU compose"
      fi

      compose_files="-f docker-compose.yml"
      if [ "$NVIDIA_GPU_ENABLED" = "true" ] && [ -f docker-compose.gpu.yml ]; then
        compose_files="$compose_files -f docker-compose.gpu.yml"
      fi

      if [ -f stack.env ]; then
        compose_cmd() { docker compose -p "$COMPOSE_PROJECT_NAME" $compose_files --env-file stack.env "$@"; }
      elif [ -f .env ]; then
        compose_cmd() { docker compose -p "$COMPOSE_PROJECT_NAME" $compose_files --env-file .env "$@"; }
      else
        compose_cmd() { docker compose -p "$COMPOSE_PROJECT_NAME" $compose_files "$@"; }
      fi

      if [ "$NVIDIA_GPU_ENABLED" = "true" ]; then
        echo "Verifying NVIDIA Docker runtime before replacing production containers"
        if ! docker info --format "{{json .Runtimes}}" | grep -q "\"nvidia\""; then
          echo "NVIDIA runtime is not registered in Docker; falling back to CPU deployment"
          export NVIDIA_GPU_ENABLED=false BACKEND_VIDEO_ACCELERATOR=cpu
          compose_files="-f docker-compose.yml"
        fi
        if [ "$NVIDIA_GPU_ENABLED" = "true" ] && ! docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu24.04 nvidia-smi -L; then
          echo "NVIDIA GPU preflight failed; falling back to CPU deployment"
          export NVIDIA_GPU_ENABLED=false BACKEND_VIDEO_ACCELERATOR=cpu
          compose_files="-f docker-compose.yml"
        fi
      fi

      printf "%s" "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

      # Redis is not part of the backend image update. Keep it running
      # so deployments do not pull and recreate the stateful service.
      compose_cmd pull backend backend-worker highlight-video-worker youtube-upload-worker gopro-overlay-worker gopro-preview-worker database-backup
      compose_cmd up -d --remove-orphans backend backend-worker highlight-video-worker youtube-upload-worker gopro-overlay-worker gopro-preview-worker database-backup redis
      readiness_attempt=1
      readiness_ok=0
      while [ "$readiness_attempt" -le "$LOCAL_VERIFY_MAX_ATTEMPTS" ]; do
        readiness_failed=0
        for container_name in parapente-backend parapente-backend-worker parapente-highlight-video-worker parapente-youtube-upload-worker parapente-gopro-overlay-worker parapente-gopro-preview-worker parapente-redis; do
          state=$(docker inspect --format "{{.State.Status}}" "$container_name" 2>/dev/null || true)
          health=$(docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" "$container_name" 2>/dev/null || true)
          if [ "$state" != "running" ] || [ "$health" != "healthy" ]; then
            readiness_failed=1
          fi
        done
        for worker_log in parapente-backend-worker parapente-highlight-video-worker parapente-gopro-overlay-worker parapente-gopro-preview-worker parapente-youtube-upload-worker; do
          if ! docker logs "$worker_log" 2>&1 | grep -q "Listening on"; then
            readiness_failed=1
          fi
        done
        if [ "$NVIDIA_GPU_ENABLED" = "true" ]; then
          gpu_devices=$(docker inspect --format "{{json .HostConfig.DeviceRequests}}" parapente-gopro-overlay-worker 2>/dev/null || true)
          if ! echo "$gpu_devices" | grep -q "\"Driver\":\"nvidia\""; then
            readiness_failed=1
          fi
        fi
        if [ "$readiness_failed" -eq 0 ]; then
          readiness_ok=1
          break
        fi
        echo "Worker readiness check attempt $readiness_attempt/$LOCAL_VERIFY_MAX_ATTEMPTS failed"
        [ "$readiness_attempt" -lt "$LOCAL_VERIFY_MAX_ATTEMPTS" ] && sleep "$LOCAL_VERIFY_SLEEP_SECONDS"
        readiness_attempt=$((readiness_attempt + 1))
      done
      if [ "$readiness_ok" -ne 1 ]; then
        echo "Production worker readiness verification failed"
        exit 1
      fi
      echo "Production backend and all RQ workers are running"
    '; then
    print_backend_diagnostics
    return 1
  fi
}

deploy_with_retry() {
  deploy_name="$1"
  deploy_attempt=1
  deploy_max_attempts=2

  while [ "$deploy_attempt" -le "$deploy_max_attempts" ]; do
    echo "Starting $deploy_name deployment attempt $deploy_attempt/$deploy_max_attempts"
    if [ "$deploy_name" = "configured compose path" ]; then
      deploy_from_compose_path "$DEPLOY_PATH" && return 0
    else
      deploy_from_portainer_volume && return 0
    fi

    if [ "$deploy_attempt" -lt "$deploy_max_attempts" ]; then
      echo "Deployment attempt failed; waiting 20 seconds before retrying the stack"
      sleep 20
    fi
    deploy_attempt=$((deploy_attempt + 1))
  done

  echo "$deploy_name deployment failed after $deploy_max_attempts attempts"
  return 1
}

if [ -n "$DEPLOY_PATH" ] && [ -d "$DEPLOY_PATH" ]; then
  echo "Deploying from configured compose path: $DEPLOY_PATH"
  if ! deploy_with_retry "configured compose path"; then
    exit 1
  fi
  if ! verify_local_backend_version; then
    print_backend_diagnostics
    exit 1
  fi
  exit 0
fi

if [ -n "$DEPLOY_PATH" ]; then
  echo "Configured deploy path not found: $DEPLOY_PATH"
fi

if resolve_from_portainer_volume; then
  echo "Configured host path unavailable, deploying compose from Portainer volume $PORTAINER_VOLUME (stack $STACK_ID)"
  if ! deploy_with_retry "Portainer volume"; then
    exit 1
  fi
  if ! verify_local_backend_version; then
    print_backend_diagnostics
    exit 1
  fi
  exit 0
fi

echo "Deploy path does not exist: $DEPLOY_PATH"
if [ -n "$REQUESTED_DEPLOY_PATH" ]; then
  echo "Configured SSH_DEPLOY_PATH: $REQUESTED_DEPLOY_PATH"
fi
echo "Unable to access deploy path on host and no Portainer volume fallback available"
exit 1
