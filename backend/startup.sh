#!/bin/bash
# Startup script for dashboard backend
# Ensures proper initialization order

set -e  # Exit on error
set -x  # Print commands for debugging

echo "=========================================="
echo "🚀 Starting Dashboard Backend..."
echo "=========================================="

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt 2>&1 | tail -5

# Ensure db directory exists
echo "📁 Ensuring /app/db directory exists..."
mkdir -p /app/db
ls -la /app/db/ || echo "Directory listing failed"

# Create database schema and seed sites
echo "=========================================="
echo "🗄️  Creating database schema and seeding sites..."
echo "=========================================="
python << 'EOF'
import sys
from pathlib import Path
import os

print(f"Current working directory: {os.getcwd()}")
print(f"Python version: {sys.version}")

# Create schema
print("\n1. Creating database schema...")
try:
    from database import Base, engine, DB_PATH
    print(f"   DATABASE_URL from environment: {os.getenv('DATABASE_URL', 'not set')}")
    print(f"   DB_PATH: {DB_PATH}")
    print(f"   DB_PATH absolute: {DB_PATH.absolute()}")
    print(f"   DB_PATH parent exists: {DB_PATH.parent.exists()}")
    
    import models  # Import models to register them with Base
    print(f"   Models imported successfully")
    print(f"   Tables to create: {list(Base.metadata.tables.keys())}")
    
    Base.metadata.create_all(bind=engine)
    print(f"   ✅ Schema created at {DB_PATH}")
except Exception as e:
    print(f"   ❌ Error creating schema: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Verify database file exists
print("\n2. Verifying database file...")
if not DB_PATH.exists():
    print(f"   ❌ Error: Database file not created at {DB_PATH}")
    sys.exit(1)
else:
    size = DB_PATH.stat().st_size
    print(f"   ✅ Database file exists: {size} bytes")
    if size == 0:
        print(f"   ⚠️  WARNING: Database file is empty!")
        sys.exit(1)

# Seed sites
print("\n3. Seeding sites...")
try:
    from seed_sites import seed_sites
    success = seed_sites()
    if success:
        print("   ✅ Sites seeded successfully")
    else:
        print("   ❌ Failed to seed sites")
        sys.exit(1)
except Exception as e:
    print(f"   ❌ Error seeding sites: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n========================================")
print("✅ Database initialization complete!")
print("========================================\n")
EOF

# Verify one more time
echo "Final verification..."
ls -lh /app/db/dashboard.db || echo "❌ Database file not found!"

# Start uvicorn
echo "=========================================="
echo "🚀 Starting uvicorn..."
echo "=========================================="
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
