#!/bin/bash
# Test script to verify Redis and Playwright fixes

set -e

echo "=========================================="
echo "TESTING FIXES"
echo "=========================================="
echo ""

echo "1️⃣  Restarting Docker services..."
docker-compose restart dashboard-backend

echo ""
echo "2️⃣  Waiting 30 seconds for initialization..."
sleep 30

echo ""
echo "3️⃣  Checking Redis connection in logs..."
echo "=========================================="
docker logs dashboard-backend 2>&1 | grep -i "redis" | tail -10

echo ""
echo "4️⃣  Checking Playwright installation..."
echo "=========================================="
docker logs dashboard-backend 2>&1 | grep -i "playwright" | tail -5

echo ""
echo "5️⃣  Checking for errors..."
echo "=========================================="
REDIS_ERRORS=$(docker logs dashboard-backend 2>&1 | grep -c "Failed to connect to Redis" || true)
PLAYWRIGHT_ERRORS=$(docker logs dashboard-backend 2>&1 | grep -c "Executable doesn't exist" || true)

echo "Redis connection errors: $REDIS_ERRORS"
echo "Playwright errors: $PLAYWRIGHT_ERRORS"

if [ "$REDIS_ERRORS" -gt 0 ]; then
    echo "⚠️  Redis connection issues detected"
else
    echo "✅ No Redis connection errors"
fi

if [ "$PLAYWRIGHT_ERRORS" -gt 0 ]; then
    echo "⚠️  Playwright installation issues detected"
else
    echo "✅ No Playwright errors"
fi

echo ""
echo "6️⃣  Recent logs..."
echo "=========================================="
docker logs dashboard-backend --tail 20

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
