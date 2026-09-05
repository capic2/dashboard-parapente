#!/bin/sh

set -eu

readonly source_database="${DATABASE_BACKUP_SOURCE:-/app/db/dashboard.db}"
readonly backup_directory="${DATABASE_BACKUP_DIRECTORY:-/backups}"
readonly interval_seconds="${DATABASE_BACKUP_INTERVAL_SECONDS:-86400}"
readonly retry_seconds="${DATABASE_BACKUP_RETRY_SECONDS:-300}"
readonly retention_days="${DATABASE_BACKUP_RETENTION_DAYS:-30}"
readonly success_marker="/tmp/database-backup-last-success"

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

    find "$backup_directory" -maxdepth 1 -type f -name 'dashboard-*.sqlite3.gz' -mtime "+$retention_days" -print |
        while IFS= read -r expired_archive; do
            rm -f "$expired_archive" "$expired_archive.sha256"
        done

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
