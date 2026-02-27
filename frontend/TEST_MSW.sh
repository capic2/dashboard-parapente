#!/bin/bash
# Script de test rapide pour vérifier que MSW fonctionne

echo "🧪 Test MSW - Dashboard Parapente"
echo "=================================="
echo ""

cd "$(dirname "$0")"

echo "📁 Vérification de la structure..."
if [ -f "src/mocks/handlers.ts" ] && [ -f "src/mocks/data.ts" ] && [ -f "src/mocks/browser.ts" ]; then
    echo "✅ Fichiers MSW présents"
else
    echo "❌ Fichiers MSW manquants"
    exit 1
fi

if [ -f "public/mockServiceWorker.js" ]; then
    echo "✅ Service worker présent"
else
    echo "❌ Service worker manquant - exécuter: npx msw init public/"
    exit 1
fi

echo ""
echo "📦 Vérification de package.json..."
if grep -q '"msw"' package.json; then
    echo "✅ MSW installé dans package.json"
else
    echo "❌ MSW non installé - exécuter: npm install -D msw"
    exit 1
fi

echo ""
echo "🔍 Vérification de main.tsx..."
if grep -q "enableMocking" src/main.tsx; then
    echo "✅ MSW activé dans main.tsx"
else
    echo "❌ MSW non activé dans main.tsx"
    exit 1
fi

echo ""
echo "✅ Tous les tests structurels passent!"
echo ""
echo "🚀 Pour tester en live:"
echo "   1. npm run dev"
echo "   2. Ouvrir http://localhost:5173"
echo "   3. F12 → Console"
echo "   4. Vérifier le message '[MSW] Mocking enabled.'"
echo ""
echo "📊 Endpoints disponibles:"
echo "   - GET /api/spots (3 sites)"
echo "   - GET /api/flights (6 vols)"
echo "   - GET /api/flights/:id/gpx-data (coordonnées GPX)"
echo "   - GET /api/flights/stats (statistiques)"
echo "   - GET /api/weather/:spotId (météo + para_index)"
echo ""
echo "📚 Documentation: src/mocks/README.md"
echo "📋 Rapport complet: MSW_SETUP_COMPLETE.md"
