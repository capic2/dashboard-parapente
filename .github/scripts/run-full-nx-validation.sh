#!/usr/bin/env bash
set -euo pipefail

# Avoid reusing an Nx daemon started with the runner's CI environment.
export NX_DAEMON=false

targets=(build lint type-check test)
targets_csv=$(IFS=,; echo "${targets[*]}")
projects_json=$(env -u NODE_OPTIONS pnpm exec nx show projects --exclude=e2e --json)
projects=$(node -e 'console.log(JSON.parse(process.argv[1]).join(","))' "$projects_json")

if [[ -z "$projects" ]]; then
  echo "Nx found no projects to validate."
  exit 1
fi

project_count=$(node -e 'console.log(process.argv[1].split(",").filter(Boolean).length)' "$projects")
echo "Nx found $project_count project(s) to validate."

echo "Running ${targets[*]} on the selected Nx projects: $projects"
pnpm exec nx run-many --targets="$targets_csv" --projects="$projects" --parallel=5 --skip-nx-cache --outputStyle=stream
