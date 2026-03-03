#!/bin/bash
# Startup script for dashboard backend
# Dependencies and Playwright are pre-installed in Docker image

set -e

echo "=========================================="
echo "🚀 DASHBOARD BACKEND STARTUP"
echo "=========================================="
echo ""

# Ensure db directory exists
echo "📁 Ensuring /app/db directory exists..."
mkdir -p /app/db
echo "✓ Directory ready"
echo ""

# Start uvicorn (database initialization happens in main.py)
echo "🚀 Starting uvicorn..."
echo "   Database will be initialized automatically on startup"
echo ""

exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
