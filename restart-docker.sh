#!/bin/bash
# Simple restart script for Docker

set -e

echo "=========================================="
echo "RESTARTING DOCKER SERVICES"
echo "=========================================="
echo ""

echo "1️⃣  Stopping containers..."
docker-compose down

echo ""
echo "2️⃣  Removing old database volume..."
docker volume rm dashboard-parapente_dashboard-db 2>/dev/null || echo "   (Volume already removed or doesn't exist)"

echo ""
echo "3️⃣  Starting containers..."
docker-compose up -d

echo ""
echo "4️⃣  Waiting for services to start (15 seconds)..."
sleep 15

echo ""
echo "5️⃣  Checking backend logs..."
echo "=========================================="
docker logs dashboard-backend 2>&1 | grep -A 15 "DATABASE INITIALIZATION" || echo "Showing recent logs instead:"
docker logs dashboard-backend --tail 30

echo ""
echo "6️⃣  Verifying sites in database..."
echo "=========================================="
docker exec dashboard-backend python -c "
from database import SessionLocal
from models import Site

db = SessionLocal()
sites = db.query(Site).all()
db.close()

print(f'\n✅ Found {len(sites)} sites in database:\n')
for site in sites:
    print(f'  - {site.name} ({site.code})')

if len(sites) == 0:
    print('\n❌ ERROR: No sites found!')
    exit(1)
else:
    print(f'\n✅ Database properly initialized with {len(sites)} sites!')
" 2>&1

echo ""
echo "=========================================="
echo "✅ RESTART COMPLETE"
echo "=========================================="
echo ""
echo "Services:"
echo "  - Backend:  http://localhost:8001"
echo "  - Frontend: http://localhost:5173"
echo ""
echo "Useful commands:"
echo "  - View logs:    docker logs dashboard-backend -f"
echo "  - Shell access: docker exec -it dashboard-backend bash"
echo ""
