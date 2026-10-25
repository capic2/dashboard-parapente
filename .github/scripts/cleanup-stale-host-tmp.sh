#!/bin/sh
set -eu

removed=0
failed=0

echo "Temporary filesystem inode usage before cleanup:"
df -Pi /tmp

for temp_dir in /tmp/tmp-[0-9]*-*; do
  [ -d "$temp_dir" ] || continue

  directory_name=${temp_dir##*/}
  process_id=${directory_name#tmp-}
  process_id=${process_id%%-*}
  case "$process_id" in
    ''|*[!0-9]*) continue ;;
  esac

  # Keep directories whose creating process is still running.
  if [ -e "/proc/$process_id" ]; then
    continue
  fi

  # Give recently abandoned temporary directories time to be reused or inspected.
  if ! find "$temp_dir" -maxdepth 0 -type d -mmin +1440 -print -quit | grep -q .; then
    continue
  fi

  if rm -rf -- "$temp_dir" 2>/dev/null || sudo -n rm -rf -- "$temp_dir"; then
    removed=$((removed + 1))
  else
    echo "Could not remove stale temporary directory: $temp_dir"
    failed=$((failed + 1))
  fi
done

echo "Removed $removed stale temporary directories; failed to remove $failed."
echo "Temporary filesystem inode usage after cleanup:"
df -Pi /tmp

[ "$failed" -eq 0 ]
