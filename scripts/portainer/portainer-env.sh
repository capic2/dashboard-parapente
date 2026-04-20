#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${PORTAINER_ENV_FILE:-.env.portainer}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

required_vars=(
  "PORTAINER_URL"
  "PORTAINER_API_TOKEN"
  "PORTAINER_ENDPOINT_ID"
  "PORTAINER_STACK_ID"
)

missing_vars=()
for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    missing_vars+=("$var_name")
  fi
done

if [ "${#missing_vars[@]}" -gt 0 ]; then
  printf "Missing required Portainer variables: %s\n" "${missing_vars[*]}" >&2
  printf "Set them in environment or in %s\n" "$ENV_FILE" >&2
  return 1 2>/dev/null || exit 1
fi
