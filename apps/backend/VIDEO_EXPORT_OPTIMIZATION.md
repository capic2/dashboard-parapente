# Video Export - Optimisations de Performance et Qualité

## Problèmes identifiés

### Vidéo saccadée et point non suivi
- **Cause 1**: Ressources limitées au navigateur headless
- **Cause 2**: `canvas.captureStream(fps)` ne garantit pas le framerate
- **Cause 3**: Canvas à mauvaise résolution (viewport au lieu de qualité demandée)
- **Cause 4**: Bitrate trop bas (8 Mbps)

## Solutions implémentées

### 1. Augmentation des ressources Chromium

```python
'--js-flags=--max-old-space-size=4096',  # 4GB heap pour JS (vs 1GB default)
'--disable-background-timer-throttling',  # Pas de throttling des timers
'--disable-backgrounding-occluded-windows',
'--disable-renderer-backgrounding',
```

**Impact**: Cesium a plus de mémoire pour charger les tuiles terrain et rendre les frames.

### 2. Canvas forcé à la résolution cible

```javascript
canvas.width = 1920;   // Au lieu du viewport size
canvas.height = 1080;
```

**Impact**: Vidéo finale à la bonne résolution au lieu de 1280×600.

### 3. Capture manuelle de frames à FPS fixe

**Avant** (automatique):
```javascript
const stream = canvas.captureStream(30); // FPS non garanti
```

**Après** (manuel):
```javascript
const stream = canvas.captureStream(0); // Mode manuel
const track = stream.getVideoTracks()[0];

// Capture précise toutes les 33.33ms pour 30 FPS
setInterval(() => {
    track.requestFrame();
}, 1000 / 30);
```

**Impact**: FPS constant et précis.

### 4. Bitrate augmenté

```javascript
videoBitsPerSecond: 20000000  // 20 Mbps (vs 8 Mbps)
```

**Impact**: Meilleure qualité vidéo, moins de compression artifacts.

## Résultats attendus

| Métrique | Avant | Après |
|----------|-------|-------|
| Résolution | 1280×600 | 1920×1080 |
| FPS | Variable (~15-25) | Fixe 30 |
| Bitrate | 8 Mbps | 20 Mbps |
| Fluidité | Saccadé | Fluide |
| Suivi caméra | Décalé | Précis |

## Optimisations futures possibles

### Si la vidéo reste saccadée:

#### Option 1: Augmenter encore les ressources
```python
'--js-flags=--max-old-space-size=8192',  # 8GB au lieu de 4GB
```

#### Option 2: Réduire le FPS
```python
fps = 24  # Au lieu de 30 (film cinéma)
# ou
fps = 15  # Pour exports rapides
```

#### Option 3: Forcer le pré-chargement complet
Attendre que TOUTES les tuiles terrain soient chargées avant de démarrer:
```javascript
await viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
    if (viewer.scene.globe.tilesLoaded) {
        // Toutes les tuiles chargées, démarrer recording
    }
});
```

#### Option 4: Augmenter le temps de buffer
```python
while elapsed < video_duration + 10:  # 10s buffer au lieu de 5s
```

### Si FFmpeg encoding est trop lent:

#### Preset plus rapide
```python
"-preset", "fast",  # Au lieu de "medium"
# ou
"-preset", "veryfast",  # Encore plus rapide
```

**Trade-off**: Fichier plus gros pour même qualité.

#### Hardware encoding (si GPU disponible)
```python
"-c:v", "h264_nvenc",  # NVIDIA GPU
# ou
"-c:v", "h264_vaapi",  # Intel/AMD GPU
```

**Gain**: 5-10× plus rapide.

## Monitoring et Debug

### Vérifier les ressources utilisées

```bash
# Pendant l'export, dans un autre terminal:
docker stats <container_id>

# Ou directement:
ps aux | grep chromium
top -p <chromium_pid>
```

### Logs utiles

Chromium affiche dans la console:
- `✅ Canvas found, dimensions: 1920 x 1080` → Bonne résolution
- `⏱️ Frame capture interval: 33.33ms (30 FPS)` → Bon FPS
- `📸 Captured 900 frames` → Progression

### Test de qualité

Après export, vérifier avec FFprobe:
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,bit_rate \
  video.mp4
```

Attendu:
```
width=1920
height=1080
r_frame_rate=30/1
bit_rate=20000000
```

## Troubleshooting

### Vidéo toujours saccadée
1. Vérifier RAM disponible: `free -h`
2. Vérifier CPU load: `top`
3. Réduire FPS à 24 ou 15
4. Augmenter heap JS à 8GB

### Canvas noir ou vide
1. Vérifier WebGL fonctionne:
   ```bash
   chromium --headless --enable-webgl --print-to-pdf=test.pdf \
     http://webglreport.com
   ```
2. Essayer avec `headless=False` pour debug
3. Vérifier token Cesium Ion

### Export très long
1. Réduire quality: "720p" au lieu de "1080p"
2. Réduire FPS: 15 au lieu de 30
3. Utiliser preset FFmpeg "fast"

### Taille fichier énorme
1. Réduire bitrate: 10 Mbps au lieu de 20 Mbps
2. Utiliser preset "slow" pour meilleure compression
3. Passer en H.265 (HEVC) au lieu de H.264

## Métriques de référence

Pour un vol de **6 minutes**:

| FPS | Qualité | Bitrate | Taille fichier | Temps export |
|-----|---------|---------|----------------|--------------|
| 15  | 720p    | 5 Mbps  | ~25 MB         | ~15 min      |
| 24  | 720p    | 8 Mbps  | ~40 MB         | ~20 min      |
| 30  | 1080p   | 12 Mbps | ~60 MB         | ~25 min      |
| 30  | 1080p   | 20 Mbps | ~100 MB        | ~30 min      |
| 60  | 1080p   | 30 Mbps | ~150 MB        | ~45 min      |

**Recommandation**: 30 FPS, 1080p, 15-20 Mbps pour meilleur ratio qualité/taille/temps.
