#!/bin/bash
# Script de déploiement pour Dashboard Parapente
# Exécuter ce script pour pousser les changements et redéployer en production

set -e  # Arrêter en cas d'erreur

echo "============================================"
echo "📦 Dashboard Parapente - Déploiement"
echo "============================================"
echo ""

# Étape 1 : Force push vers GitHub (historique nettoyé)
echo "📤 Étape 1/3 : Push vers GitHub..."
echo "⚠️  ATTENTION : Force push (historique réécrit pour sécurité)"
read -p "Continuer ? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé"
    exit 1
fi

git push origin main --force

echo "✅ Push réussi"
echo ""

# Étape 2 : Rebuild Docker en production
echo "🐳 Étape 2/3 : Rebuild Docker..."
echo "Arrêt des conteneurs..."
docker compose down

echo "Build de l'image backend (no-cache)..."
docker compose build --no-cache backend

echo "Démarrage des conteneurs..."
docker compose up -d

echo "✅ Docker redémarré"
echo ""

# Étape 3 : Vérification des logs
echo "📊 Étape 3/3 : Vérification..."
sleep 5

echo ""
echo "Logs backend (Strava credentials):"
docker compose logs backend 2>&1 | grep -E "(Loading environment|Strava credentials|Environment:|Database:)" | tail -10

echo ""
echo "============================================"
echo "✅ Déploiement terminé !"
echo "============================================"
echo ""
echo "🔍 Commandes utiles :"
echo "  - Voir les logs : docker compose logs -f backend"
echo "  - Status : docker compose ps"
echo "  - Tester Strava : curl -X POST http://localhost:8001/api/flights/sync-strava -H 'Content-Type: application/json' -d '{\"date_from\":\"2025-01-01\",\"date_to\":\"2025-12-31\"}'"
