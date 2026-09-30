from pathlib import Path


def resolve_flight_file_path(file_path: str | None) -> Path | None:
    if not file_path:
        return None

    path = Path(file_path)
    if path.is_absolute() or path.exists():
        return path
    return Path(__file__).parent / path
