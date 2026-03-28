# Système d'Analyse d'Emagrammes Multi-Sources - Documentation Complète

## 🎯 Vue d'ensemble

Le Dashboard Parapente intègre maintenant un système complet d'analyse d'emagrammes utilisant **Google Gemini Vision** pour analyser automatiquement 3 sources d'emagrammes et fournir des prévisions thermiques optimisées pour le parapente.

## 📋 Architecture Complète

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                           │
│                                                                │
│  Dashboard.tsx                                                 │
│  ├─ EmagramWidget.tsx                                         │
│  │  ├─ useEmagramAnalysis.ts hook                             │
│  │  │  ├─ GET /api/emagram/latest                             │
│  │  │  ├─ POST /api/emagram/analyze                           │
│  │  │  └─ GET /api/emagram/history                            │
│  │  └─ Display:                                                │
│  │     ├─ Score de volabilité (0-100)                         │
│  │     ├─ Plafond thermique (m)                               │
│  │     ├─ Force thermique (m/s)                               │
│  │     ├─ Heures volables                                     │
│  │     ├─ Conseils de vol                                     │
│  │     ├─ Alertes sécurité                                    │
│  │     └─ 🆕 Liens vers sources externes                       │
│  └─ Types: EmagramAnalysis interface                          │
└──────────────────────────────────────────────────────────────┘
                              ↕ HTTP/JSON
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                          │
│                                                                │
│  routes.py - API Endpoints                                    │
│  ├─ GET /api/emagram/latest                                   │
│  │  └─ Trouve l'analyse la plus proche de user_lat/lon        │
│  ├─ POST /api/emagram/analyze                                 │
│  │  └─ Déclenche une analyse manuelle                         │
│  ├─ GET /api/emagram/history                                  │
│  │  └─ Historique 7-30 jours                                  │
│  ├─ GET /api/emagram/spot/{site_id}/latest                    │
│  ├─ POST /api/emagram/spot/{site_id}/refresh                  │
│  └─ GET /api/emagram/spots/all                                │
│                                                                │
│  emagram_multi_source.py - Orchestrateur                      │
│  └─ generate_multi_source_emagram_for_spot()                  │
│     1. Fetch screenshots (3 sources)                           │
│     2. Analyze with Gemini Vision                              │
│     3. Save to database                                        │
│                                                                │
│  llm/ - Analyseurs IA                                         │
│  ├─ gemini_analyzer.py (Priority 1) ✨                         │
│  ├─ acp_analyzer.py (Priority 2)                              │
│  └─ multi_emagram_analyzer.py (Priority 3)                    │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│               SCREENSHOT CAPTURE (Playwright)                 │
│                                                                │
│  emagram_screenshots.py                                       │
│  ├─ screenshot_meteo_parapente()                              │
│  ├─ screenshot_topmeteo()                                     │
│  ├─ screenshot_windy()                                        │
│  └─ fetch_all_emagram_screenshots()                           │
│     └─ Parallel capture (asyncio.gather)                      │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│                  GEMINI VISION API                            │
│                                                                │
│  Google AI Studio                                             │
│  ├─ Model: gemini-2.5-flash                                   │
│  ├─ Input: 3 emagram images                                   │
│  ├─ Output: Structured JSON                                   │
│  │  ├─ plafond_thermique_m                                    │
│  │  ├─ force_thermique_ms                                     │
│  │  ├─ heures_volables                                        │
│  │  ├─ score_volabilite                                       │
│  │  ├─ conseils_vol                                           │
│  │  ├─ alertes_securite                                       │
│  │  └─ details_analyse                                        │
│  └─ Free tier: 1500 req/day                                   │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│                     DATABASE (SQLite)                         │
│                                                                │
│  Table: emagram_analysis                                      │
│  ├─ Core fields:                                               │
│  │  ├─ station_code (site_id)                                 │
│  │  ├─ plafond_thermique_m                                    │
│  │  ├─ force_thermique_ms                                     │
│  │  ├─ score_volabilite                                       │
│  │  ├─ conseils_vol                                           │
│  │  └─ alertes_securite (JSON)                                │
│  └─ 🆕 Multi-source fields:                                    │
│     ├─ external_source_urls (JSON)                            │
│     ├─ sources_count                                           │
│     └─ sources_agreement                                       │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│                   SCHEDULER (APScheduler)                     │
│                                                                │
│  emagram_scheduler.py                                         │
│  ├─ Intervalle: toutes les 3h                                 │
│  │  └─ 00:15, 03:15, 06:15, 09:15, 12:15, 15:15, 18:15, 21:15│
│  ├─ Sites: Tous les sites actifs en DB                        │
│  └─ Cleanup: Screenshots > 3h auto-supprimés                  │
└──────────────────────────────────────────────────────────────┘
```

## 🔧 Composants Implémentés

### Backend

#### 1. **Endpoints API** (`backend/routes.py`)

**User-location based** (pour le widget):

```python
GET  /api/emagram/latest?user_lat=47.2167&user_lon=6.0833
POST /api/emagram/analyze
GET  /api/emagram/history?user_lat=47.2167&user_lon=6.0833&days=7
```

**Spot-based** (pour admin):

```python
GET  /api/emagram/spot/{site_id}/latest
POST /api/emagram/spot/{site_id}/refresh
GET  /api/emagram/spots/all
```

#### 2. **Orchestrateur** (`backend/emagram_multi_source.py`)

- Workflow complet: screenshots → analyse → DB
- Cache 3h (skip si analyse récente)
- Stratégie de fallback:
  1. Gemini Vision (priorité 1)
  2. OpenClaw ACP (priorité 2)
  3. Anthropic API (priorité 3)

#### 3. **Screenshot Capture** (`backend/scrapers/emagram_screenshots.py`)

- **Playwright** pour automatiser les navigateurs
- 3 sources en parallèle (asyncio.gather)
- Auto-cleanup après 3h
- Gestion d'erreurs robuste

#### 4. **Analyseur Gemini** (`backend/llm/gemini_analyzer.py`)

- Support multi-images (jusqu'à 3)
- Retry automatique (3 tentatives)
- Parsing JSON structuré
- Validation des champs
- Timeout configurable

#### 5. **Scheduler** (`backend/emagram_scheduler/emagram_scheduler.py`)

- APScheduler (toutes les 3h)
- Traite tous les sites en DB
- Cleanup automatique des screenshots
- Logging détaillé

#### 6. **Modèles** (`backend/models.py`, `backend/schemas.py`)

```python
class EmagramAnalysis:
    # Core fields
    station_code: str
    plafond_thermique_m: int
    force_thermique_ms: float
    score_volabilite: int
    conseils_vol: str
    alertes_securite: str  # JSON

    # NEW: Multi-source
    external_source_urls: str  # JSON
    sources_count: int
    sources_agreement: str
```

### Frontend

#### 1. **Hook** (`frontend/src/hooks/useEmagramAnalysis.ts`)

```typescript
// Fetch latest analysis
const { data, isLoading, error } = useLatestEmagram(userLat, userLon);

// Trigger manual analysis
const triggerMutation = useTriggerEmagram();
await triggerMutation.mutateAsync({ user_latitude, user_longitude });
```

#### 2. **Composant** (`frontend/src/components/EmagramWidget.tsx`)

**Affichage:**

- ⭕ Score de volabilité avec gauge circulaire
- ☁️ Plafond thermique
- 📈 Force thermique
- ⏰ Heures volables
- 💡 Conseils de vol
- ⚠️ Alertes sécurité
- 🆕 **Liens vers sources externes** (Meteo-Parapente, TopMeteo, Windy)
- 🤖 Indicateur méthode (IA vs classique)
- 🔄 Bouton refresh manuel

**Déjà intégré dans:**

- `frontend/src/pages/Dashboard.tsx`

#### 3. **Types** (`frontend/src/types/emagram.ts`)

```typescript
interface EmagramAnalysis {
  // ... (tous les champs)
  external_source_urls?: string; // NEW
  sources_count?: number; // NEW
  sources_agreement?: string; // NEW
}
```

## 🚀 Configuration

### Variables d'environnement

**Backend (.env):**

```bash
# Google Gemini API (Priority 1)
# Obtenir votre clé sur: https://aistudio.google.com/app/apikey
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# OpenClaw ACP (Priority 2, optional)
OPENCLAW_ACP_ENABLED=false

# Anthropic API (Priority 3, fallback)
ANTHROPIC_API_KEY=your_anthropic_key_here
```

**Frontend (.env):**

```bash
VITE_API_URL=http://localhost:8001
```

## 📦 Dépendances

**Backend:**

```
google-generativeai==0.8.3
playwright==1.58.0
anthropic==0.42.0
pillow==11.1.0
```

**Frontend:**

```json
{
  "@tanstack/react-query": "^5.x",
  "react": "^18.x"
}
```

## 🧪 Tests

### Test Backend

```bash
cd backend

# Test Gemini integration
python test_gemini_integration.py

# Test orchestrator (needs DB)
python -c "
from emagram_multi_source import generate_multi_source_emagram_for_spot
from database import SessionLocal
import asyncio

async def test():
    db = SessionLocal()
    result = await generate_multi_source_emagram_for_spot('arguel', db)
    print(result)

asyncio.run(test())
"
```

### Test API

```bash
# Latest analysis
curl "http://localhost:8001/api/emagram/latest?user_lat=47.2167&user_lon=6.0833"

# Manual refresh for a spot
curl -X POST "http://localhost:8001/api/emagram/spot/arguel/refresh"

# Get spot latest
curl "http://localhost:8001/api/emagram/spot/arguel/latest"
```

### Test Frontend

```bash
cd frontend
npm run dev

# Ouvrir http://localhost:5173
# Le EmagramWidget devrait s'afficher sur le Dashboard
```

## 🐛 Dépannage

### Backend

**Gemini API Error:**

```bash
# Vérifier la clé
echo $GOOGLE_API_KEY

# Tester manuellement
curl -H "Content-Type: application/json" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GOOGLE_API_KEY"
```

**Playwright Error:**

```bash
# Installer les navigateurs
playwright install chromium
playwright install-deps
```

**Database Error:**

```bash
# Vérifier que la migration a été appliquée
python backend/migrations/003_add_multi_source_emagram_fields.py
```

### Frontend

**API not reachable:**

- Vérifier `VITE_API_URL` dans `.env`
- Vérifier que le backend tourne sur le bon port

**Widget not showing:**

- Ouvrir DevTools → Console
- Chercher erreurs réseau ou React Query
- Vérifier que `userLat` et `userLon` sont définis

## 📊 Utilisation & Quotas

**Gemini Free Tier:**

- 1500 requêtes/jour
- Votre usage: ~48/jour (6 spots × 8 analyses)
- **Marge: 97%** ✅

**Coûts évités:**

- Anthropic Claude Opus: ~43€/mois
- **Économie annuelle: ~516€** 💰

## 📈 Prochaines Étapes

### Déploiement (Priorité 1)

1. Push code sur serveur `192.168.1.106`
2. Ajouter `GOOGLE_API_KEY` dans Portainer
3. Rebuild container backend
4. Vérifier logs

### Optimisations (Priorité 2)

1. Affiner le prompt Gemini après tests réels
2. Ajuster timeout si nécessaire
3. Monitorer taux de succès

### Améliorations UI (Priorité 3)

1. Graphique historique du score
2. Comparaison multi-spots
3. Notifications push si score > 80

## 📝 Commits

```bash
git log --oneline --graph -10

* ea7f274 feat(frontend): display multi-source emagram links in EmagramWidget
* 65e5e04 feat(api): add /api prefix to emagram endpoints and multi-source fields
* 1f8d7ae fix(gemini): update model from gemini-2.0-flash-exp to gemini-2.5-flash
* 5433020 feat(emagram): add Google Gemini Vision integration for AI analysis
* 9a6ee5d feat(emagram): add OpenClaw ACP integration for AI analysis
```

## 🎯 Résultat Final

✅ **Système complet et opérationnel:**

- Backend: API + Scheduler + Analyseur Gemini
- Frontend: Widget intégré avec liens sources
- Database: Migration appliquée
- Tests: Passés avec API réelle
- Documentation: Complète

**Prêt pour déploiement en production!** 🚀

## 📚 Ressources

- **Gemini API**: https://ai.google.dev/gemini-api/docs
- **API Key**: https://aistudio.google.com/app/apikey
- **Backend docs**: `backend/llm/README.md`
- **Deployment guide**: `docs/GEMINI_DEPLOYMENT.md`
