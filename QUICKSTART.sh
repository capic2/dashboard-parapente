#!/bin/bash
# Quick start script for Dashboard Parapente Week 2 testing

set -e  # Exit on error

echo "🚀 Dashboard Parapente - Quick Start"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: Run this script from the dashboard directory"
    echo "   cd /home/capic/.openclaw/workspace/paragliding/dashboard"
    exit 1
fi

echo -e "${BLUE}Step 1: Database Setup${NC}"
echo "-------------------------------------"

cd backend

# Check if database exists
if [ -f "db/dashboard.db" ]; then
    echo "⚠️  Database already exists"
    read -p "Reset and reseed? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f db/dashboard.db
        echo "✅ Database deleted"
    else
        echo "Keeping existing database"
    fi
fi

# Initialize database
if [ ! -f "db/dashboard.db" ]; then
    echo "Creating database..."
    python3 init_db.py
fi

# Seed flights
echo ""
echo "Seeding sample flights..."
python3 seed_flights.py

echo ""
echo -e "${BLUE}Step 2: Backend Dependencies${NC}"
echo "-------------------------------------"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt 2>/dev/null || echo "⚠️  requirements.txt not found, skipping"

echo ""
echo -e "${BLUE}Step 3: Frontend Dependencies${NC}"
echo "-------------------------------------"

cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
else
    echo "✅ Node modules already installed"
fi

cd ..

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Start the backend:"
echo "   cd backend && source venv/bin/activate && uvicorn main:app --reload"
echo ""
echo "2. In a new terminal, test the API:"
echo "   cd backend && python3 test_endpoints.py"
echo ""
echo "3. In another terminal, start the frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "4. Open your browser:"
echo "   http://localhost:5173"
echo ""
echo "📚 For more details, see WEEK2_IMPLEMENTATION.md"
echo ""
