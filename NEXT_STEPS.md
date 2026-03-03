# 🚀 Prochaines Étapes - Redis Polling System

## ✅ Ce Qui Est Fait

Toutes les modifications de code sont **100% complètes** :

1. ✅ `cache.py` - TTL 30min
2. ✅ `weather_pipeline.py` - Cache Redis intégré
3. ✅ `scheduler.py` - Polling réactivé et configuré
4. ✅ `main.py` - Warmup au démarrage
5. ✅ Scripts de test créés

**Résultat** : Le code est prêt, il ne manque que Redis !

---

## 🔧 Ce Qu'Il Reste à Faire

### Étape 1 : Installer Redis (5 minutes)

**Option A - Redis Local (Recommandé pour Dev)** :
```bash
# Installation
sudo apt update
sudo apt install -y redis-server

# Démarrer
sudo service redis-server start

# Vérifier
redis-cli ping
# Devrait afficher: PONG

# Auto-start au boot
sudo systemctl enable redis-server
```

**Option B - Docker (Si Docker Desktop configuré)** :
```bash
cd /home/capic/developements/dashboard-parapente
docker-compose up -d redis
docker exec -it dashboard-redis redis-cli ping
```

---

### Étape 2 : Tester le Système (10 minutes)

```bash
cd /home/capic/developements/dashboard-parapente/backend
source venv/bin/activate

# Test 1 : Connexion Redis
python << 'EOF'
import asyncio
from cache import get_redis

async def test():
    redis = await get_redis()
    result = await redis.ping()
    print(f'✅ Redis OK: {result}')
    
asyncio.run(test())
EOF

# Test 2 : Suite complète (optionnel mais recommandé)
python /tmp/test_cache.py
```

**Résultats attendus** :
- Test 1 : `✅ Redis OK: True`
- Test 2 : Speedup 10-50× entre MISS et HIT

---

### Étape 3 : Démarrer le Backend (2 minutes)

```bash
cd /home/capic/developements/dashboard-parapente/backend
source venv/bin/activate

# Arrêter ancien backend si tourne
pkill -f "uvicorn main:app"

# Démarrer avec warmup
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**Logs à surveiller** :
```
✅ Scheduler started - running every hour at :00
🔥 Starting cache warmup...
Fetching Arguel (day 0)...
✅ Cached Arguel day 0
...
✅ Cache warmup complete!
```

---

### Étape 4 : Tester l'API (5 minutes)

**Test Performance** :
```bash
# Terminal 1 : Backend tourne
# Terminal 2 : Tests

# 1ère requête (peut être lente si warmup pas fini)
time curl -s "http://localhost:8001/api/weather/site-arguel?day_index=0" | head -20

# 2ème requête (devrait être RAPIDE < 500ms)
time curl -s "http://localhost:8001/api/weather/site-arguel?day_index=0" | head -20
```

**Vérifier cache** :
```bash
# Voir les clés en cache
redis-cli KEYS "weather:*"

# Compter les clés
redis-cli KEYS "weather:*" | wc -l
# Devrait être ~12 après warmup (6 sites × 2 jours)

# Voir TTL d'une clé
redis-cli TTL "weather:forecast:..."
```

---

### Étape 5 : Monitoring (optionnel)

**Logs Backend** :
```bash
# Suivre les logs
tail -f /tmp/backend.log | grep -E "Cache|Scheduler"

# Ou si backend en foreground
# Les logs s'affichent directement
```

**Métriques Redis** :
```bash
# Stats générales
redis-cli INFO stats

# Mémoire utilisée
redis-cli INFO memory | grep used_memory_human

# Hit rate (après quelques requêtes)
redis-cli INFO stats | grep keyspace
```

---

## 🎯 Points de Validation

### ✅ Système Fonctionne Si :

1. **Redis connecté**
   - `redis-cli ping` → `PONG`
   - Backend logs : `✅ Redis connection established`

2. **Cache opérationnel**
   - Logs montrent `Cache HIT` et `Cache MISS`
   - 2ème requête <500ms
   - `redis-cli KEYS "weather:*"` liste des clés

3. **Scheduler actif**
   - Logs au démarrage : `✅ Scheduler started`
   - Après warmup : `✅ Cache warmup complete`
   - Toutes les heures : `⏰ Scheduled weather fetch`

4. **Performance OK**
   - Day 0-1 : <1s
   - Navigation jours : instantanée
   - RAM Redis < 200MB

---

## 🐛 Si Problème

### Redis refuse connexion
```bash
# Vérifier status
sudo service redis-server status

# Redémarrer
sudo service redis-server restart

# Check port
netstat -tuln | grep 6379
```

### Backend ne démarre pas
```bash
# Vérifier dépendances
pip install -r requirements.txt

# Tester import cache
python -c "from cache import get_redis; print('OK')"

# Check logs
tail -50 /tmp/backend.log
```

### Cache ne se remplit pas
```bash
# Clear cache pour test propre
redis-cli FLUSHDB

# Relancer warmup
# Restart backend

# Vérifier logs
tail -f /tmp/backend.log | grep "Cached"
```

---

## 📊 Métriques de Succès

**Vous saurez que ça marche quand** :

1. Frontend charge **instantanément** (déjà consulté)
2. Changement de jour **<500ms** (jours 0-1)
3. Logs montrent **90% Cache HIT** après 1h
4. Redis contient **12+ clés** après warmup
5. Backend **pas de timeout** Meteoblue

**Performance cible** :
- Cache HIT : <100ms
- Cache MISS : 3-8s (normal)
- Warmup complet : 30-60s
- RAM Redis : 50-100MB

---

## 🚀 Production (Portainer)

Une fois validé en dev :

1. **Vérifier docker-compose.yml** (déjà OK ✅)
2. **Push code** vers votre repo
3. **Dans Portainer** :
   - Stop containers
   - Pull latest
   - Start avec `docker-compose up -d`
4. **Vérifier logs** :
   ```bash
   docker logs dashboard-backend --tail 100 -f
   docker logs dashboard-redis --tail 50
   ```

---

## 📝 Aide-Mémoire Commandes

```bash
# Redis
redis-cli ping                    # Test connexion
redis-cli KEYS "weather:*"        # Lister clés cache
redis-cli FLUSHDB                 # Clear cache (test)
redis-cli INFO memory             # Usage RAM

# Backend
pkill -f "uvicorn main:app"       # Stop
uvicorn main:app --reload         # Start dev
tail -f /tmp/backend.log          # Logs

# Tests
python /tmp/test_cache.py         # Suite complète
curl localhost:8001/api/weather/site-arguel?day_index=0  # API test

# Docker (si utilisé)
docker-compose up -d redis        # Start Redis
docker-compose logs -f redis      # Logs
docker exec -it dashboard-redis redis-cli  # Shell Redis
```

---

## ✨ Résumé

**Temps estimé total** : ~20-30 minutes

1. ⏱️ 5min - Installer Redis
2. ⏱️ 10min - Tester système
3. ⏱️ 5min - Démarrer backend
4. ⏱️ 5min - Valider performance
5. ⏱️ 5min - Monitoring (optionnel)

**Résultat attendu** : Dashboard **10-50× plus rapide** ! 🚀

---

**Questions ?** Consultez :
- `/home/capic/developements/dashboard-parapente/REDIS_POLLING_IMPLEMENTATION.md` (doc complète)
- `/tmp/test_redis_setup.md` (aide installation)
- `/tmp/test_cache.py` (tests automatiques)

**Bon courage !** 💪
