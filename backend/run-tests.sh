#!/bin/bash
# Run all backend tests

set -e

cd "$(dirname "$0")"
source venv_311/bin/activate

echo "🧪 Running Dashboard Parapente Backend Tests"
echo "==========================================="

# Run all tests with coverage
pytest tests/ \
    --cov=. \
    --cov-report=html \
    --cov-report=term-missing \
    --cov-exclude="venv*,__pycache__,conftest.py" \
    -v

echo ""
echo "✅ All tests completed!"
echo "📊 Coverage report: htmlcov/index.html"
