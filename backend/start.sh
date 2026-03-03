#!/bin/bash
set -e

cd /app

echo "📦 Installing dependencies..."
pip install --no-cache-dir -q fastapi uvicorn sqlalchemy pydantic python-dotenv aiofiles playwright requests beautifulsoup4 httpx pytest pytest-asyncio apscheduler

echo "🗄️ Creating database schema..."
python -c "
from database import Base, engine
import models
Base.metadata.create_all(bind=engine)
print('✅ Schema created')
"

echo "🌱 Seeding sites..."
python seed_sites.py

echo "🚀 Starting uvicorn..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
