#!/usr/bin/env bash
set -euo pipefail

targets=(build lint type-check test)
targets_csv=$(IFS=,; echo "${targets[*]}")
target_projects=()

for target in "${targets[@]}"; do
  projects_json=$(pnpm exec nx show projects --with-target="$target" --exclude=e2e --json)
  project_count=$(node -e 'console.log(JSON.parse(process.argv[1]).length)' "$projects_json")

  if [[ "$project_count" == "0" ]]; then
    echo "Nx found no projects with the required '$target' target."
    exit 1
  fi

  echo "Nx found $project_count project(s) with the '$target' target."
  target_projects+=("$projects_json")
done

projects=$(node - "${target_projects[@]}" <<'NODE'
const projectSets = process.argv.slice(2).map((projects) => JSON.parse(projects));
const projects = [...new Set(projectSets.flat())].sort();
if (projects.length === 0) {
  process.exit(1);
}
process.stdout.write(projects.join(','));
NODE
)

echo "Running ${targets[*]} on the selected Nx projects: $projects"
pnpm exec nx run-many --targets="$targets_csv" --projects="$projects" --parallel=5 --skip-nx-cache --outputStyle=stream
