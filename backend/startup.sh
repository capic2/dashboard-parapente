#!/bin/bash
# Startup script for dashboard backend
# Ensures proper initialization order

set -e  # Exit on error

echo "=========================================="
echo "🚀 DASHBOARD BACKEND STARTUP"
echo "=========================================="
echo ""

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt 2>&1 | tail -3
echo ""

# Ensure db directory exists
echo "📁 Ensuring /app/db directory exists..."
mkdir -p /app/db
echo ""

# Initialize database (schema + seed)
echo "🗄️  Initializing database..."
python /app/init_database.py

# Exit if database initialization failed
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Database initialization failed!"
    echo "Exiting..."
    exit 1
fi

# Final verification
echo ""
echo "📋 Final verification..."
if [ -f /app/db/dashboard.db ]; then
    SIZE=$(stat -f%z /app/db/dashboard.db 2>/dev/null || stat -c%s /app/db/dashboard.db 2>/dev/null)
    echo "✓ Database file: /app/db/dashboard.db ($SIZE bytes)"
else
    echo "❌ Database file not found!"
    exit 1
fi

# Start uvicorn
echo ""
echo "=========================================="
echo "🚀 STARTING UVICORN"
echo "=========================================="
echo ""
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
