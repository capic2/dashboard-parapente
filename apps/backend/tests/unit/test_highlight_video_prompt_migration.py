from pathlib import Path

MIGRATION = Path(__file__).parents[2] / "sql_migrations" / "027_add_highlight_video_prompt.sql"


def test_highlight_video_prompt_migration_adds_prompt_column() -> None:
    assert "ALTER TABLE highlight_video_jobs ADD COLUMN prompt TEXT" in MIGRATION.read_text()
