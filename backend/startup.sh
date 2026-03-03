#!/bin/bash
# Startup script for dashboard backend
# Ensures proper initialization order

echo "🚀 Starting Dashboard Backend..."

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

# Start uvicorn in background to create DB schema
echo "🗄️  Creating database schema..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!

# Wait for uvicorn to start and create schema
echo "⏳ Waiting for schema creation..."
sleep 5

# Check if database exists and seed sites
if [ -f "/app/db/dashboard.db" ]; then
    echo "✅ Database file exists, seeding sites..."
    python seed_sites.py
else
    echo "⚠️  Database file not found, will retry on next startup"
fi

# Wait for background uvicorn
echo "✅ Startup complete, uvicorn running..."
wait $UVICORN_PID
