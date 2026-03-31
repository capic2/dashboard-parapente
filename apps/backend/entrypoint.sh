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
python migrations/004_add_screenshot_paths.py || echo "⚠️ Screenshot paths migration skipped"
python migrations/005_add_forecast_date.py 2>&1 || echo "⚠️ Forecast date migration failed (see above)"

# Fallback: directly add forecast_date column via sqlite3 CLI if still missing
DB_FILE="${BACKEND_DATABASE_URL:-sqlite:///./db/dashboard.db}"
DB_FILE="${DB_FILE#sqlite:///}"
if [ -f "$DB_FILE" ]; then
    HAS_COL=$(sqlite3 "$DB_FILE" "PRAGMA table_info(emagram_analysis);" 2>/dev/null | grep -c forecast_date || true)
    if [ "$HAS_COL" = "0" ]; then
        echo "⚠️ forecast_date column still missing, adding via sqlite3 CLI..."
        sqlite3 "$DB_FILE" "ALTER TABLE emagram_analysis ADD COLUMN forecast_date DATE;" 2>&1 || true
        sqlite3 "$DB_FILE" "UPDATE emagram_analysis SET forecast_date = analysis_date WHERE forecast_date IS NULL;" 2>&1 || true
        sqlite3 "$DB_FILE" "CREATE INDEX IF NOT EXISTS idx_emagram_analysis_forecast_date ON emagram_analysis (forecast_date);" 2>&1 || true
        echo "✓ forecast_date column added via sqlite3 CLI"
    fi
fi

echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips "*"
