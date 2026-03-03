#!/bin/bash
# Startup script for dashboard backend
# Ensures proper initialization order

set -e

echo "🚀 Starting Dashboard Backend..."

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

# Ensure db directory exists
mkdir -p /app/db

# Create database schema and seed sites
echo "🗄️  Creating database schema and seeding sites..."
python << 'EOF'
import sys
from pathlib import Path

# Create schema
print("Creating database schema...")
from database import Base, engine, DB_PATH
import models  # Import models to register them with Base
Base.metadata.create_all(bind=engine)
print(f"✅ Schema created at {DB_PATH}")

# Verify database file exists
if not DB_PATH.exists():
    print(f"❌ Error: Database file not created at {DB_PATH}")
    sys.exit(1)

# Seed sites
print("Seeding sites...")
from seed_sites import seed_sites
success = seed_sites()
if success:
    print("✅ Sites seeded successfully")
else:
    print("❌ Failed to seed sites")
    sys.exit(1)
EOF

# Start uvicorn
echo "🚀 Starting uvicorn..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
