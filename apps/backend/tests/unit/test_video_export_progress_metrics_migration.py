import sqlite3
from pathlib import Path

import pytest

import database_migrations

MIGRATION = (
    Path(__file__).parents[2] / "sql_migrations" / "046_add_video_export_progress_metrics.sql"
)


def test_migration_persists_video_export_progress_metrics(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "test.sqlite"
    migration_directory = tmp_path / "migrations"
    migration_directory.mkdir()
    (migration_directory / MIGRATION.name).write_text(MIGRATION.read_text())
    monkeypatch.setattr(database_migrations, "DB_PATH", database_path)

    connection = sqlite3.connect(database_path)
    connection.execute(
        "CREATE TABLE video_export_jobs " "(id VARCHAR PRIMARY KEY, status VARCHAR NOT NULL)"
    )
    connection.execute("INSERT INTO video_export_jobs (id, status) VALUES ('job-1', 'running')")
    connection.commit()
    connection.close()

    database_migrations.run_migrations(migrations_dir=migration_directory)
    database_migrations.run_migrations(migrations_dir=migration_directory)

    connection = sqlite3.connect(database_path)
    connection.execute(
        "UPDATE video_export_jobs "
        "SET eta_seconds = 74, frames_processed = 824, fps_actual = 5.1 "
        "WHERE id = 'job-1'"
    )
    metrics = connection.execute(
        "SELECT eta_seconds, frames_processed, fps_actual "
        "FROM video_export_jobs WHERE id = 'job-1'"
    ).fetchone()

    assert metrics == (74, 824, 5.1)
    connection.close()
