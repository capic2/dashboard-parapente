# Guide de Migration - Champs Vidéo

## Problème

Erreur en production :
```
sqlalchemy.exc.OperationalError: no such column: flights.video_export_job_id
```

## Cause

Les nouvelles colonnes vidéo n'existent pas encore en base de données de production.

## Solution

### Étape 1 : Connexion au serveur de production

```bash
ssh user@production-server
cd /path/to/backend
```

### Étape 2 : Activation de l'environnement virtuel

```bash
source venv/bin/activate
```

### Étape 3 : Exécution de la migration

```bash
python migrate_add_video_fields.py
```

**Sortie attendue :**
```
Existing columns: {'id', 'name', 'flight_date', ...}
Adding video_export_job_id column...
✓ video_export_job_id added
Adding video_export_status column...
✓ video_export_status added
Adding video_file_path column...
✓ video_file_path added

✅ Migration completed successfully!
```

### Étape 4 : Redémarrage du service (si nécessaire)

```bash
# Si Docker
docker-compose restart backend

# Ou si systemd
sudo systemctl restart dashboard-parapente
```

### Étape 5 : Vérification

```bash
# Test API
curl http://localhost:8001/api/flights | jq '.[0] | keys' | grep video
```

Devrait afficher :
```json
"video_export_job_id"
"video_export_status"
"video_file_path"
```

## Colonnes Ajoutées

| Colonne | Type | Description |
|---------|------|-------------|
| `video_export_job_id` | VARCHAR | ID du job de génération vidéo |
| `video_export_status` | VARCHAR | "processing", "completed", "failed" |
| `video_file_path` | VARCHAR | Chemin vers le fichier MP4 |

## Rollback (si nécessaire)

```sql
-- Se connecter à SQLite
sqlite3 db/dashboard.db

-- Supprimer les colonnes
ALTER TABLE flights DROP COLUMN video_export_job_id;
ALTER TABLE flights DROP COLUMN video_export_status;
ALTER TABLE flights DROP COLUMN video_file_path;
```

**Note** : SQLite ne supporte pas `DROP COLUMN` nativement. Il faut :
1. Créer une nouvelle table sans ces colonnes
2. Copier les données
3. Renommer la table

## En Cas de Problème

### Migration déjà appliquée

Si les colonnes existent déjà :
```
✓ video_export_job_id already exists
✓ video_export_status already exists
✓ video_file_path already exists
```

C'est normal, la migration est idempotente (peut être exécutée plusieurs fois).

### Permissions refusées

```bash
# Vérifier les permissions
ls -la db/dashboard.db

# Donner les permissions si nécessaire
chmod 664 db/dashboard.db
```

### Base de données verrouillée

```
sqlite3.OperationalError: database is locked
```

Solution :
1. Arrêter le backend
2. Exécuter la migration
3. Redémarrer le backend

## Après Migration

✅ L'erreur `no such column` devrait disparaître
✅ Les vidéos pourront être générées
✅ Les statuts vidéo seront trackés en DB
✅ Le bouton "Générer/Télécharger" fonctionnera correctement

---

**Date de création** : 2026-03-06  
**Version** : 1.0.0
