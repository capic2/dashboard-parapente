# Conversion Vidéo Automatique - Implémentation

## Vue d'ensemble

Le système de conversion vidéo a été modifié pour fonctionner **automatiquement en arrière-plan** dès qu'un fichier GPX est uploadé. L'utilisateur n'a plus besoin de déclencher manuellement l'export - il peut simplement télécharger la vidéo une fois qu'elle est prête.

## Workflow Automatique

```
Upload GPX → Auto-trigger conversion → Background processing → Download ready
```

### 1. Upload GPX (Déclencheur)

Trois points d'entrée déclenchent automatiquement la conversion vidéo :

- **Upload manuel** : `POST /api/flights/{id}/upload-gpx`
- **Création vol depuis GPX** : `POST /api/flights/create-from-gpx`
- **Webhook Strava** : Import automatique depuis Strava

### 2. Conversion Automatique (Arrière-plan)

Dès qu'un GPX est détecté, le système :
- Vérifie que le vol n'a pas déjà une vidéo en cours/terminée
- Lance automatiquement la conversion avec les paramètres optimaux :
  - Qualité : **1080p**
  - FPS : **15** (meilleur compromis qualité/vitesse)
  - Vitesse : **1×** (temps réel)
  - Mode : **Manual Render** (qualité parfaite, 0 saccades)

### 3. Statut Temps Réel

Le statut de la vidéo est stocké dans la base de données :

| Champ | Description |
|-------|-------------|
| `video_export_job_id` | ID du job de conversion |
| `video_export_status` | `processing`, `completed`, `failed` |
| `video_file_path` | Chemin vers le fichier MP4 |

### 4. Interface Utilisateur

Le bouton change automatiquement selon le statut :

| Statut | Bouton | État | Action |
|--------|--------|------|--------|
| `null` | 🎥 Générer la vidéo | Activé (bleu) | Lance la conversion |
| `processing` | ⏳ Conversion en cours... | Désactivé | Attend (auto-refresh) |
| `completed` | 📥 Télécharger la vidéo | Activé (vert) | Télécharge le MP4 |
| `failed` | 🔄 Relancer la conversion | Activé (bleu) | Relance la conversion |

**Comportements** :
- **Nouveaux vols avec GPX** : Conversion démarre automatiquement → Bouton "⏳ Conversion en cours..."
- **Vols existants sans vidéo** : Bouton "🎥 Générer la vidéo" → Clique pour lancer
- **Auto-refresh** : Le frontend fait un polling toutes les 10 secondes si `processing`

## Architecture Technique

### Backend

#### Modèle de Données

**Fichier** : `backend/models.py`

```python
class Flight(Base):
    # ... champs existants ...
    
    # Nouveaux champs vidéo
    video_export_job_id = Column(String, nullable=True)
    video_export_status = Column(String, nullable=True)  # "processing", "completed", "failed"
    video_file_path = Column(String, nullable=True)
```

#### Migration Base de Données

**Fichier** : `backend/migrate_add_video_fields.py`

Script qui ajoute les 3 colonnes à la table `flights` :

```bash
cd backend
source venv/bin/activate
python migrate_add_video_fields.py
```

#### Fonction Auto-Trigger

**Fichier** : `backend/video_export_manual.py`

```python
def trigger_auto_export(flight_id: str, db: Session, frontend_url: str):
    """
    Déclenche automatiquement la conversion vidéo si :
    - Le vol a un GPX
    - Pas de conversion déjà en cours/terminée
    """
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    
    if flight.gpx_file_path and flight.video_export_status not in ["processing", "completed"]:
        job_id = start_video_export_manual(
            flight_id=flight_id,
            quality="1080p",
            fps=15,
            speed=1,
            frontend_url=frontend_url,
            update_db=True
        )
        return job_id
```

#### Points de Déclenchement

**Fichier** : `backend/routes.py`

1. Après upload GPX (ligne ~1635) :
```python
# 5. Trigger automatic video export
try:
    from video_export_manual import trigger_auto_export
    trigger_auto_export(flight_id, db, frontend_url)
except Exception as e:
    logger.warning(f"Failed to trigger auto video export: {e}")
```

2. Après création vol depuis GPX (ligne ~1778)
3. Webhook Strava : `backend/webhooks.py` (ligne ~327)

#### Mise à Jour DB après Conversion

**Fichier** : `backend/video_export_manual.py`

```python
# En cas de succès
flight.video_export_status = "completed"
flight.video_file_path = f"exports/videos/flight_{flight_id}.mp4"
db.commit()

# En cas d'échec
flight.video_export_status = "failed"
db.commit()
```

### Frontend

#### Hook pour Récupérer le Vol

**Fichier** : `frontend/src/hooks/useFlight.ts`

```typescript
export const useFlight = (flightId: string) => {
  return useQuery<Flight>({
    queryKey: ['flights', flightId],
    queryFn: async () => {
      const data = await api.get(`flights/${flightId}`).json()
      return data
    },
    staleTime: 1000 * 10, // 10 secondes
    refetchInterval: (query) => {
      // Auto-refresh si vidéo en cours
      const data = query.state.data as Flight | undefined
      return data?.video_export_status === 'processing' ? 10000 : false
    },
  })
}
```

#### Bouton Vidéo Dynamique

**Fichier** : `frontend/src/components/FlightViewer3D.tsx`

```tsx
{flight?.gpx_file_path && (
  <button
    onClick={async () => {
      if (flight.video_export_status === 'completed') {
        // Download video
        window.open(`${API_BASE_URL}/api/exports/${flight.video_export_job_id}/download`, '_blank');
      } else if (!flight.video_export_status || flight.video_export_status === 'failed') {
        // Generate video (for existing flights without video)
        const response = await fetch(`${API_BASE_URL}/api/flights/${flightId}/generate-video`, {
          method: 'POST',
        });
        const data = await response.json();
        window.location.reload(); // Refresh to show "processing" status
      }
    }}
    disabled={flight.video_export_status === 'processing'}
    className={`w-full px-3 py-2 text-white rounded mb-3 ${
      flight.video_export_status === 'completed'
        ? 'bg-green-600 hover:bg-green-700'
        : flight.video_export_status === 'processing'
        ? 'bg-gray-400 cursor-not-allowed'
        : 'bg-blue-600 hover:bg-blue-700'
    }`}
  >
    {flight.video_export_status === 'processing' && '⏳ Conversion en cours...'}
    {flight.video_export_status === 'completed' && '📥 Télécharger la vidéo'}
    {flight.video_export_status === 'failed' && '🔄 Relancer la conversion'}
    {!flight.video_export_status && '🎥 Générer la vidéo'}
  </button>
)}
```

#### Schéma API

**Fichier** : `frontend/src/hooks/useFlight.ts`

```typescript
export interface Flight {
  id: string
  name?: string
  gpx_file_path?: string
  video_export_job_id?: string
  video_export_status?: 'processing' | 'completed' | 'failed' | null
  video_file_path?: string
  // ... autres champs
}
```

## Fichiers Modifiés

### Backend (Python)

| Fichier | Changements |
|---------|-------------|
| `models.py` | Ajout des 3 champs vidéo au modèle Flight |
| `schemas.py` | Ajout des 3 champs au schéma Flight |
| `video_export_manual.py` | Ajout fonction `trigger_auto_export()` + gestion DB dans threads |
| `routes.py` | Appel `trigger_auto_export()` après upload GPX (3 endroits) + endpoint `POST /flights/{id}/generate-video` |
| `webhooks.py` | Appel `trigger_auto_export()` après import Strava |
| `migrate_add_video_fields.py` | **Nouveau** - Script de migration DB |

### Frontend (TypeScript/React)

| Fichier | Changements |
|---------|-------------|
| `hooks/useFlight.ts` | **Nouveau** - Hook pour récupérer le vol avec auto-refresh |
| `components/FlightViewer3D.tsx` | Remplacement bouton export par bouton download dynamique |

### Supprimé

- Composant `ExportVideoModal` (plus nécessaire)
- Fonctions `startVideoExport()`, `pollExportStatus()`, `cancelVideoExport()`
- États `isExporting`, `exportProgress`, `exportStatus`, `exportJobId`
- Overlay d'export en cours

## Durée de Conversion

Pour un vol de 6 minutes avec les paramètres optimaux :

- **Qualité** : 1080p
- **FPS** : 15
- **Approche** : Manual Render (frame-by-frame)
- **Durée estimée** : **60-90 minutes**

La conversion se fait entièrement en arrière-plan sur le serveur. L'utilisateur peut :
- Fermer le navigateur
- Continuer à naviguer sur le site
- Revenir plus tard pour télécharger la vidéo

## Testing

### 1. Tester l'Upload GPX (Nouveaux Vols)

```bash
# Démarrer le backend
cd backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8001

# Uploader un GPX via l'interface ou API
curl -X POST http://localhost:8001/api/flights/{flight_id}/upload-gpx \
  -F "gpx_file=@/path/to/file.gpx"

# Vérifier le statut
curl http://localhost:8001/api/flights/{flight_id}
# Devrait retourner video_export_status: "processing"
```

**Interface** :
1. Ouvrir `http://localhost:8001`
2. Uploader un GPX sur un vol
3. Le bouton affiche automatiquement "⏳ Conversion en cours..."
4. Après 60-90 min → "📥 Télécharger la vidéo" (vert)

### 2. Tester Génération Manuelle (Vols Existants)

```bash
# Via API
curl -X POST http://localhost:8001/api/flights/{flight_id}/generate-video

# Vérifier le statut
curl http://localhost:8001/api/flights/{flight_id}
# Devrait retourner video_export_status: "processing"
```

**Interface** :
1. Ouvrir un vol qui a un GPX mais pas de vidéo
2. Le bouton affiche "🎥 Générer la vidéo" (bleu)
3. Cliquer → La conversion démarre
4. Le bouton devient "⏳ Conversion en cours..."
5. Après 60-90 min → "📥 Télécharger la vidéo" (vert)

### 3. Vérifier les Logs

```bash
# Backend logs
tail -f backend/uvicorn.log

# Chercher :
# "🚀 Auto-triggering video export for flight {id}"
# "✅ Video export job {job_id} started"
# "✅ Export completed"
```

## Troubleshooting

### La vidéo ne se déclenche pas automatiquement

**Vérifier** :
1. Le vol a bien un `gpx_file_path` dans la DB
2. Le statut vidéo n'est pas déjà `processing` ou `completed`
3. Les logs backend montrent "🚀 Auto-triggering video export"

**Solution** : Relancer manuellement via API si besoin
```bash
POST /api/flights/{id}/export-video
{"mode": "manual", "quality": "1080p", "fps": 15}
```

### Le bouton reste grisé indéfiniment

**Causes possibles** :
1. La conversion a échoué silencieusement
2. Le frontend ne rafraîchit pas le statut

**Vérifier** :
```bash
# Statut dans la DB
sqlite3 backend/db/dashboard.db
SELECT id, name, video_export_status, video_export_job_id FROM flights WHERE id = 'XXX';

# Statut du job
curl http://localhost:8001/api/exports/{job_id}/status
```

### Conversion échouée

**Vérifier** :
1. FFmpeg est installé : `which ffmpeg`
2. Playwright browsers installés : `playwright install chromium`
3. Permissions sur `backend/exports/videos/`
4. Espace disque disponible (5400 PNG × 2 MB = ~10 GB temporaires)

**Relancer** :
```bash
# Réinitialiser le statut
UPDATE flights SET video_export_status = NULL, video_export_job_id = NULL WHERE id = 'XXX';

# Uploader à nouveau le GPX
POST /api/flights/{id}/upload-gpx
```

## Améliorations Futures

### Court Terme
- [ ] Notification email/push quand vidéo prête
- [ ] Barre de progression visible dans la liste des vols
- [ ] Bouton "Retry" si échec

### Moyen Terme
- [ ] Paramètres personnalisables (qualité, FPS, vitesse)
- [ ] Queue de jobs avec priorités
- [ ] Annulation possible via UI

### Long Terme
- [ ] Thumbnails/previews générés automatiquement
- [ ] Streaming vidéo au lieu de téléchargement complet
- [ ] Compression optimisée pour partage réseaux sociaux

## Références

- **Architecture Manual Render** : `CESIUM_VIDEO_EXPORT_BEST_PRACTICES.md`
- **Recommandations Qualité** : `VIDEO_QUALITY_RECOMMENDATIONS.md`
- **Optimisations Performance** : `VIDEO_EXPORT_OPTIMIZATION.md`
- **Configuration Production** : `PRODUCTION_SETUP.md`

---

**Statut** : ✅ Implémentation complète, prêt à tester  
**Date** : 2026-03-06  
**Version** : 1.0.0
