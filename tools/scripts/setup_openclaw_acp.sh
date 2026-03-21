#!/bin/bash
#
# Setup script for OpenClaw ACP integration
# This script guides you through setting up OpenClaw for emagram analysis
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "OpenClaw ACP Setup for Emagram Analysis"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if openclaw is installed
echo "Step 1: Checking if OpenClaw is installed..."
if command -v openclaw &> /dev/null; then
    VERSION=$(openclaw --version 2>&1 || echo "unknown")
    echo -e "${GREEN}✓${NC} OpenClaw is installed: $VERSION"
else
    echo -e "${RED}✗${NC} OpenClaw is not installed"
    echo ""
    echo "Install OpenClaw with:"
    echo "  npm install -g openclaw@latest"
    echo ""
    echo "Or with pnpm:"
    echo "  pnpm add -g openclaw@latest"
    echo ""
    exit 1
fi

# Check if gateway is configured
echo ""
echo "Step 2: Checking OpenClaw Gateway status..."
if openclaw status &> /dev/null; then
    echo -e "${GREEN}✓${NC} OpenClaw Gateway is configured"
    
    # Check if running
    if openclaw status 2>&1 | grep -q "running"; then
        echo -e "${GREEN}✓${NC} Gateway is running"
    else
        echo -e "${YELLOW}⚠${NC} Gateway is not running"
        echo ""
        echo "Start the gateway with:"
        echo "  openclaw gateway --port 18789"
        echo ""
        echo "Or install as daemon:"
        echo "  openclaw gateway install"
        echo ""
    fi
else
    echo -e "${YELLOW}⚠${NC} OpenClaw Gateway is not configured"
    echo ""
    echo "Run the onboarding wizard:"
    echo "  openclaw onboard --install-daemon"
    echo ""
    exit 1
fi

# Update .env file
echo ""
echo "Step 3: Configuring .env file..."
ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗${NC} .env file not found at $ENV_FILE"
    exit 1
fi

# Check if ACP config exists
if grep -q "OPENCLAW_ACP_ENABLED" "$ENV_FILE"; then
    echo -e "${GREEN}✓${NC} OpenClaw ACP configuration found in .env"
else
    echo -e "${YELLOW}⚠${NC} Adding OpenClaw ACP configuration to .env"
    
    cat >> "$ENV_FILE" << 'EOF'

# ==========================================
# OpenClaw ACP Configuration
# ==========================================
# Enable OpenClaw ACP for emagram analysis
OPENCLAW_ACP_ENABLED=true

# OpenClaw command (default: openclaw)
OPENCLAW_COMMAND=openclaw

# Agent to use (optional): claude, codex, gemini, pi, opencode
OPENCLAW_AGENT_ID=claude

# Analysis timeout in seconds (default: 120)
OPENCLAW_TIMEOUT=120
EOF
    
    echo -e "${GREEN}✓${NC} Configuration added to .env"
fi

# Run test
echo ""
echo "Step 4: Running integration test..."
echo ""

cd "$PROJECT_ROOT"
if python3 backend/test_acp_integration.py; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "✓ OpenClaw ACP setup complete!"
    echo "==========================================${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start the backend: cd backend && uvicorn main:app --reload"
    echo "  2. Run the scheduler: python backend/emagram_scheduler/emagram_scheduler.py"
    echo "  3. Check the dashboard: http://localhost:8000"
    echo ""
else
    echo ""
    echo -e "${RED}=========================================="
    echo "✗ Integration test failed"
    echo "==========================================${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check Gateway status: openclaw status"
    echo "  2. View Gateway logs: openclaw logs --follow"
    echo "  3. Run diagnostics: openclaw doctor"
    echo ""
    echo "See docs/OPENCLAW_ACP_INTEGRATION.md for more help"
    echo ""
    exit 1
fi
