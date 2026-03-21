#!/bin/bash
# Run backend tests with coverage

set -e

echo "🧪 Running Dashboard Parapente Backend Tests"
echo "============================================="
echo ""

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "❌ No virtual environment found (venv or .venv)"
    exit 1
fi

# Install test dependencies if needed
echo "📦 Checking test dependencies..."
pip install -q pytest pytest-asyncio pytest-cov fakeredis

# Run tests based on arguments
if [ "$1" == "unit" ]; then
    echo "🔬 Running unit tests only..."
    pytest -m "not integration and not slow" tests/
elif [ "$1" == "integration" ]; then
    echo "🌐 Running integration tests..."
    pytest -m "integration" tests/
elif [ "$1" == "fast" ]; then
    echo "⚡ Running fast tests (no coverage)..."
    pytest -m "not slow" tests/ --no-cov
elif [ "$1" == "coverage" ]; then
    echo "📊 Running tests with coverage report..."
    pytest tests/ --cov=. --cov-report=html --cov-report=term
    echo ""
    echo "✅ Coverage report generated in htmlcov/index.html"
else
    echo "🧪 Running all tests..."
    pytest tests/
fi

echo ""
echo "✅ Tests complete!"
