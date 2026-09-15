import logging
import sqlite3
from pathlib import Path

from database import DB_PATH

logger = logging.getLogger(__name__)


def run_migrations(migrations_dir: Path | None = None) -> None:
    """Apply all SQL migrations in order, safely supporting existing databases."""
    migrations_dir = migrations_dir or Path(__file__).parent / "sql_migrations"

    if not migrations_dir.exists():
        logger.warning("Migrations directory not found: %s", migrations_dir)
        return

    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        logger.info("No migration files found")
        return

    logger.info("Running %d migration(s)...", len(migration_files))
    with sqlite3.connect(str(DB_PATH)) as conn:
        cursor = conn.cursor()
        for migration_file in migration_files:
            logger.info("Applying migration: %s", migration_file.name)
            sql = migration_file.read_text()
            applied = 0
            skipped = 0

            for raw_statement in sql.split(";"):
                lines = [
                    line for line in raw_statement.splitlines() if not line.strip().startswith("--")
                ]
                statement = "\n".join(lines).strip()
                if not statement:
                    continue

                try:
                    cursor.execute(statement)
                    conn.commit()
                    applied += 1
                except sqlite3.IntegrityError:
                    conn.rollback()
                    skipped += 1
                except sqlite3.OperationalError as exc:
                    error_message = str(exc).lower()
                    if (
                        "already exists" in error_message
                        or "duplicate column name" in error_message
                    ):
                        skipped += 1
                    else:
                        logger.error(
                            "Migration %s failed on statement: %s",
                            migration_file.name,
                            statement[:100],
                        )
                        raise

            if skipped and not applied:
                logger.info("Migration %s already applied", migration_file.name)
            elif skipped:
                logger.info(
                    "Migration %s: %d applied, %d already existed",
                    migration_file.name,
                    applied,
                    skipped,
                )
            else:
                logger.info("Migration %s applied successfully", migration_file.name)

    logger.info("All migrations completed")
