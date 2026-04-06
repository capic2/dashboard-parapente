#!/bin/sh
set -e

echo "Initializing database..."
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine); print('✅ Database tables created')"

# SQL migrations are run automatically by run_migrations() in main.py at import time.
# No need to run them manually here.

echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips "*"
