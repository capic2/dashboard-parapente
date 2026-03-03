#!/bin/bash
# Startup script for dashboard backend
# Ensures proper initialization order

set -e

echo "🚀 Starting Dashboard Backend..."

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

# Create database schema explicitly
echo "🗄️  Creating database schema..."
python -c "
from database import Base, engine
Base.metadata.create_all(bind=engine)
print('✅ Schema created')
"

# Seed sites
echo "🌱 Seeding sites..."
python seed_sites.py

# Start uvicorn
echo "🚀 Starting uvicorn..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
