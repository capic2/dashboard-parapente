import sqlite3
from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "022_add_youtube_credential_scope.sql"


def test_migration_marks_existing_credentials_with_legacy_upload_scope() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute("""CREATE TABLE youtube_credentials (
            user_id INTEGER PRIMARY KEY,
            refresh_token_encrypted TEXT NOT NULL
        )""")
    connection.execute("INSERT INTO youtube_credentials VALUES (1, 'encrypted-refresh-token')")

    connection.executescript(MIGRATION.read_text())

    credential = connection.execute(
        "SELECT oauth_scope FROM youtube_credentials WHERE user_id = 1"
    ).fetchone()
    assert credential == ("https://www.googleapis.com/auth/youtube.upload",)
