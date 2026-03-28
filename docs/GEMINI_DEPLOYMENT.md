# Déploiement Gemini Vision pour Dashboard Parapente

## 🎯 Guide de déploiement rapide

Ce guide vous aide à déployer l'intégration Google Gemini Vision sur votre serveur Docker.

## Prérequis

- ✅ Clé API Google Gemini (obtenir sur: https://aistudio.google.com/app/apikey)
- ✅ Docker et docker-compose installés
- ✅ Serveur Docker avec accès réseau

## Étapes de déploiement

### 1. Mettre à jour le code sur le serveur

```bash
# SSH sur le serveur
ssh user@192.168.1.106

# Aller dans le répertoire du projet
cd /path/to/dashboard-parapente

# Pull les derniers changements
git pull origin main
```

### 2. Mettre à jour les variables d'environnement

**Dans Portainer** (recommandé):

1. Aller dans **Stacks** → **dashboard-parapente**
2. Cliquer sur **Editor**
3. Ajouter ces variables d'environnement:

```yaml
environment:
  # ... variables existantes ...

  # Google Gemini API
  - GOOGLE_API_KEY=your_google_api_key_here
  - GEMINI_MODEL=gemini-2.5-flash
```

4. Cliquer sur **Update the stack**

**Ou via fichier `.env`** (alternative):

```bash
# Éditer .env
nano .env

# Ajouter ces lignes:
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### 3. Rebuilder et redémarrer le container

```bash
# Rebuild l'image (pour installer google-generativeai)
docker-compose build --no-cache backend

# Redémarrer les services
docker-compose down
docker-compose up -d

# Vérifier les logs
docker-compose logs -f backend
```

### 4. Vérifier que Gemini fonctionne

**Test via logs:**

Attendre la prochaine exécution du scheduler (toutes les 3h: 00:15, 03:15, 06:15, etc.)

Vous devriez voir dans les logs:

```
INFO: 🔷 Trying Gemini Vision analysis...
INFO: 🔷 Gemini analysis successful!
INFO: 🤖 LLM analysis successful (gemini): Score 75/100
```

**Test manuel via API:**

```bash
# Forcer un refresh d'analyse
curl -X POST http://192.168.1.106:8001/api/emagram/spot/arguel/refresh

# Vérifier le résultat
curl http://192.168.1.106:8001/api/emagram/spot/arguel/latest | jq
```

### 5. Monitorer l'utilisation

**Vérifier les quotas Gemini:**

1. Aller sur https://aistudio.google.com/app/apikey
2. Cliquer sur votre clé API
3. Voir l'utilisation quotidienne

**Votre usage attendu:**

- 6 spots × 8 analyses/jour = **48 requêtes/jour**
- Limite gratuite: **1500 requêtes/jour**
- Marge: **97% de marge** 🎉

## Troubleshooting

### ❌ Erreur "Invalid API key"

```bash
# Vérifier la clé dans le container
docker-compose exec backend printenv GOOGLE_API_KEY
```

Si vide ou incorrecte:

1. Vérifier dans Portainer que la variable est bien définie
2. Redémarrer le stack

### ❌ Erreur "google.generativeai not found"

Le package n'est pas installé. Rebuild obligatoire:

```bash
docker-compose build --no-cache backend
docker-compose up -d
```

### ❌ Timeout ou rate limit

Augmenter le timeout ou vérifier les quotas:

```bash
# Dans Portainer, ajouter:
- GEMINI_TIMEOUT=180  # 3 minutes au lieu de 2

# Vérifier les quotas: https://aistudio.google.com/app/apikey
```

### ⚠️ Fallback vers Anthropic

Si Gemini échoue, le système utilise automatiquement l'API Anthropic (si configurée).

Logs:

```
WARNING: Gemini analysis failed: ...
INFO: 🤖 Using Anthropic direct API (fallback)...
```

Aucune action requise, c'est normal (fallback automatique).

## Architecture déployée

```
Docker Container (192.168.1.106)
├─ Backend Python (FastAPI)
│  ├─ Scheduler (toutes les 3h)
│  ├─ Screenshot Playwright
│  └─ Gemini Analyzer
│     └─ API Call → api.google.com
│
└─ Database (SQLite)
   └─ emagram_analysis table
```

## Monitoring

### Logs en temps réel

```bash
# Tous les logs
docker-compose logs -f backend

# Filtrer uniquement les analyses
docker-compose logs -f backend | grep -E "(Gemini|analysis|emagram)"

# Erreurs uniquement
docker-compose logs -f backend | grep ERROR
```

### Statistiques d'analyse

```bash
# Nombre d'analyses par spot
docker-compose exec backend sqlite3 db/dashboard.db \
  "SELECT station_code, COUNT(*) FROM emagram_analysis GROUP BY station_code;"

# Dernières analyses
docker-compose exec backend sqlite3 db/dashboard.db \
  "SELECT station_code, analysis_datetime, score_volabilite FROM emagram_analysis ORDER BY analysis_datetime DESC LIMIT 10;"
```

## Rollback en cas de problème

Si Gemini pose problème, vous pouvez rapidement désactiver:

```bash
# Dans Portainer, retirer ou commenter:
# - GOOGLE_API_KEY=...

# Ou dans .env:
GOOGLE_API_KEY=  # Vide = désactivé

# Redémarrer
docker-compose restart backend
```

Le système utilisera automatiquement le fallback (Anthropic API si configurée).

## Coûts

### Gemini (actuel)

- **Gratuit**: 1500 requêtes/jour
- Usage: 48 requêtes/jour
- **Coût: 0€/mois** ✅

### Anthropic (fallback)

- 48 requêtes/jour × 30 jours = 1440 requêtes/mois
- ~0.03€/requête (Claude Opus 4)
- **Coût estimé: ~43€/mois** ⚠️

**Recommandation**: Garder Gemini comme analyseur principal pour économiser ~500€/an.

## Prochaines étapes

1. ✅ Déployer Gemini (ce guide)
2. ⏳ Monitorer pendant 1 semaine
3. ⏳ Optimiser le prompt si nécessaire
4. ⏳ Ajouter dashboard UI pour visualiser les analyses

## Support

- **Documentation complète**: `backend/llm/README.md`
- **Tests**: `python backend/test_gemini_integration.py`
- **Gemini Docs**: https://ai.google.dev/gemini-api/docs
