#!/usr/bin/env python3
"""Initialize database for E2E tests - creates tables with test data"""

import os
import sys

# Force production-like initialization (with real tables)
os.environ["TESTING"] = "false"
os.environ["BACKEND_DATABASE_URL"] = "sqlite:///./test.db"

# Set minimal required env vars for config validation
os.environ.setdefault("BACKEND_WEATHERAPI_KEY", "test_key")
os.environ.setdefault("BACKEND_METEOBLUE_API_KEY", "test_key")
os.environ.setdefault("BACKEND_STRAVA_VERIFY_TOKEN", "PARAPENTE_E2E_TEST")

# Import after setting env vars
from main import initialize_database, run_migrations

if __name__ == "__main__":
    print("🔧 Initializing E2E test database...")
    try:
        initialize_database()
        run_migrations()
        print("✅ E2E database initialized successfully!")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Failed to initialize E2E database: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
