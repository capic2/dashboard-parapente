#!/bin/bash
# Force complete restart with all changes

set -e

echo "=========================================="
echo "FORCING COMPLETE RESTART"
echo "=========================================="
echo ""

echo "1️⃣  Verifying local files have the changes..."
echo ""
echo "   Checking main.py:"
grep "load_dotenv(override=False)" backend/main.py && echo "   ✅ main.py is correct" || echo "   ❌ main.py NOT updated"

echo ""
echo "   Checking .env:"
grep "# ENVIRONMENT=development" backend/.env && echo "   ✅ .env is correct" || echo "   ❌ .env NOT updated"

echo ""
echo "   Checking startup.sh:"
grep "playwright install" backend/startup.sh && echo "   ✅ startup.sh is correct" || echo "   ❌ startup.sh NOT updated"

echo ""
echo "2️⃣  Stopping all containers..."
docker-compose down

echo ""
echo "3️⃣  Removing volumes to force fresh start..."
docker volume rm dashboard-parapente_dashboard-db 2>/dev/null || echo "   (Database volume removed or didn't exist)"

echo ""
echo "4️⃣  Starting containers with fresh volumes..."
docker-compose up -d --force-recreate

echo ""
echo "5️⃣  Waiting 30 seconds for full initialization..."
for i in {30..1}; do
    printf "\r   Waiting... %2d seconds remaining" $i
    sleep 1
done
echo ""

echo ""
echo "6️⃣  Verifying changes are in container..."
echo ""
echo "   main.py override parameter:"
docker exec dashboard-backend grep "load_dotenv" /app/main.py | grep override

echo ""
echo "   .env ENVIRONMENT line:"
docker exec dashboard-backend grep ENVIRONMENT /app/.env

echo ""
echo "7️⃣  Checking environment variables:"
docker exec dashboard-backend env | grep -E "(REDIS_HOST|REDIS_PORT|ENVIRONMENT|USE_FAKE_REDIS)" | sort

echo ""
echo "8️⃣  Checking recent logs for Redis connection..."
docker logs dashboard-backend 2>&1 | grep -E "(REDIS_HOST:|Connecting to Redis|Redis connection established)" | tail -5

echo ""
echo "9️⃣  Checking for Playwright installation..."
docker logs dashboard-backend 2>&1 | grep -i "playwright" | head -3

echo ""
echo "🔟  Verifying sites in database..."
docker exec dashboard-backend python -c "
from database import SessionLocal
from models import Site
db = SessionLocal()
count = db.query(Site).count()
db.close()
print(f'Sites in database: {count}')
if count == 0:
    exit(1)
" || echo "❌ No sites found!"

echo ""
echo "=========================================="
echo "✅ RESTART COMPLETE"
echo "=========================================="
echo ""
echo "Check full logs with: docker logs dashboard-backend -f"
echo ""
