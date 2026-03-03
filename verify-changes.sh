#!/bin/bash
# Verify that changes are in the container

echo "=========================================="
echo "VERIFYING CHANGES IN CONTAINER"
echo "=========================================="
echo ""

echo "1️⃣  Checking main.py line 17 (should have override=False):"
docker exec dashboard-backend grep -n "load_dotenv" /app/main.py | head -3

echo ""
echo "2️⃣  Checking .env file (ENVIRONMENT should be commented):"
docker exec dashboard-backend grep "ENVIRONMENT" /app/.env

echo ""
echo "3️⃣  Checking cache.py debug logs (should have REDIS_HOST log):"
docker exec dashboard-backend grep -n "REDIS_HOST:" /app/cache.py | head -1

echo ""
echo "4️⃣  Checking startup.sh (should have playwright install):"
docker exec dashboard-backend grep -A 2 "playwright" /app/startup.sh || echo "NOT FOUND"

echo ""
echo "5️⃣  Current environment variables in container:"
docker exec dashboard-backend env | grep -E "(REDIS|ENVIRONMENT|USE_FAKE)" | sort

echo ""
echo "=========================================="
