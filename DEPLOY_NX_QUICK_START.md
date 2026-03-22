# 🚀 Déploiement NX - Quick Start

## Pour déployer la version NX sur Portainer (10 minutes)

### Étape 1 : Merger la branche (si pas déjà fait)

```bash
git checkout main
git merge nx-cloud-setup
git push origin main
```

### Étape 2 : Dans Portainer

1. **Aller sur** : Stacks → `dashboard-parapente`
2. **Cliquer** : "Pull and Redeploy" (ou "Update the stack")
3. **Attendre** : ~10 minutes (build frontend NX)
4. **Vérifier** : Healthcheck vert ✅

### Étape 3 : Validation

```bash
# Tester l'accès
curl https://votre-domaine.com
curl https://votre-domaine.com/api/health

# Vérifier les logs
# Dans Portainer → Containers → parapente-backend → Logs
# Vous devriez voir :
# ✓ Static directory found: /app/static
# INFO:     Uvicorn running on http://0.0.0.0:8001
```

### Étape 4 : C'est fini ! 🎉

**Rien d'autre à faire.** Tout fonctionne comme avant.

---

## 🔍 En cas de problème

### Le build échoue

```bash
# Vérifier les logs du build dans Portainer
# Chercher les erreurs dans "Build logs"

# Erreur commune : cache npm
# Solution : Rebuild sans cache
# Dans Portainer : Cocher "Re-pull image and redeploy"
```

### Le frontend ne se charge pas

```bash
# Vérifier que les fichiers statiques sont présents
docker exec parapente-backend ls -la /app/static

# Devrait afficher :
# index.html
# assets/

# Si vide, le build frontend a échoué
# Vérifier les logs du build (étape "frontend-builder")
```

### L'API ne répond pas

```bash
# Vérifier que le backend démarre
docker logs parapente-backend

# Chercher :
# ✓ Static directory found
# ✓ Database tables created
# INFO: Uvicorn running

# Si erreur de migration DB :
# C'est normal, les migrations peuvent skip si déjà appliquées
```

---

## 📊 Monitoring Post-Déploiement

### Checklist 5 minutes :

- [ ] Frontend charge : `https://votre-domaine.com`
- [ ] API répond : `https://votre-domaine.com/api/sites`
- [ ] Redis connecté : Logs backend → "Redis connection successful"
- [ ] Healthcheck vert : Portainer → Container status
- [ ] CPU/RAM normal : Portainer → Stats

---

## 🎯 Différences Visibles

**Aucune** ! 😊

L'utilisateur final ne verra **aucune différence**.
Tout est identique côté production.

Seul changement : Code mieux organisé en monorepo (développement uniquement)

---

**Temps estimé** : 10 minutes
**Downtime** : ~8-10 minutes durant le build
**Risque** : Très faible (structure identique)
**Rollback** : Possible via Git revert si besoin
