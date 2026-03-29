# 🚀 Checklist de déploiement Dashboard Parapente

## ✅ Corrections à déployer

### Commits récents (prêts à pusher)

```
4ecd53e - security: remove exposed API keys from documentation
a66ae73 - chore: update .env.example with proper placeholders for all secrets
3f0eb43 - chore: clean up .env configuration
e6ed714 - fix: import BackgroundTasks in routes.py
906622f - fix: remove duplicate /api prefix from emagram endpoints
```

## 🔧 Configuration serveur (192.168.1.106)

### 1. Variables d'environnement à ajouter dans Portainer

**Stacks → dashboard-parapente → Editor**

Ajouter dans la section `environment` du service `backend` :

```yaml
environment:
  # ... variables existantes ...

  # Weather API Keys (MANQUANTES - cause du "non dispo")
  - WEATHERAPI_KEY=64cfa0092fa84c77940180226261802
  - METEOBLUE_API_KEY=Kd8IHD0Oj5zCmWUa

  # Strava OAuth (si pas déjà là)
  - STRAVA_CLIENT_ID=73115
  - STRAVA_CLIENT_SECRET=34de079501057b6409367e7bea00ecebb9f6e4d6
  - STRAVA_ACCESS_TOKEN=5aad34b765ac46ce6072caf40ac7c95ab180148b
  - STRAVA_REFRESH_TOKEN=fb3a53726c083e884e145fe66a34237ffc0cd3ef

  # Google Gemini API (pour emagrammes)
  - GOOGLE_API_KEY=AIzaSyB-IFGZWz01FgH7TsPyZmYkFlKLbsXnVsg
  - GEMINI_MODEL=gemini-2.5-flash
```

### 2. Déploiement

**Via Portainer :**

1. Cliquer **"Update the stack"** après avoir ajouté les variables
2. Aller dans **Containers** → `parapente-backend`
3. **Actions** → **Recreate** → ✅ **Pull latest image**
4. Attendre ~2 minutes que le container redémarre

**Ou via SSH :**

```bash
ssh user@192.168.1.106
cd /path/to/dashboard-parapente
git pull origin main
docker-compose down
docker-compose up -d --build
```

### 3. Vérification

**Vérifier les logs :**

```bash
docker-compose logs -f backend | grep -E "(✅|❌|⚠️|weather|API)"
```

**Attendu :**

```
✅ Strava credentials loaded (Client ID: 73115)
✅ WEATHERAPI_KEY loaded
✅ METEOBLUE_API_KEY loaded
🔧 Environment: production
```

**Tester l'API météo :**

```bash
curl "http://192.168.1.106:8001/api/weather/arguel" | jq '.hourly[0]'
```

**Attendu :** Toutes les sources doivent retourner des données :

```json
{
  "datetime": "2025-03-08T10:00:00",
  "consensus": {
    "temperature": 12.5,
    "wind_speed": 15.2,
    ...
  },
  "sources": {
    "open-meteo": { "temperature": 12.3, ... },
    "weatherapi": { "temperature": 12.7, ... },  // ← devrait apparaître
    "meteociel": { "temperature": 12.5, ... },   // ← devrait apparaître
    "meteoblue": { "temperature": 12.4, ... }    // ← devrait apparaître
  }
}
```

**Tester les emagrammes (nouveau) :**

```bash
curl "http://192.168.1.106:8001/api/emagram/spot/arguel/latest"
```

## 🐛 Problèmes connus résolus

### 1. ❌ Météo "non dispo" (sauf Open-Meteo)

**Cause :** Variables `WEATHERAPI_KEY` et `METEOBLUE_API_KEY` manquantes sur serveur Docker
**Solution :** Ajouter dans Portainer (voir section 1 ci-dessus)

### 2. ❌ 405 Method Not Allowed sur `/api/emagram/analyze`

**Cause :** Double préfixe `/api/api/emagram/*`
**Solution :** Corrigé dans commit `906622f`

### 3. ❌ BackgroundTasks non défini

**Cause :** Import manquant dans `routes.py`
**Solution :** Corrigé dans commit `e6ed714`

## 📊 État des sources météo

| Source          | Type            | Clé requise | Statut                   |
| --------------- | --------------- | ----------- | ------------------------ |
| Open-Meteo      | API gratuite    | ❌ Non      | ✅ Fonctionne            |
| WeatherAPI      | API commerciale | ✅ Oui      | ⚠️ Clé manquante serveur |
| Meteociel       | Scraping HTML   | ❌ Non      | ⚠️ À vérifier            |
| Meteoblue       | API commerciale | ✅ Oui      | ⚠️ Clé manquante serveur |
| Meteo-Parapente | Scraping HTML   | ❌ Non      | ⚠️ À vérifier            |

## 🎯 Résultat attendu après déploiement

✅ Toutes les sources météo affichent des données  
✅ Endpoints emagram fonctionnels (`/api/emagram/*`)  
✅ Analyse automatique emagrammes toutes les 3h  
✅ Frontend affiche liens vers sources externes
