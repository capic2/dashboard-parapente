# 🚀 Guide de Déploiement Portainer - Migration Nx Monorepo

Ce guide détaille la procédure complète pour déployer la nouvelle structure Nx monorepo sur Portainer avec migration de la base de données vers un volume Docker nommé.

---

## 📋 Prérequis

- ✅ Accès SSH au serveur Portainer
- ✅ Accès admin à l'interface Portainer
- ✅ Branche `main` mergée avec `feature/nx-migration`
- ✅ Variables d'environnement configurées dans Portainer (voir `.env.portainer`)

---

## ⏱️ Durée Estimée

- **Préparation (SSH)**: 5 minutes
- **Déploiement Portainer**: 8-10 minutes (premier build Nx)
- **Validation**: 5 minutes
- **Total**: ~20 minutes
- **Downtime**: ~8-10 minutes (durant le build et redémarrage)

---

## 🎯 Phase 1: Backup et Préparation (SSH)

### 1.1 Connexion au serveur

```bash
ssh user@votre-serveur-portainer.com
```

### 1.2 Naviguer vers le répertoire du stack

```bash
# Le chemin exact dépend de votre configuration Portainer
# Exemple typique:
cd /var/lib/docker/volumes/portainer_data/_data/compose/XX/dashboard-parapente

# Ou si déployé via Git Repository:
cd /opt/stacks/dashboard-parapente

# Vérifier que vous êtes au bon endroit:
ls -la
# Vous devriez voir: backend/, frontend/, docker-compose.yml, etc.
```

### 1.3 Backup complet de la base de données

```bash
# Créer un backup avec timestamp
tar -czf backup-db-$(date +%Y%m%d_%H%M%S).tar.gz backend/db

# Vérifier le backup
ls -lh backup-db-*.tar.gz

# Exemple de sortie:
# -rw-r--r-- 1 root root 2.5M Mar 20 14:30 backup-db-20260320_143045.tar.gz
```

### 1.4 Créer le volume Docker nommé

```bash
# Créer le volume nommé (sera utilisé par docker-compose)
docker volume create parapente-db-data

# Vérifier la création
docker volume ls | grep parapente-db-data

# Exemple de sortie:
# local     parapente-db-data
```

### 1.5 Migrer les données vers le nouveau volume

```bash
# Copier toutes les données du répertoire backend/db vers le volume
docker run --rm \
  -v $(pwd)/backend/db:/source:ro \
  -v parapente-db-data:/dest \
  alpine sh -c "cp -av /source/* /dest/ && ls -lah /dest/"

# Exemple de sortie:
# '/source/dashboard.db' -> '/dest/dashboard.db'
# '/source/gpx' -> '/dest/gpx'
# '/source/migrations' -> '/dest/migrations'
# total 168K
# drwxr-xr-x    4 root     root        4.0K Mar 20 14:32 .
# drwxr-xr-x    3 root     root        4.0K Mar 20 14:32 ..
# -rw-r--r--    1 1000     1000      160.0K Mar 20 14:30 dashboard.db
# drwxr-xr-x    2 1000     1000        4.0K Mar 20 14:30 gpx
# drwxr-xr-x    2 1000     1000        4.0K Mar 20 14:30 migrations
```

### 1.6 Vérifier l'intégrité des données migrées

```bash
# Lister le contenu du volume
docker run --rm -v parapente-db-data:/data alpine ls -lah /data

# Vérifier la taille de la base de données
docker run --rm -v parapente-db-data:/data alpine du -sh /data/dashboard.db

# Compter les fichiers GPX
docker run --rm -v parapente-db-data:/data alpine find /data/gpx -type f | wc -l
```

**✅ Checkpoint**: Le volume `parapente-db-data` contient maintenant toutes vos données.

---

## 🐳 Phase 2: Déploiement Portainer

### 2.1 Merger la branche sur GitHub

Si ce n'est pas déjà fait:

```bash
# Sur votre machine locale:
git checkout main
git pull origin main
git merge feature/nx-migration
git push origin main
```

### 2.2 Dans l'interface Portainer

1. **Naviguer vers votre stack**
   - Portainer → Stacks → `dashboard-parapente`

2. **Re-pull depuis Git**
   - Cliquer sur "Pull and redeploy"
   - Ou: Git Repository → Pull latest version → Update the stack

3. **Vérifier les variables d'environnement**
   - Toutes les variables `BACKEND_*` doivent être présentes
   - Notamment: `BACKEND_WEATHERAPI_KEY`, `BACKEND_METEOBLUE_API_KEY`, etc.
   - Voir `.env.portainer` pour la liste complète

4. **Lancer le déploiement**
   - Cliquer sur "Update the stack"
   - ⏳ Attendre 8-10 minutes pour le build complet

### 2.3 Suivre les logs de déploiement

```bash
# Sur le serveur (SSH)
docker-compose logs -f backend

# Vous devriez voir:
# ✅ "Initializing database..."
# ✅ "Database tables created"
# ✅ "Running database migrations..."
# ✅ "Starting uvicorn server..."
# ✅ "Application startup complete"
```

**⚠️ Si vous voyez des erreurs de migration**: C'est normal, les migrations sont idempotentes.

---

## ✅ Phase 3: Validation Post-Déploiement

### 3.1 Vérifier l'accessibilité de l'application

```bash
# Test HTTP simple
curl -f https://parapente.capic.ignorelist.com/ || echo "❌ ERREUR"

# Devrait retourner du HTML ou JSON, pas d'erreur 502/503
```

### 3.2 Vérifier la base de données

Connectez-vous à l'interface web et vérifiez:

- [ ] **Dashboard météo** charge correctement
- [ ] **Sites** apparaissent (devrait avoir 6 sites Besançon)
- [ ] **Statistiques/Analytics** affichent vos vols existants
- [ ] **Pas d'erreurs** dans la console navigateur (F12)

### 3.3 Vérifier les logs backend

```bash
# Vérifier qu'il n'y a pas d'erreurs critiques
docker-compose logs backend | grep -i "error\|critical" | tail -20

# Vérifier la connexion Redis
docker-compose logs backend | grep -i "redis"
# Devrait voir: "Redis connection successful" ou similaire
```

### 3.4 Vérifier le healthcheck

```bash
# Vérifier le statut des containers
docker-compose ps

# Devrait afficher:
# NAME                 STATUS
# parapente-backend    Up X minutes (healthy)
# parapente-redis      Up X minutes (healthy)
```

### 3.5 Vérifier les données

```bash
# Compter les sites dans la DB
docker exec parapente-backend sqlite3 /app/db/dashboard.db "SELECT COUNT(*) FROM sites;"
# Devrait retourner: 6 (ou votre nombre de sites)

# Compter les vols
docker exec parapente-backend sqlite3 /app/db/dashboard.db "SELECT COUNT(*) FROM flights;"
# Devrait retourner: votre nombre de vols

# Vérifier les fichiers GPX
docker exec parapente-backend ls -l /app/db/gpx/ | wc -l
# Devrait correspondre au nombre de GPX que vous aviez
```

### 3.6 Vérifier Nx Cloud (CI/CD)

1. **GitHub Actions**
   - Aller sur: https://github.com/capic2/dashboard-parapente/actions
   - Le workflow "CI - Nx Monorepo" devrait s'exécuter
   - Vérifier qu'il passe au vert ✅

2. **Nx Cloud Dashboard**
   - Aller sur: https://cloud.nx.app/orgs/capic2
   - Vous devriez voir le workspace `dashboard-parapente`
   - Les runs CI devraient apparaître avec cache distribué actif

**✅ Checkpoint**: Si tous ces points sont verts, la migration est réussie!

---

## 🔄 Phase 4: Cleanup (Optionnel - Après 48h)

Une fois que tout fonctionne parfaitement pendant 48h:

```bash
# Sur le serveur (SSH)
cd /path/to/stack/dashboard-parapente

# Supprimer le backup (si vous êtes sûr)
rm backup-db-*.tar.gz

# Optionnel: Supprimer l'ancien répertoire backend/db
# (Il ne sert plus à rien, le volume Docker est utilisé)
rm -rf backend/db

# Optionnel: Supprimer l'ancien répertoire frontend/
# (Le code est maintenant dans apps/frontend)
rm -rf frontend/
```

---

## 🚨 Plan de Rollback (En cas de problème)

### Si l'application ne démarre pas:

#### Option 1: Restaurer les données dans le volume

```bash
# Extraire le backup
tar -xzf backup-db-YYYYMMDD_HHMMSS.tar.gz

# Recréer le volume avec les données du backup
docker volume rm parapente-db-data
docker volume create parapente-db-data

docker run --rm \
  -v $(pwd)/backend/db:/source:ro \
  -v parapente-db-data:/dest \
  alpine sh -c "cp -av /source/* /dest/"

# Redémarrer le stack
docker-compose down && docker-compose up -d
```

#### Option 2: Revert complet vers l'ancienne version

```bash
# Sur GitHub, créer une branche de rollback
git checkout main
git revert HEAD~4..HEAD  # Annule les 4 derniers commits Nx
git push origin main

# Dans Portainer: Pull and redeploy
# Modifier temporairement docker-compose.yml pour:
volumes:
  - ./backend/db:/app/db  # Revenir à l'ancien mapping
```

#### Option 3: Restaurer depuis backup manuel

```bash
# Extraire le backup dans l'ancien emplacement
tar -xzf backup-db-YYYYMMDD_HHMMSS.tar.gz

# Modifier docker-compose.yml en ligne de commande:
sed -i 's|db-data:/app/db|./backend/db:/app/db|' docker-compose.yml

# Redéployer
docker-compose down && docker-compose up -d
```

---

## 📊 Comparaison Avant/Après

| Aspect              | Avant (Monolithique)            | Après (Nx Monorepo)              |
| ------------------- | ------------------------------- | -------------------------------- |
| **Structure**       | `frontend/`, `backend/` séparés | `apps/`, `libs/` organisés       |
| **Base de données** | Bind mount `./backend/db`       | Volume nommé `parapente-db-data` |
| **Build frontend**  | `npm run build` dans frontend/  | `nx build frontend` (avec cache) |
| **CI/CD**           | 2 workflows séparés             | 1 workflow unifié + Nx affected  |
| **Cache**           | Local uniquement                | Local + Nx Cloud distribué       |
| **Tests**           | Tous les tests à chaque run     | Seulement tests affectés         |
| **Temps CI**        | ~8-12 minutes                   | ~3-5 minutes (avec cache)        |
| **Shared code**     | Copier/coller                   | `libs/shared-types` partagée     |

---

## 🔍 Troubleshooting

### Problème: "Cannot find package '@vitejs/plugin-react'"

**Cause**: Dépendances npm manquantes dans le container

**Solution**:

```bash
# Rebuild complet sans cache
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Problème: "Database locked"

**Cause**: Plusieurs processus tentent d'accéder à SQLite simultanément

**Solution**:

```bash
# Redémarrer le backend
docker-compose restart backend

# Vérifier qu'il n'y a qu'un seul container backend
docker ps | grep parapente-backend
```

### Problème: "No such file or directory: /app/db/dashboard.db"

**Cause**: Le volume n'a pas été créé ou les données n'ont pas été migrées

**Solution**:

```bash
# Vérifier que le volume existe
docker volume inspect parapente-db-data

# Recréer et remigrer (voir Phase 1.4-1.5)
```

### Problème: Frontend affiche "502 Bad Gateway"

**Cause**: Backend pas encore démarré ou crashed

**Solution**:

```bash
# Vérifier les logs backend
docker-compose logs backend

# Vérifier le healthcheck
docker-compose ps backend

# Redémarrer si nécessaire
docker-compose restart backend
```

### Problème: Nx Cloud ne se connecte pas

**Cause**: L'app GitHub Nx Cloud n'est pas installée ou le repo n'a pas accès

**Solution**:

1. Vérifier sur https://github.com/apps/nx-cloud
2. S'assurer que `dashboard-parapente` est dans les repos autorisés
3. Re-run le workflow GitHub Actions

---

## 📞 Support

- **Documentation Nx**: https://nx.dev/getting-started/intro
- **Nx Cloud**: https://cloud.nx.app/orgs/capic2
- **GitHub Actions**: https://github.com/capic2/dashboard-parapente/actions
- **NX_MIGRATION.md**: Guide complet de la migration

---

## ✅ Checklist Finale

Avant de considérer la migration comme complète:

- [ ] Application accessible sur https://parapente.capic.ignorelist.com
- [ ] Dashboard météo fonctionne (6 sites visibles)
- [ ] Analytics/Stats affichent les vols existants
- [ ] Pas d'erreurs dans les logs (`docker-compose logs`)
- [ ] Healthchecks au vert (`docker-compose ps`)
- [ ] GitHub Actions CI passe ✅
- [ ] Nx Cloud workspace visible sur https://cloud.nx.app
- [ ] Backup DB créé et stocké (`backup-db-*.tar.gz`)
- [ ] Volume Docker créé (`parapente-db-data`)
- [ ] Données migrées et vérifiées
- [ ] Fonctionnalités critiques testées:
  - [ ] Sync météo automatique
  - [ ] Import GPX Strava (si configuré)
  - [ ] Alertes Telegram (si configuré)
  - [ ] Export vidéos (si utilisé)

---

**Date de migration**: ******\_\_\_******  
**Validé par**: ******\_\_\_******  
**Notes**: ******\_\_\_******
