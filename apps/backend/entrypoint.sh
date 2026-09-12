#!/bin/sh
set -e

CODEX_HOME="${CODEX_HOME:-/app/codex-home}"
mkdir -p "$CODEX_HOME"
chmod 700 "$CODEX_HOME"
if [ -f "$CODEX_HOME/auth.json" ]; then
    chmod 600 "$CODEX_HOME/auth.json"
fi

echo "Initializing database..."
if [ "${ENVIRONMENT:-production}" = "staging" ]; then
    python init_database.py
    python -c "from seed_flights import seed_flights; print(f'✅ Sample flights created: {seed_flights(include_media=True)}')"
else
    python -c "from database import Base, engine; Base.metadata.create_all(bind=engine); print('✅ Database tables created')"
fi

# SQL migrations are run automatically by run_migrations() in main.py at import time.
# No need to run them manually here.

echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips "*"
