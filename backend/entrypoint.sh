#!/bin/sh
set -e

echo "Running database migrations..."
python migrate_add_video_fields.py
python migrate_camera_to_angle.py
python migrate_add_site_type.py

echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips "*"
