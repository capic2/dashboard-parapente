#!/bin/bash
# Quick script to manually trigger weather data refresh

echo "🔄 Triggering manual weather refresh..."
curl -X POST http://localhost:8001/api/admin/refresh-weather \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo ""
echo "✅ Done! Check the response above for status."
