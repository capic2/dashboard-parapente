# Video Exports

Ce répertoire contient les vidéos exportées des vols de parapente.

## Structure

```
exports/
└── videos/
    ├── flight-{id}-{timestamp}.mp4   # Vidéos finales
    └── flight-{id}-{timestamp}.webm  # Fichiers temporaires (supprimés après conversion)
```

## API d'Export Vidéo

### Démarrer un export

```bash
POST /api/flights/{flight_id}/export-video
Content-Type: application/json

{
  "fps": 30,           # Frames par seconde (défaut: 30)
  "quality": "1080p",  # Qualité: "720p", "1080p", "4K" (défaut: "1080p")
  "speed": 1           # Vitesse: 1 = temps réel, 2 = 2x plus rapide (défaut: 1)
}
```

**Réponse:**
```json
{
  "job_id": "5afec50c-...-1772771237",
  "message": "Video export started",
  "status_url": "/exports/5afec50c-...-1772771237/status"
}
```

### Vérifier le statut

```bash
GET /api/exports/{job_id}/status
```

**Réponse:**
```json
{
  "flight_id": "5afec50c-c14e-47f9-8847-4ae53b401a17",
  "status": "capturing",        // "started", "capturing", "encoding", "completed", "failed"
  "progress": 25,               // 0-100%
  "message": "Recording... 100s / 407s",
  "started_at": "2026-03-06T05:27:17.189799",
  "video_path": null,           // Chemin du fichier quand complété
  "error": null                 // Message d'erreur si échec
}
```

### Télécharger la vidéo

```bash
GET /api/exports/{job_id}/download
```

Retourne le fichier MP4 avec `Content-Type: video/mp4`.

## Durée d'Export Estimée

Pour un vol de **6 minutes**:
- **Recording Canvas**: ~8 minutes (temps réel + overhead)
- **Encoding FFmpeg**: ~15-20 minutes (dépend du CPU)
- **Total**: ~25-30 minutes

### Facteurs influençant la durée:
- **Durée du vol**: Recording ≈ durée du vol × 1.3
- **FPS**: Plus de FPS = plus de données = encoding plus long
- **Qualité**: 4K prend 4× plus de temps que 720p
- **CPU**: Encoding FFmpeg est très CPU-intensif

## Processus Technique

1. **Playwright** ouvre la page `/export-viewer?flightId={id}` en mode headless
2. **Canvas.captureStream()** enregistre le canvas Cesium en temps réel
3. **MediaRecorder API** encode en WebM (VP9)
4. **FFmpeg** convertit WebM → MP4 (H.264) pour compatibilité maximale

## Troubleshooting

### "FFmpeg not found"
FFmpeg n'est pas installé. Voir `PRODUCTION_SETUP.md`.

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# Vérifier
ffmpeg -version
```

### "Browser not found"
Playwright Chromium n'est pas installé.

```bash
python -m playwright install chromium --with-deps
```

### Export très lent
- Vérifier CPU disponible (FFmpeg utilise 4+ cores)
- Réduire FPS à 15-20 au lieu de 30
- Utiliser qualité "720p" au lieu de "1080p"

### Vidéo noire ou vide
- Vérifier que le terrain Cesium se charge (timeout 65s)
- Vérifier logs Playwright pour erreurs WebGL
- Essayer en mode non-headless pour debug: `headless=False`

### Timeout terrain
Le timeout est configuré à 65s. Si le terrain ne charge pas:
- Vérifier connexion internet (télécharge tuiles terrain)
- Augmenter timeout dans `video_export.py`
- Vérifier token Cesium Ion

## Limitations Actuelles

- **Résolution**: Utilise la taille du viewport Cesium (1280×600) au lieu de la résolution demandée
- **Framerate**: Le WebM utilise un framerate variable au lieu du FPS fixe demandé
- **Concurrent exports**: Pas de limite, peut surcharger le serveur
- **Storage**: Les vidéos ne sont pas automatiquement supprimées (à implémenter)

## Améliorations Futures

- [ ] File d'attente avec limitation de concurrence (Celery)
- [ ] Nettoyage automatique des anciennes vidéos (>7 jours)
- [ ] Support audio (superposition musique/narration)
- [ ] Support sous-titres (affichage métriques vol)
- [ ] Choix thème/style carte (satellite, terrain, street)
- [ ] Preview thumbnail avant export complet
- [ ] Notifications email/webhook quand export terminé
