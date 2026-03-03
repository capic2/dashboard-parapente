#!/bin/bash
# Diagnostic script for Docker database issues

echo "=========================================="
echo "Docker Database Diagnostic"
echo "=========================================="

echo -e "\n1. Checking if container is running..."
docker ps | grep dashboard-backend

echo -e "\n2. Checking /app/db directory contents..."
docker exec dashboard-backend ls -lah /app/db/ 2>&1 || echo "Failed to list directory"

echo -e "\n3. Checking database file size..."
docker exec dashboard-backend stat /app/db/dashboard.db 2>&1 || echo "Database file not found"

echo -e "\n4. Checking if database has tables..."
docker exec dashboard-backend python -c "
import sqlite3
import sys
try:
    conn = sqlite3.connect('/app/db/dashboard.db')
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM sqlite_master WHERE type=\"table\"')
    tables = cursor.fetchall()
    print(f'Tables found: {len(tables)}')
    for table in tables:
        print(f'  - {table[0]}')
        cursor.execute(f'SELECT COUNT(*) FROM {table[0]}')
        count = cursor.fetchone()[0]
        print(f'    Rows: {count}')
    conn.close()
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
" 2>&1 || echo "Failed to query database"

echo -e "\n5. Checking startup.sh permissions..."
docker exec dashboard-backend ls -la /app/startup.sh 2>&1 || echo "startup.sh not found"

echo -e "\n6. Checking environment variables..."
docker exec dashboard-backend printenv | grep -E '(DATABASE_URL|PYTHONUNBUFFERED)' 2>&1 || echo "Failed to get env vars"

echo -e "\n7. Getting last 30 lines of container logs..."
docker logs dashboard-backend --tail 30

echo -e "\n=========================================="
echo "Diagnostic complete"
echo "=========================================="
