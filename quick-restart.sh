#!/bin/bash
# Quick restart to test changes

echo "Restarting backend container..."
docker-compose restart dashboard-backend

echo "Waiting 20 seconds..."
sleep 20

echo ""
echo "===== ENVIRONMENT VARIABLES ====="
docker exec dashboard-backend env | grep -E "(REDIS|ENVIRONMENT|USE_FAKE)" | sort

echo ""
echo "===== REDIS CONNECTION LOGS ====="
docker logs dashboard-backend 2>&1 | grep -E "(REDIS_HOST:|Connecting to Redis|Redis connection)" | tail -10

echo ""
echo "===== RECENT ERRORS ====="
docker logs dashboard-backend 2>&1 | grep "ERROR" | tail -5

echo ""
echo "Done! Full logs: docker logs dashboard-backend -f"
