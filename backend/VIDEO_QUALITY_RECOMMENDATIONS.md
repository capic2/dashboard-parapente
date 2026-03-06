# Recommandations Qualité Vidéo Export

## Problème: Vidéo Saccadée

### Causes Root

1. **setInterval() vs Rendu Cesium**
   - Le FlightViewer3D utilise `setInterval(16ms)` pour l'animation
   - Cesium rend de manière asynchrone (pas synchronisé avec setInterval)
   - MediaRecorder capture le canvas mais Cesium n'a pas forcément rendu
   - Résultat: Frames manquées ou dupliquées → saccades

2. **Ressources Limitées en Headless**
   - Chromium headless a moins de priorité CPU/GPU
   - WebGL rendering plus lent qu'en mode graphique
   - Tuiles terrain se chargent lentement

3. **Capture Temps Réel vs FPS Fixe**
   - MediaRecorder capture "en temps réel" pendant que le vol s'anime
   - Si Cesium rend à 20 FPS mais on demande 30 FPS → duplication de frames
   - Si Cesium rend à 40 FPS mais on demande 30 FPS → frames sautées

## Solutions Appliquées

### ✅ FPS Réduit à 15 (Default)

**Avant**: 30 FPS
**Après**: 15 FPS

**Raison**: 
- 15 FPS constant > 30 FPS irrégulier
- Moins de charge sur le browser
- Cesium peut rendre chaque frame correctement
- Toujours fluide pour l'œil humain

### ✅ Ressources Augmentées

- 4GB heap JavaScript
- Pas de throttling des timers
- GPU forcé même en headless

### ✅ Bitrate Élevé (20 Mbps)

Compense la réduction de FPS par plus de qualité par frame.

## Limitations Actuelles

### Approche MediaRecorder

L'approche actuelle utilise `canvas.captureStream()` + `MediaRecorder`:

**Avantages**:
- ✅ Rapide (~8 min pour 6 min de vol)
- ✅ Simple à implémenter
- ✅ Pas de stockage intermédiaire de frames

**Inconvénients**:
- ❌ Pas de contrôle fin sur chaque frame
- ❌ Dépend de la vitesse de rendu Cesium
- ❌ Peut sauter ou dupliquer des frames

### Approche Alternative (Non Implémentée)

**Screenshots Position-par-Position**:

```python
# Pour chaque position GPS:
for i, position in enumerate(gps_points):
    # 1. Téléporter à la position
    await page.evaluate(f"moveTo({position})")
    
    # 2. Attendre que Cesium rende
    await page.wait_for_timeout(100)
    
    # 3. Screenshot
    await page.screenshot(f"frame{i:05d}.png")
```

**Avantages**:
- ✅ Contrôle total sur chaque frame
- ✅ Garantit que Cesium a rendu avant capture
- ✅ Pas de saccades possibles

**Inconvénients**:
- ❌ TRÈS lent (~6h pour 6 min de vol à 30 FPS)
- ❌ Stockage massif de PNGs
- ❌ Complexe à implémenter

## Recommandations d'Utilisation

### Pour Meilleure Qualité

```json
{
  "fps": 15,
  "quality": "1080p",
  "speed": 1
}
```

- **15 FPS**: Optimal pour balance fluidité/qualité
- **1080p**: Full HD, bonne résolution
- **Speed 1×**: Synchronisé avec caméra GoPro

### Pour Export Rapide

```json
{
  "fps": 10,
  "quality": "720p",
  "speed": 1
}
```

- **10 FPS**: Plus rapide, toujours acceptable
- **720p**: Encode 2× plus vite que 1080p
- Durée export: ~15 min pour 6 min de vol

### Pour Maximum Qualité (Lent)

```json
{
  "fps": 24,
  "quality": "1080p",
  "speed": 1
}
```

- **24 FPS**: Standard cinéma
- Risque de saccades si CPU faible
- Durée export: ~40 min pour 6 min de vol

## Workflow Optimal

### 1. Preview Test (Rapide)

```bash
POST /api/flights/{id}/export-video
{
  "fps": 10,
  "quality": "720p"
}
```

Vérifier que:
- ✅ Le vol s'anime correctement
- ✅ La caméra suit bien
- ✅ Pas d'erreurs terrain

**Durée**: ~10 min

### 2. Export Final (Qualité)

Une fois le preview validé:

```bash
POST /api/flights/{id}/export-video
{
  "fps": 15,
  "quality": "1080p"
}
```

**Durée**: ~20-25 min

## Améliorations Futures Possibles

### Court Terme

1. **Pré-chargement Complet des Tuiles**
   - Attendre que 100% des tuiles terrain soient chargées avant recording
   - +2-3 min de setup mais export plus fluide

2. **Export Batch Nocturne**
   - Queue système pour exports en masse
   - Pendant la nuit quand serveur peu utilisé

### Moyen Terme

3. **Cesium Animation.Clock Contrôlé**
   - Utiliser Cesium Clock en mode manuel
   - Avancer frame-par-frame au lieu de temps réel
   - **Bénéfice**: Garanti 0 saccades
   - **Coût Dev**: 2-3 jours

4. **requestAnimationFrame Sync**
   - Synchroniser capture avec le render loop de Cesium
   - **Bénéfice**: Capture exactement quand Cesium rend
   - **Coût Dev**: 1-2 jours

### Long Terme

5. **GPU Encoding FFmpeg**
   - Utiliser `h264_nvenc` (NVIDIA) ou `h264_vaapi` (Intel/AMD)
   - **Bénéfice**: Encoding 10× plus rapide
   - **Coût**: Besoin GPU sur serveur

6. **WebCodecs API**
   - Remplacer MediaRecorder par WebCodecs
   - Contrôle frame-par-frame
   - **Bénéfice**: Meilleure qualité, FPS garanti
   - **Coût Dev**: 1 semaine

## Conclusion

**État Actuel**: ✅ Fonctionnel avec limitations
- Vidéo générée en ~25 min
- Qualité acceptable à 15 FPS
- Peut avoir légères saccades

**Recommandation Immédiate**: 
- Utiliser **15 FPS** par défaut
- Tester avec **10 FPS** si saccades persistent
- Documenter auprès des utilisateurs que c'est normal

**Amélioration Prioritaire**:
1. Cesium Clock contrôlé (2-3 jours dev)
2. GPU encoding (si budget GPU)
3. WebCodecs API (si besoin perfection)
