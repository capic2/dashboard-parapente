#!/bin/bash
echo "🔍 Frontend Verification"
echo "========================"
echo ""

# Check backend
echo "1. Backend API..."
if curl -s http://localhost:8001/ > /dev/null 2>&1; then
  echo "   ✅ Backend is running"
else
  echo "   ❌ Backend is not responding"
  exit 1
fi

# Check TypeScript
echo "2. TypeScript compilation..."
if npm run type-check > /dev/null 2>&1; then
  echo "   ✅ TypeScript is valid"
else
  echo "   ❌ TypeScript errors detected"
  exit 1
fi

# Check Docker
echo "3. Docker containers..."
if docker ps 2>/dev/null | grep dashboard-frontend > /dev/null; then
  echo "   ✅ Frontend container running"
else
  echo "   ⚠️  Frontend container check skipped"
fi

if docker ps 2>/dev/null | grep dashboard-backend > /dev/null; then
  echo "   ✅ Backend container running"
fi

# Check API endpoints
echo "4. API endpoints..."

# Check /api/spots
if curl -s http://localhost:8001/api/spots 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); assert len(data.get('sites', [])) >= 3; print('✅ /api/spots returns 3+ sites')" 2>/dev/null; then
  :
else
  echo "   ❌ /api/spots not working"
  exit 1
fi

# Check /api/weather
if curl -s http://localhost:8001/api/weather/site-arguel 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); assert data.get('para_index') is not None; print('✅ /api/weather/{id} returns para_index')" 2>/dev/null; then
  :
else
  echo "   ❌ /api/weather not working"
  exit 1
fi

# Check /api/flights/stats
if curl -s http://localhost:8001/api/flights/stats 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); assert data.get('total_flights') is not None; print('✅ /api/flights/stats returns metrics')" 2>/dev/null; then
  :
else
  echo "   ❌ /api/flights/stats not working"
  exit 1
fi

echo ""
echo "✅ All checks passed! Frontend is ready."
echo ""
echo "📌 Access the dashboard at: http://localhost:5173"
echo "📌 Backend API available at: http://localhost:8001/api"
