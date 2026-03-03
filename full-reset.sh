#!/bin/bash
# Complete reset - stops everything, removes volumes, restarts

set -e

echo "=========================================="
echo "COMPLETE DOCKER RESET"
echo "=========================================="
echo ""
echo "This will:"
echo "  - Stop all containers"
echo "  - Remove database volume"
echo "  - Remove any orphaned containers"
echo "  - Restart everything fresh"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "1️⃣  Stopping and removing containers..."
docker-compose down -v --remove-orphans

echo ""
echo "2️⃣  Removing database volume (if exists)..."
docker volume rm dashboard-parapente_dashboard-db 2>/dev/null || echo "   (Volume already removed)"

echo ""
echo "3️⃣  Listing backend files to verify they're up to date..."
ls -la backend/*.sh backend/*.py | grep -E "(startup|init_database)" || echo "   Files not found!"

echo ""
echo "4️⃣  Starting containers (will pull/rebuild if needed)..."
docker-compose up -d --force-recreate

echo ""
echo "5️⃣  Waiting 20 seconds for initialization..."
for i in {20..1}; do
    echo -ne "   Waiting... $i seconds remaining\r"
    sleep 1
done
echo ""

echo ""
echo "6️⃣  Checking startup log..."
echo "=========================================="
docker exec dashboard-backend cat /app/startup.log 2>/dev/null || echo "❌ No startup log found (this is the problem!)"

echo ""
echo "7️⃣  Checking if init_database.py exists in container..."
docker exec dashboard-backend ls -la /app/init_database.py 2>/dev/null || echo "❌ init_database.py NOT FOUND in container!"

echo ""
echo "8️⃣  Verifying database and sites..."
echo "=========================================="
docker exec dashboard-backend python -c "
import sqlite3
import os
print(f'Current directory: {os.getcwd()}')
print(f'Files in /app: {[f for f in os.listdir(\"/app\") if f.endswith(\".py\")]}')
print()
try:
    conn = sqlite3.connect('/app/db/dashboard.db')
    cursor = conn.cursor()
    cursor.execute('SELECT code, name FROM sites')
    sites = cursor.fetchall()
    print(f'✅ Found {len(sites)} sites in database:')
    for code, name in sites:
        print(f'  - {name} ({code})')
    conn.close()
    
    if len(sites) == 0:
        print()
        print('❌ ERROR: No sites in database!')
        exit(1)
except Exception as e:
    print(f'❌ Error checking database: {e}')
    import traceback
    traceback.print_exc()
    exit(1)
" 2>&1

echo ""
echo "9️⃣  Recent container logs..."
echo "=========================================="
docker logs dashboard-backend --tail 30 2>&1 | head -30

echo ""
echo "=========================================="
echo "✅ RESET COMPLETE"
echo "=========================================="
echo ""
echo "Services:"
echo "  - Backend: http://localhost:8001"
echo "  - Frontend: http://localhost:5173"
echo ""
echo "Useful commands:"
echo "  - View logs:        docker logs dashboard-backend -f"
echo "  - View startup log: docker exec dashboard-backend cat /app/startup.log"
echo "  - Shell access:     docker exec -it dashboard-backend bash"
echo ""
