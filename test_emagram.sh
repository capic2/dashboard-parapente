#!/bin/bash
# Quick test script for Emagram Analysis System

set -e

echo "=================================================="
echo "🧪 EMAGRAM SYSTEM - QUICK TEST"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:8001}"
TEST_LAT=45.76
TEST_LON=4.84

echo ""
echo "📍 Configuration:"
echo "   API: $API_BASE"
echo "   Test Location: Lyon ($TEST_LAT, $TEST_LON)"
echo ""

# Test 1: Check if backend is running
echo "1️⃣  Testing backend health..."
if curl -s -f "$API_BASE/" > /dev/null; then
    echo -e "   ${GREEN}✅ Backend is running${NC}"
else
    echo -e "   ${RED}❌ Backend not responding${NC}"
    echo "   Start with: docker compose up -d"
    exit 1
fi

# Test 2: Check database migration
echo ""
echo "2️⃣  Checking database schema..."
RESPONSE=$(curl -s "$API_BASE/api/emagram/latest?user_lat=$TEST_LAT&user_lon=$TEST_LON")

if echo "$RESPONSE" | grep -q "Internal Server Error\|500"; then
    echo -e "   ${RED}❌ Database error (migration may not have run)${NC}"
    echo "   Run: docker compose exec backend python migrations/add_emagram_analysis.py"
    exit 1
elif echo "$RESPONSE" | grep -q "null\|id"; then
    echo -e "   ${GREEN}✅ Database schema OK${NC}"
else
    echo -e "   ${YELLOW}⚠️  Unexpected response${NC}"
    echo "   Response: $RESPONSE"
fi

# Test 3: Check for existing analysis
echo ""
echo "3️⃣  Checking for recent analysis..."
if echo "$RESPONSE" | grep -q '"id"'; then
    SCORE=$(echo "$RESPONSE" | grep -o '"score_volabilite":[0-9]*' | grep -o '[0-9]*')
    STATION=$(echo "$RESPONSE" | grep -o '"station_name":"[^"]*"' | cut -d'"' -f4)
    echo -e "   ${GREEN}✅ Found recent analysis${NC}"
    echo "      Station: $STATION"
    echo "      Score: $SCORE/100"
else
    echo -e "   ${YELLOW}⚠️  No recent analysis found${NC}"
    echo "   This is normal for first run"
fi

# Test 4: Trigger manual analysis (optional)
echo ""
read -p "4️⃣  Trigger manual analysis? (takes ~30-60s) [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   🚀 Launching analysis..."
    echo "   (This may take 30-60 seconds...)"
    
    START_TIME=$(date +%s)
    
    ANALYSIS_RESPONSE=$(curl -s -X POST "$API_BASE/api/emagram/analyze" \
        -H "Content-Type: application/json" \
        -d "{\"user_latitude\": $TEST_LAT, \"user_longitude\": $TEST_LON, \"force_refresh\": true}")
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    if echo "$ANALYSIS_RESPONSE" | grep -q '"id"'; then
        SCORE=$(echo "$ANALYSIS_RESPONSE" | grep -o '"score_volabilite":[0-9]*' | grep -o '[0-9]*')
        STATION=$(echo "$ANALYSIS_RESPONSE" | grep -o '"station_name":"[^"]*"' | cut -d'"' -f4)
        METHOD=$(echo "$ANALYSIS_RESPONSE" | grep -o '"analysis_method":"[^"]*"' | cut -d'"' -f4)
        
        echo -e "   ${GREEN}✅ Analysis complete${NC}"
        echo "      Duration: ${DURATION}s"
        echo "      Station: $STATION"
        echo "      Score: $SCORE/100"
        echo "      Method: $METHOD"
        
        # Check if AI or classic
        if [[ "$METHOD" == "llm_vision" ]]; then
            echo -e "      ${GREEN}🤖 AI Vision analysis used${NC}"
        else
            echo -e "      ${YELLOW}📊 Classic calculations used (AI fallback)${NC}"
            echo "      Check ANTHROPIC_API_KEY if you expected AI analysis"
        fi
    else
        echo -e "   ${RED}❌ Analysis failed${NC}"
        echo "   Response: $ANALYSIS_RESPONSE" | head -c 500
        exit 1
    fi
else
    echo "   ⏭️  Skipped"
fi

# Test 5: Check scheduler status
echo ""
echo "5️⃣  Checking scheduler status..."
LOGS=$(docker compose logs backend 2>/dev/null | grep -i "emagram scheduler" | tail -5)

if [ -n "$LOGS" ]; then
    echo -e "   ${GREEN}✅ Scheduler configured${NC}"
    echo "   Recent logs:"
    echo "$LOGS" | sed 's/^/      /'
else
    echo -e "   ${YELLOW}⚠️  No scheduler logs found${NC}"
    echo "   Check with: docker compose logs backend | grep emagram"
fi

# Summary
echo ""
echo "=================================================="
echo "📊 TEST SUMMARY"
echo "=================================================="
echo ""
echo "✅ Components checked:"
echo "   - Backend health"
echo "   - Database schema"
echo "   - API endpoints"
echo "   - Analysis pipeline"
echo "   - Scheduler configuration"
echo ""
echo "📚 Next steps:"
echo "   1. Open Dashboard: http://localhost:5173"
echo "   2. Check EmagramWidget appears"
echo "   3. Monitor logs: docker compose logs -f backend"
echo "   4. Read guide: EMAGRAM_DEPLOYMENT.md"
echo ""
echo "🔑 Environment check:"

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -e "   ${GREEN}✅ ANTHROPIC_API_KEY is set${NC}"
else
    echo -e "   ${YELLOW}⚠️  ANTHROPIC_API_KEY not set${NC}"
    echo "   Export it for AI analysis: export ANTHROPIC_API_KEY='sk-ant-...'"
fi

echo ""
echo "=================================================="
echo "✅ Test complete!"
echo "=================================================="
