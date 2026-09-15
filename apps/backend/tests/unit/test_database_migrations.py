import sqlite3

import database_migrations


def test_run_migrations_adds_missing_flight_column_idempotently(tmp_path, monkeypatch):
    database_path = tmp_path / "dashboard.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute("CREATE TABLE flights (id TEXT PRIMARY KEY)")

    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    (migrations_dir / "030_add_gpx_metrics_excluded.sql").write_text(
        "ALTER TABLE flights ADD COLUMN gpx_metrics_excluded BOOLEAN NOT NULL DEFAULT 0;"
    )
    monkeypatch.setattr(database_migrations, "DB_PATH", database_path)

    database_migrations.run_migrations(migrations_dir)
    database_migrations.run_migrations(migrations_dir)

    with sqlite3.connect(database_path) as connection:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(flights)").fetchall()}
    assert "gpx_metrics_excluded" in columns
