"""Add structured practical Site data and post-flight pilot context."""

import logging

from sqlalchemy import create_engine, text

from env_utils import required_env

logger = logging.getLogger(__name__)
engine = create_engine(required_env("DATABASE_URL"))


def _add_column(conn, table: str, column: str, definition: str) -> None:
    columns = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
    if column not in columns:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


def upgrade() -> None:
    with engine.connect() as conn:
        _add_column(conn, "sites", "practical_info", "TEXT NOT NULL DEFAULT '{}'")
        _add_column(conn, "flights", "tags", "TEXT NOT NULL DEFAULT '[]'")
        _add_column(conn, "flights", "conditions_feedback", "TEXT")
        _add_column(conn, "flights", "decision_snapshot", "TEXT")
        conn.commit()
    logger.info("Added pilot context fields")


if __name__ == "__main__":
    upgrade()
