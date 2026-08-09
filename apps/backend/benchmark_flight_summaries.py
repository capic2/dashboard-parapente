"""Benchmark the first flight-summary page against a representative history."""

import argparse
import os
import statistics
import tempfile
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("TESTING", "true")
os.environ.setdefault("BACKEND_DATABASE_URL", "sqlite:///benchmark-unused.db")
os.environ.setdefault("BACKEND_LOG_FILE", "/tmp/dashboard-parapente-benchmark.log")
os.environ.setdefault("BACKEND_JWT_SECRET", "benchmark-only-secret")


def benchmark(*, flight_count: int, iterations: int) -> dict[str, float]:
    from flight_summaries import list_flight_summaries
    from models import Base, Flight, Site

    with tempfile.TemporaryDirectory() as directory:
        database_path = Path(directory) / "flight-summary-benchmark.db"
        engine = create_engine(f"sqlite:///{database_path}")
        Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine)

        start_date = date(2000, 1, 1)
        start_time = datetime(2000, 1, 1, 12)
        with session_factory() as db:
            db.bulk_save_objects(
                [Site(id=f"site-{index:03d}", name=f"Site {index:03d}") for index in range(100)]
            )
            db.bulk_save_objects(
                [
                    Flight(
                        id=f"benchmark-{index:05d}",
                        title=f"Flight {index}",
                        site_id=f"site-{index % 100:03d}",
                        flight_date=start_date + timedelta(days=index % 9000),
                        departure_time=start_time + timedelta(days=index % 9000),
                        duration_minutes=index % 240,
                        max_altitude_m=800 + index % 3000,
                        distance_km=float(index % 250),
                    )
                    for index in range(flight_count)
                ]
            )
            db.commit()

            results: dict[str, float] = {}
            for sort_by in (
                "flight_date",
                "site_name",
                "duration_minutes",
                "max_altitude_m",
                "distance_km",
            ):
                durations_ms: list[float] = []
                for _ in range(iterations):
                    started = time.perf_counter()
                    list_flight_summaries(
                        db,
                        page_size=25,
                        cursor=None,
                        q=None,
                        site_id=None,
                        gpx_status="all",
                        sort_by=sort_by,
                        sort_order="desc",
                    )
                    durations_ms.append((time.perf_counter() - started) * 1000)
                results[sort_by] = statistics.quantiles(durations_ms, n=100, method="inclusive")[94]

        engine.dispose()

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--flights", type=int, default=10_000)
    parser.add_argument("--iterations", type=int, default=30)
    parser.add_argument("--max-p95-ms", type=float, default=200)
    args = parser.parse_args()
    if args.flights < 1 or args.iterations < 2:
        parser.error("--flights must be positive and --iterations must be at least 2")

    results = benchmark(flight_count=args.flights, iterations=args.iterations)
    for sort_by, p95_ms in results.items():
        print(f"flight summaries {sort_by} p95: {p95_ms:.1f} ms ({args.flights} flights)")
    slowest_sort, p95_ms = max(results.items(), key=lambda item: item[1])
    if p95_ms > args.max_p95_ms:
        raise SystemExit(f"p95 {p95_ms:.1f} ms exceeds the {args.max_p95_ms:.1f} ms target")
    print(f"slowest sort: {slowest_sort} ({p95_ms:.1f} ms)")


if __name__ == "__main__":
    main()
