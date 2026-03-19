# 🧪 Test des sources météo

## État actuel (base de données locale)

```
Source               Activé   Priorité   Succès   Erreurs  Statut
--------------------------------------------------------------------------------
open-meteo           ✅ Oui    10         2        26       ✅ Fonctionne
weatherapi           ✅ Oui    9          0        0        🟡 Activé (à tester)
meteo-parapente      ✅ Oui    8          2        49       ✅ Fonctionne  
meteociel            ✅ Oui    7          2        49       ❌ Erreur INSEE
meteoblue            ✅ Oui    6          51       0        ❓ Devrait fonctionner
```

## Résumé des problèmes

### 1. WeatherAPI - Désactivé dans la DB
**✅ CORRIGÉ LOCALEMENT** - Activé dans `backend/db/dashboard.db`

**Action serveur :**
```sql
UPDATE weather_source_config 
SET is_enabled = 1 
WHERE source_name = 'weatherapi';
```

### 2. Meteociel - Erreur code INSEE
**Erreur :** `Meteociel only supports French cities. Could not find INSEE...`

**Cause :** Le scraper cherche un code INSEE français mais ne le trouve pas pour certaines villes.

**Solutions possibles :**
- Ajouter un override dans `scrapers/meteociel.py` :
  ```python
  SITE_INSEE_OVERRIDE = {
      "Arguel": "25473",  # Déjà présent
      "VotreVille": "INSEE_CODE"  # À ajouter
  }
  ```
- Ou désactiver Meteociel si non critique

### 3. Meteoblue - 51 succès mais invisible
**Étrange :** 51 succès en DB mais n'apparaît pas dans le frontend

**Hypothèses :**
1. Les données sont récupérées mais pas au bon format
2. Playwright échoue dans Docker (pas de navigateur)
3. Le mapping des noms de sources est cassé

**Tests à faire sur le serveur :**
```bash
# Vérifier si Playwright est installé
docker exec parapente-backend playwright --version

# Tester meteoblue manuellement
docker exec parapente-backend python3 -c "
import asyncio
from scrapers.meteoblue import fetch_meteoblue
result = asyncio.run(fetch_meteoblue(47.2167, 6.0833, 'Arguel'))
print(result)
"
```

## Commandes de test

### Test complet d'une source
```bash
curl "http://192.168.1.106:8001/api/weather/arguel" | jq '.hourly[0].sources'
```

**Résultat attendu :**
```json
{
  "open-meteo": { "temperature": 12.3, "wind_speed": 15.2, ... },
  "weatherapi": { "temperature": 12.7, "wind_speed": 14.8, ... },
  "meteo-parapente": { "temperature": 12.5, "wind_speed": 15.0, ... },
  "meteoblue": { "temperature": 12.4, "wind_speed": 15.1, ... }
}
```

### Vérifier la config DB sur le serveur
```bash
docker exec parapente-backend sqlite3 /app/db/dashboard.db "
SELECT source_name, is_enabled, success_count, error_count 
FROM weather_source_config 
ORDER BY priority DESC;"
```

## Actions recommandées

### Option A : Déployer avec 3 sources fonctionnelles
- ✅ Open-Meteo
- ✅ WeatherAPI (après activation en DB)
- ✅ Meteo-Parapente
- ❌ Meteociel (désactiver temporairement)
- ❓ Meteoblue (à investiguer)

**Commande SQL à exécuter sur serveur :**
```sql
UPDATE weather_source_config SET is_enabled = 1 WHERE source_name = 'weatherapi';
UPDATE weather_source_config SET is_enabled = 0 WHERE source_name = 'meteociel';
```

### Option B : Investiguer Meteoblue d'abord
Si Meteoblue fonctionne vraiment (51 succès), ça vaudrait le coup de comprendre pourquoi les données n'arrivent pas au frontend.

## Checklist avant déploiement

- [ ] Push les commits (6 au total)
- [ ] Sur le serveur : `git pull origin main`
- [ ] Activer WeatherAPI en DB : `UPDATE weather_source_config SET is_enabled = 1 WHERE source_name = 'weatherapi';`
- [ ] Tester : `curl http://192.168.1.106:8001/api/weather/arguel | jq '.hourly[0].sources | keys'`
- [ ] Vérifier que 3-4 sources apparaissent (open-meteo, weatherapi, meteo-parapente, meteoblue?)
- [ ] Rebuild container : `docker-compose up -d --build`
