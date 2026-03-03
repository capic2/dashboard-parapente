#!/bin/bash
# Startup script for dashboard backend
# Simple startup - database initialization is handled by main.py

set -e  # Exit on error

echo "=========================================="
echo "🚀 DASHBOARD BACKEND STARTUP"
echo "=========================================="
echo ""

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt 2>&1 | tail -3
echo "✓ Dependencies installed"
echo ""

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
python -m playwright install chromium --with-deps 2>&1 | tail -5
echo "✓ Playwright browsers installed"
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
