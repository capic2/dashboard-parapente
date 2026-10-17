#!/usr/bin/env bash
set -euo pipefail

export NX_DAEMON=false

targets=(build lint type-check test)
targets_csv=$(IFS=,; echo "${targets[*]}")
projects_json=$(pnpm exec nx show projects --exclude=e2e --json)
projects=$(node -e 'console.log(JSON.parse(process.argv[1]).join(","))' "$projects_json")

if [[ -z "$projects" ]]; then
  echo "Nx found no projects to validate."
  exit 1
fi

project_count=$(node -e 'console.log(process.argv[1].split(",").filter(Boolean).length)' "$projects")
echo "Nx found $project_count project(s) to validate."

echo "Running ${targets[*]} on the selected Nx projects: $projects"
# Validate every project while reusing only task results with matching Nx input hashes.
pnpm exec nx run-many --targets="$targets_csv" --projects="$projects" --parallel=5 --outputStyle=stream
