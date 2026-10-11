#!/usr/bin/env bash
set -euo pipefail

keep_count="${VERSION_LABELS_TO_KEEP:-500}"
if [[ ! "$keep_count" =~ ^[0-9]+$ ]] || (( keep_count < 1 )); then
  echo "VERSION_LABELS_TO_KEEP must be a positive integer" >&2
  exit 2
fi

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (owner/repository)}"

label_names="$(gh api --paginate "repos/${GITHUB_REPOSITORY}/labels?per_page=100" --jq '.[].name')"
version_labels=()
while IFS= read -r label_name; do
  if [[ "$label_name" =~ ^version:([0-9]{4})\.([0-9]{2})\.([0-9]{2})\.([0-9]+)$ ]]; then
    version_labels+=("${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.${BASH_REMATCH[3]}.${BASH_REMATCH[4]}")
  fi
done <<< "$label_names"

if (( ${#version_labels[@]} <= keep_count )); then
  echo "Found ${#version_labels[@]} deployment version labels; keeping all (limit: ${keep_count})."
  exit 0
fi

mapfile -t sorted_versions < <(
  printf '%s\n' "${version_labels[@]}" |
    LC_ALL=C sort -t . -k1,1n -k2,2n -k3,3n -k4,4n
)
remove_count=$(( ${#sorted_versions[@]} - keep_count ))
echo "Found ${#sorted_versions[@]} deployment version labels; removing the ${remove_count} oldest and keeping the newest ${keep_count}."

for (( index = 0; index < remove_count; index++ )); do
  label_name="version:${sorted_versions[index]}"
  if [[ "${VERSION_LABEL_DRY_RUN:-false}" == "true" ]]; then
    echo "Would delete ${label_name}"
  else
    gh api --method DELETE "repos/${GITHUB_REPOSITORY}/labels/${label_name}" >/dev/null
    echo "Deleted ${label_name}"
  fi
done
