#!/bin/bash
# Check Redis environment variables in container

echo "=========================================="
echo "CHECKING REDIS ENVIRONMENT"
echo "=========================================="
echo ""

echo "1️⃣  Environment variables in container:"
docker exec dashboard-backend env | grep -E "(REDIS|ENVIRONMENT|USE_FAKE)" | sort

echo ""
echo "2️⃣  Redis logs from startup:"
docker logs dashboard-backend 2>&1 | grep -A 5 "REDIS_HOST:"

echo ""
echo "3️⃣  All Redis-related logs:"
docker logs dashboard-backend 2>&1 | grep -i "redis" | tail -20

echo ""
echo "=========================================="
