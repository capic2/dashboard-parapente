# 🗑️ Comment Vider le Cache Redis

Le cache contient actuellement des **données corrompues** qui empêchent le système de fonctionner.
Vous devez vider le cache pour forcer un nouveau fetch depuis les API météo.

## Méthode 1: Via Portainer (Le plus simple!)

1. Allez dans **Portainer**
2. Cliquez sur le container **parapente-backend**
3. Allez dans **Console**
4. Exécutez:
   ```bash
   python clear_cache.py
   ```

Vous devriez voir:
```
🔌 Connecting to Redis...
🔍 Finding cache keys...
📋 Found 12 cache entries:
   - Weather keys: 12
   - Best spot keys: 0
🗑️  Deleting 12 cache entries...
✅ Successfully cleared 12 cache entries!
✅ Cache is now empty!
```

## Méthode 2: Via Docker CLI

Si vous avez accès SSH au serveur:
```bash
docker exec -it parapente-backend python clear_cache.py
```

## Méthode 3: Directement sur Redis

```bash
docker exec parapente-redis redis-cli FLUSHALL
```

---

## Après avoir vidé le cache

Une fois le cache vide, **relancez le refresh météo**:

### Option A: Redémarrer le backend
```bash
docker compose -f docker-compose.prod.yml restart backend
```

Le warmup automatique va fetcher des données fraîches.

### Option B: Appel API manuel
```bash
curl -X POST http://192.168.1.106:8001/api/admin/refresh-weather
```

---

## Vérification

Testez si les données sont maintenant disponibles:
```bash
curl "http://192.168.1.106:8001/api/weather/site-arguel?day_index=0"
```

Vous devriez voir des données météo au lieu de:
```json
{"error": "No successful data from any source"}
```

---

## Pourquoi le cache est corrompu?

Les premières tentatives de fetch ont échoué (problèmes de pool de connexions), et le système a **mis en cache les échecs**.
Maintenant que tous les bugs sont corrigés, il faut juste vider ce mauvais cache pour repartir sur de bonnes bases!
