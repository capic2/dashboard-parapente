#!/usr/bin/env python3
"""Test database creation and seeding"""

import sys
from pathlib import Path

print("=" * 50)
print("Testing Database Creation and Seeding")
print("=" * 50)

# Test 1: Import and show paths
print("\n1. Checking paths...")
from database import DATABASE_URL, DB_PATH, Base, engine
import models  # Import models to register them with Base
print(f"   DATABASE_URL: {DATABASE_URL}")
print(f"   DB_PATH: {DB_PATH}")
print(f"   DB_PATH exists: {DB_PATH.exists()}")
print(f"   DB_PATH parent exists: {DB_PATH.parent.exists()}")

# Test 2: Create schema
print("\n2. Creating schema...")
try:
    Base.metadata.create_all(bind=engine)
    print("   ✅ Schema created successfully")
except Exception as e:
    print(f"   ❌ Error creating schema: {e}")
    sys.exit(1)

# Test 3: Verify database file
print("\n3. Verifying database file...")
if DB_PATH.exists():
    print(f"   ✅ Database file exists at {DB_PATH}")
    print(f"   File size: {DB_PATH.stat().st_size} bytes")
else:
    print(f"   ❌ Database file not found at {DB_PATH}")
    sys.exit(1)

# Test 4: Seed sites
print("\n4. Seeding sites...")
try:
    from seed_sites import seed_sites
    success = seed_sites()
    if success:
        print("   ✅ Sites seeded successfully")
    else:
        print("   ❌ seed_sites() returned False")
        sys.exit(1)
except Exception as e:
    print(f"   ❌ Error seeding sites: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 5: Verify sites in database
print("\n5. Verifying sites in database...")
import sqlite3
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM sites')
count = cursor.fetchone()[0]
print(f"   Sites in database: {count}")

if count > 0:
    cursor.execute('SELECT code, name FROM sites')
    sites = cursor.fetchall()
    for code, name in sites:
        print(f"   - {name} ({code})")
    print("\n✅ All tests passed!")
else:
    print("   ❌ No sites found in database")
    sys.exit(1)

conn.close()
