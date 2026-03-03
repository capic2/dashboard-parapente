#!/bin/bash
# Reset Docker database and restart

set -e

echo "=========================================="
echo "RESETTING DOCKER DATABASE"
echo "=========================================="

echo ""
echo "1️⃣  Stopping containers..."
docker-compose down

echo ""
echo "2️⃣  Removing database volume..."
docker volume rm dashboard-parapente_dashboard-db 2>/dev/null || echo "   (Volume doesn't exist or already removed)"

echo ""
echo "3️⃣  Starting containers..."
docker-compose up -d

echo ""
echo "4️⃣  Waiting for backend to initialize (15 seconds)..."
sleep 15

echo ""
echo "5️⃣  Checking initialization logs..."
echo "=========================================="
docker logs dashboard-backend 2>&1 | grep -A 50 "DATABASE INITIALIZATION" || echo "❌ No initialization logs found!"

echo ""
echo "6️⃣  Verifying database..."
echo "=========================================="
docker exec dashboard-backend python -c "
import sqlite3
try:
    conn = sqlite3.connect('/app/db/dashboard.db')
    cursor = conn.cursor()
    cursor.execute('SELECT code, name FROM sites')
    sites = cursor.fetchall()
    print(f'\n✅ Found {len(sites)} sites in database:')
    for code, name in sites:
        print(f'  - {name} ({code})')
    conn.close()
    
    if len(sites) == 0:
        print('\n❌ ERROR: No sites found!')
        exit(1)
    else:
        print(f'\n✅ Database is properly initialized!')
except Exception as e:
    print(f'\n❌ Error: {e}')
    exit(1)
" || echo "❌ Failed to verify database"

echo ""
echo "=========================================="
echo "✅ RESET COMPLETE"
echo "=========================================="
echo ""
echo "Backend is running on: http://localhost:8001"
echo "Frontend is running on: http://localhost:5173"
echo ""
echo "To view logs: docker logs dashboard-backend -f"
echo ""
