import sqlite3
from contextlib import closing
from pathlib import Path

import database_migrations


def test_run_migrations_adds_missing_flight_column_idempotently(tmp_path, monkeypatch):
    database_path = tmp_path / "dashboard.db"
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute("CREATE TABLE flights (id TEXT PRIMARY KEY)")

    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    (migrations_dir / "030_add_gpx_metrics_excluded.sql").write_text(
        "ALTER TABLE flights ADD COLUMN gpx_metrics_excluded BOOLEAN NOT NULL DEFAULT 0;"
    )
    monkeypatch.setattr(database_migrations, "DB_PATH", database_path)

    database_migrations.run_migrations(migrations_dir)
    database_migrations.run_migrations(migrations_dir)

    with closing(sqlite3.connect(database_path)) as connection, connection:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(flights)").fetchall()}
    assert "gpx_metrics_excluded" in columns


def test_landing_site_source_migration_preserves_manual_and_auto_values(tmp_path, monkeypatch):
    database_path = tmp_path / "dashboard.db"
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute("CREATE TABLE flights (id TEXT PRIMARY KEY, landing_site_id TEXT)")
        connection.execute("INSERT INTO flights (id, landing_site_id) VALUES ('manual', 'site-a')")

    migrations_dir = tmp_path / "migrations"
    migrations_dir.mkdir()
    source_migration = (
        Path(__file__).parents[2] / "sql_migrations" / "051_add_landing_site_source.sql"
    )
    (migrations_dir / source_migration.name).write_text(source_migration.read_text())
    monkeypatch.setattr(database_migrations, "DB_PATH", database_path)

    database_migrations.run_migrations(migrations_dir)
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute(
            "INSERT INTO flights (id, landing_site_id, landing_site_source) "
            "VALUES ('auto', 'site-b', 'auto')"
        )
    database_migrations.run_migrations(migrations_dir)

    with closing(sqlite3.connect(database_path)) as connection, connection:
        values = dict(connection.execute("SELECT id, landing_site_source FROM flights").fetchall())
    assert values == {"manual": "manual", "auto": "auto"}
