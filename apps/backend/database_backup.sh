#!/bin/sh

set -eu

readonly source_database="${DATABASE_BACKUP_SOURCE:-/app/db/dashboard.db}"
readonly backup_directory="${DATABASE_BACKUP_DIRECTORY:-/backups}"
readonly interval_seconds="${DATABASE_BACKUP_INTERVAL_SECONDS:-86400}"
readonly retry_seconds="${DATABASE_BACKUP_RETRY_SECONDS:-300}"
readonly retention_count="${DATABASE_BACKUP_RETENTION_COUNT:-3}"
readonly google_drive_remote="${DATABASE_BACKUP_GOOGLE_DRIVE_REMOTE:-}"
readonly google_drive_path="${DATABASE_BACKUP_GOOGLE_DRIVE_PATH:-dashboard-parapente/database-backups}"
readonly success_marker="/tmp/database-backup-last-success"

upload_to_google_drive() {
    archive="$1"
    remote_directory="$google_drive_remote:$google_drive_path"

    rclone copyto "$archive" "$remote_directory/$(basename "$archive")"
    rclone copyto "$archive.sha256" "$remote_directory/$(basename "$archive.sha256")"
    rclone lsf "$remote_directory/$(basename "$archive")" --files-only |
        grep -qx "$(basename "$archive")"
    rclone lsf "$remote_directory/$(basename "$archive.sha256")" --files-only |
        grep -qx "$(basename "$archive.sha256")"
}

prune_google_drive_backups() {
    remote_directory="$google_drive_remote:$google_drive_path"
    rclone lsf "$remote_directory" --files-only --include 'dashboard-*.sqlite3.gz' |
        sort -r |
        tail -n +$((retention_count + 1)) |
        while IFS= read -r expired_archive; do
            rclone deletefile "$remote_directory/$expired_archive"
            rclone deletefile "$remote_directory/$expired_archive.sha256"
    done
}

prune_local_backups() {
    find "$backup_directory" -maxdepth 1 -type f -name 'dashboard-*.sqlite3.gz' -print |
        sort -r |
        tail -n +$((retention_count + 1)) |
        while IFS= read -r expired_archive; do
            rm -f "$expired_archive" "$expired_archive.sha256"
        done
}

backup_once() {
    if [ ! -f "$source_database" ]; then
        echo "Database backup failed: source database does not exist: $source_database" >&2
        return 1
    fi

    mkdir -p "$backup_directory"

    timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
    archive="$backup_directory/dashboard-$timestamp.sqlite3.gz"
    temporary_database="$(mktemp "$backup_directory/.dashboard-$timestamp.XXXXXX.sqlite3")"
    temporary_archive="$archive.tmp"

    cleanup() {
        rm -f "$temporary_database" "$temporary_archive"
    }
    trap cleanup EXIT INT TERM

    # SQLite's online backup API creates a transactionally consistent snapshot,
    # including changes that have not yet been checkpointed from the WAL file.
    sqlite3 "file:$source_database?mode=ro" ".timeout 60000" ".backup '$temporary_database'"
    sqlite3 "$temporary_database" "PRAGMA quick_check" | grep -qx "ok"

    gzip -c "$temporary_database" > "$temporary_archive"
    mv "$temporary_archive" "$archive"
    (
        cd "$backup_directory"
        sha256sum "$(basename "$archive")"
    ) > "$archive.sha256"

    # Keep the local fallback bounded even when Google Drive is unavailable.
    prune_local_backups

    if [ -n "$google_drive_remote" ]; then
        if ! command -v rclone >/dev/null 2>&1; then
            echo "Google Drive backup is enabled but rclone is unavailable" >&2
            return 1
        fi
        upload_to_google_drive "$archive"
        prune_google_drive_backups
        rm -f "$archive" "$archive.sha256"
        touch "$success_marker"
        echo "Database backup uploaded to Google Drive: $google_drive_path/$(basename "$archive")"
        return 0
    fi

    touch "$success_marker"
    echo "Database backup completed: $archive"
}

while true; do
    if backup_once; then
        sleep "$interval_seconds"
    else
        echo "Database backup will retry in $retry_seconds seconds" >&2
        sleep "$retry_seconds"
    fi
done
