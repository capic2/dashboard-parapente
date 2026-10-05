import os
import stat
import subprocess
import time
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "database_backup.sh"


def test_backup_removes_snapshot_after_success_and_stale_snapshots(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    sqlite3 = fake_bin / "sqlite3"
    sqlite3.write_text("""#!/usr/bin/env python3
import re
import shutil
import sys

backup_command = next((argument for argument in sys.argv[2:] if argument.startswith('.backup')), None)
if backup_command:
    destination = re.search(r"'([^']+)'", backup_command).group(1)
    shutil.copyfile(sys.argv[1].split('?')[0], destination)
else:
    print('ok')
""")
    sqlite3.chmod(sqlite3.stat().st_mode | stat.S_IXUSR)

    source = tmp_path / "dashboard.db"
    source.write_bytes(b"test database")
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    stale = backup_dir / ".dashboard-old.sqlite3"
    stale.write_bytes(b"stale snapshot")
    old_time = time.time() - 2 * 24 * 60 * 60
    os.utime(stale, (old_time, old_time))

    environment = {
        **os.environ,
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "DATABASE_BACKUP_SOURCE": str(source),
        "DATABASE_BACKUP_DIRECTORY": str(backup_dir),
        "DATABASE_BACKUP_INTERVAL_SECONDS": "60",
        "DATABASE_BACKUP_TEMPORARY_RETENTION_MINUTES": "60",
        "DATABASE_BACKUP_GOOGLE_DRIVE_REMOTE": "",
    }
    result = subprocess.run(
        ["timeout", "10", "/bin/sh", str(SCRIPT)],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 124, result.stderr
    assert not stale.exists()
    assert list(backup_dir.glob("dashboard-*.sqlite3.gz"))
    assert list(backup_dir.glob("dashboard-*.sqlite3.gz.sha256"))
    assert not list(backup_dir.glob(".dashboard-*"))
