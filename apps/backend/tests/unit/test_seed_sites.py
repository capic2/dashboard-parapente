import sqlite3
from pathlib import Path

import pytest
import seed_sites


def test_seed_sites_populates_required_practical_info(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "dashboard.db"
    with sqlite3.connect(db_path) as connection:
        connection.execute("""
            CREATE TABLE sites (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE,
                name TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                elevation_m INTEGER,
                region TEXT,
                country TEXT,
                rating INTEGER,
                orientation TEXT,
                linked_spot_id TEXT,
                practical_info TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT
            )
            """)

    monkeypatch.setattr(seed_sites, "DB_PATH", db_path)

    assert seed_sites.seed_sites() is True

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE sites SET practical_info = ? WHERE id = 'site-arguel'",
            ('{"access": "private"}',),
        )
        connection.commit()

    assert seed_sites.seed_sites() is True

    with sqlite3.connect(db_path) as connection:
        count, practical_info = connection.execute(
            "SELECT COUNT(*), practical_info FROM sites WHERE id = 'site-arguel'"
        ).fetchone()

    assert count == 1
    assert practical_info == '{"access": "private"}'
