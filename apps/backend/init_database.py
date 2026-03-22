#!/usr/bin/env python3
"""
Initialize database schema and seed sites
Called by startup.sh during Docker container initialization
"""

import os
import sys

print("=" * 60)
print("DATABASE INITIALIZATION")
print("=" * 60)

print(f"\n📍 Current working directory: {os.getcwd()}")
print(f"🐍 Python version: {sys.version}")
print(f"🌍 DATABASE_URL env: {os.getenv('DATABASE_URL', 'not set')}")

# Step 1: Create schema
print("\n" + "=" * 60)
print("STEP 1: Creating database schema")
print("=" * 60)

try:
    from database import DB_PATH, Base, engine

    print("✓ Database module imported")
    print(f"  DB_PATH: {DB_PATH}")
    print(f"  DB_PATH absolute: {DB_PATH.absolute()}")
    print(f"  DB_PATH parent exists: {DB_PATH.parent.exists()}")

    # Ensure db directory exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    print("✓ Database directory ensured")

    # Import models to register them with Base

    print("✓ Models module imported")

    # List tables that will be created
    table_names = list(Base.metadata.tables.keys())
    print(f"✓ Tables to create: {table_names}")
    print(f"  Total: {len(table_names)} tables")

    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✓ Schema created successfully")

except Exception as e:
    print(f"\n❌ ERROR creating schema: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)

# Step 2: Verify database file
print("\n" + "=" * 60)
print("STEP 2: Verifying database file")
print("=" * 60)

if not DB_PATH.exists():
    print(f"❌ ERROR: Database file not created at {DB_PATH}")
    sys.exit(1)

size = DB_PATH.stat().st_size
print("✓ Database file exists")
print(f"  Path: {DB_PATH}")
print(f"  Size: {size:,} bytes")

if size == 0:
    print("❌ ERROR: Database file is empty (0 bytes)")
    print("  This means no tables were created")
    sys.exit(1)

# Step 3: Verify tables in database
print("\n" + "=" * 60)
print("STEP 3: Verifying tables in database")
print("=" * 60)

try:
    import sqlite3

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"✓ Tables found in database: {len(tables)}")
    for table in tables:
        print(f"  - {table[0]}")
    conn.close()

    if len(tables) == 0:
        print("❌ ERROR: No tables found in database!")
        sys.exit(1)

except Exception as e:
    print(f"❌ ERROR verifying tables: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)

# Step 4: Seed sites
print("\n" + "=" * 60)
print("STEP 4: Seeding sites")
print("=" * 60)

try:
    from seed_sites import seed_sites

    print("✓ seed_sites module imported")

    success = seed_sites()

    if success:
        print("✓ Sites seeded successfully")
    else:
        print("❌ ERROR: seed_sites() returned False")
        sys.exit(1)

except Exception as e:
    print(f"❌ ERROR seeding sites: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)

# Step 5: Final verification
print("\n" + "=" * 60)
print("STEP 5: Final verification")
print("=" * 60)

try:
    import sqlite3

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM sites")
    count = cursor.fetchone()[0]
    print(f"✓ Sites in database: {count}")

    if count > 0:
        cursor.execute("SELECT code, name FROM sites LIMIT 10")
        sites = cursor.fetchall()
        for code, name in sites:
            print(f"  - {name} ({code})")
    else:
        print("❌ ERROR: No sites found in database!")
        sys.exit(1)

    conn.close()

except Exception as e:
    print(f"❌ ERROR in final verification: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ DATABASE INITIALIZATION COMPLETE")
print("=" * 60)
print()
