#!/usr/bin/env bash

set -euo pipefail

workspace_root=$(git rev-parse --show-toplevel)
cd "$workspace_root"

pnpm_bin=${PNPM_BIN:-}
if [[ -z "$pnpm_bin" ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm_bin=$(command -v pnpm)
  elif [[ -x /home/capic/.local/share/pnpm/pnpm ]]; then
    pnpm_bin=/home/capic/.local/share/pnpm/pnpm
  else
    echo "pnpm is required to bootstrap the local workspace" >&2
    exit 1
  fi
fi

lock_hash=$(sha256sum pnpm-lock.yaml | awk '{print $1}')
node_marker=node_modules/.dashboard-pnpm-lock.sha256
installed_lock_hash=""
if [[ -f "$node_marker" ]]; then
  installed_lock_hash=$(<"$node_marker")
fi

if [[ ! -x node_modules/.bin/nx || ! -x node_modules/.bin/knip || ! -d node_modules/typescript || "$installed_lock_hash" != "$lock_hash" ]]; then
  CI=true "$pnpm_bin" install --frozen-lockfile
  printf '%s\n' "$lock_hash" >"$node_marker"
fi

python_bin=${PYTHON_BIN:-}
if [[ -z "$python_bin" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    python_bin=$(command -v python3)
  elif command -v python >/dev/null 2>&1; then
    python_bin=$(command -v python)
  else
    echo "Python 3.12 or newer is required to bootstrap the backend" >&2
    exit 1
  fi
fi

if ! "$python_bin" -c 'import sys; raise SystemExit(sys.version_info < (3, 12))'; then
  echo "Python 3.12 or newer is required to bootstrap the backend" >&2
  exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
  "$python_bin" -m venv .venv
fi

if ! .venv/bin/python -c 'import sys; raise SystemExit(sys.version_info < (3, 12))'; then
  echo "The branch-local .venv must use Python 3.12 or newer" >&2
  exit 1
fi

requirements_hash=$(sha256sum apps/backend/requirements.txt | awk '{print $1}')
requirements_marker=.venv/.dashboard-requirements.sha256
installed_requirements_hash=""
if [[ -f "$requirements_marker" ]]; then
  installed_requirements_hash=$(<"$requirements_marker")
fi

if [[ ! -x .venv/bin/pytest || ! -x .venv/bin/ruff || ! -x .venv/bin/black || ! -x .venv/bin/isort || ! -x .venv/bin/uvicorn || "$installed_requirements_hash" != "$requirements_hash" ]]; then
  .venv/bin/python -m pip install -r apps/backend/requirements.txt
  printf '%s\n' "$requirements_hash" >"$requirements_marker"
fi

NX_NO_CLOUD=true "$pnpm_bin" nx --version
.venv/bin/python --version
.venv/bin/pytest --version
