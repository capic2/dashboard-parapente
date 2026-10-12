#!/usr/bin/env bash
set -uo pipefail

if command -v ../../.venv/bin/pytest >/dev/null 2>&1; then
  pytest_bin=../../.venv/bin/pytest
else
  pytest_bin=pytest
fi

pytest_log=$(mktemp)
trap 'rm -f "$pytest_log"' EXIT

if "$pytest_bin" "$@" >"$pytest_log" 2>&1; then
  # Pytest's classic quiet mode still prints one dot per test; Nx stream output
  # turns those carriage-return updates into a noisy line per dot in Actions.
  tr '\r' '\n' <"$pytest_log" | sed -E '/^[.sFxX ]+$/d'
else
  pytest_status=$?
  tr '\r' '\n' <"$pytest_log" | sed -E '/^[.sFxX ]+$/d'
  exit "$pytest_status"
fi
