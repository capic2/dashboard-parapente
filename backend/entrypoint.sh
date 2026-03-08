#!/bin/sh
set -e

echo "Initializing database..."
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine); print('✅ Database tables created')"

echo "Running database migrations..."
python migrate_add_video_fields.py || echo "⚠️ Video fields migration skipped"
python migrate_camera_to_angle.py || echo "⚠️ Camera angle migration skipped"
python migrate_add_site_type.py || echo "⚠️ Site type migration skipped"
python migrations/add_weather_source_config.py || echo "⚠️ Weather source config migration skipped"
python migrations/add_emagram_analysis.py || echo "⚠️ Emagram analysis migration skipped"
python migrations/003_add_multi_source_emagram_fields.py || echo "⚠️ Multi-source emagram fields migration skipped"

echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips "*"
