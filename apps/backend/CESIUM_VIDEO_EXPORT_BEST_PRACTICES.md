# Export Vidéo - Best Practices Cesium

## Documentation Officielle Cesium

Cesium recommande pour le contrôle précis du rendu:
https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/

## Approche Recommandée par Cesium

### 1. Désactiver le Render Loop Automatique

```javascript
const viewer = new Cesium.Viewer('cesiumContainer', {
    useDefaultRenderLoop: false,  // Désactive requestAnimationFrame automatique
    targetFrameRate: undefined    // Pas de framerate cible
});
```

### 2. Render Manuel Frame-par-Frame

```javascript
// Pour chaque position GPS:
viewer.scene.render(julianDate);  // Rend la scène à cette date précise
```

### 3. Clock en Mode Manuel

```javascript
viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
viewer.clock.shouldAnimate = false;  // Pas d'animation automatique

// Avancer manuellement
viewer.clock.currentTime = nextJulianDate;
viewer.scene.render(nextJulianDate);
```

## Implémentation pour Export Vidéo

### Approche Position-par-Position (Recommandé Cesium)

```javascript
// Setup
const viewer = new Cesium.Viewer('cesiumContainer', {
    useDefaultRenderLoop: false,
    shouldAnimate: false,
    requestRenderMode: true
});

// Pour chaque position GPS
for (let i = 0; i < gpsPoints.length; i++) {
    // 1. Mettre à jour le temps
    viewer.clock.currentTime = JulianDate.fromDate(gpsPoints[i].timestamp);
    
    // 2. Mettre à jour la position de l'entity
    entity.position = Cartesian3.fromDegrees(
        gpsPoints[i].lon,
        gpsPoints[i].lat,
        gpsPoints[i].alt
    );
    
    // 3. Mettre à jour la caméra
    viewer.camera.setView({
        destination: gpsPoints[i].position,
        orientation: {
            heading: cameraHeading,
            pitch: cameraPitch,
            roll: 0.0
        }
    });
    
    // 4. Forcer le rendu (important!)
    viewer.scene.render(viewer.clock.currentTime);
    
    // 5. Attendre que les tiles se chargent si nécessaire
    await waitForTilesToLoad(viewer);
    
    // 6. Capturer frame (screenshot ou canvas.captureStream)
    await captureFrame(i);
}

function waitForTilesToLoad(viewer) {
    return new Promise((resolve) => {
        if (viewer.scene.globe.tilesLoaded) {
            resolve();
        } else {
            const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((queuedTiles) => {
                if (queuedTiles === 0) {
                    removeListener();
                    resolve();
                }
            });
        }
    });
}
```

### Avantages de cette Approche

✅ **Contrôle Total**: Chaque frame est rendue exactement quand on veut
✅ **Pas de Saccades**: Chaque frame = 1 position GPS précise
✅ **Tiles Chargées**: On peut attendre que toutes les tuiles soient prêtes
✅ **FPS Garanti**: On contrôle exactement combien de frames on capture

### Inconvénients

❌ **Lent**: Une frame à la fois (mais qualité garantie)
❌ **Complexe**: Besoin de gérer le clock et les tiles manuellement

## Implémentation Backend (Playwright)

```python
async def export_video_cesium_manual_render(page, gps_points, fps):
    """
    Export vidéo avec contrôle manuel du rendu Cesium
    """
    
    # 1. Setup Cesium en mode manuel
    await page.evaluate("""
        () => {
            // Désactiver render loop automatique
            const viewer = window._cesiumViewer;
            viewer.useDefaultRenderLoop = false;
            viewer.clock.shouldAnimate = false;
            
            // Fonction pour rendre manuellement
            window._renderFrame = (julianDate) => {
                viewer.clock.currentTime = julianDate;
                viewer.scene.render(julianDate);
                return viewer.scene.globe.tilesLoaded;
            };
            
            console.log('✅ Cesium en mode render manuel');
        }
    """)
    
    # 2. Pour chaque position GPS
    for i, point in enumerate(gps_points):
        # Mettre à jour position et caméra
        tiles_loaded = await page.evaluate(f"""
            () => {{
                const viewer = window._cesiumViewer;
                const time = Cesium.JulianDate.fromDate(new Date({point.timestamp}));
                
                // Mettre à jour entity position
                // ... (update position)
                
                // Mettre à jour caméra
                viewer.camera.setView({{
                    destination: Cesium.Cartesian3.fromDegrees({point.lon}, {point.lat}, {point.alt}),
                    // ... orientation
                }});
                
                // Rendre la frame
                return window._renderFrame(time);
            }}
        """)
        
        # 3. Attendre tiles si nécessaire
        if not tiles_loaded:
            await wait_for_tiles(page)
        
        # 4. Screenshot
        await page.screenshot(f"frame_{i:05d}.png")
        
        if i % 30 == 0:
            print(f"📸 Captured {i}/{len(gps_points)} frames")
```

## Comparaison des Approches

| Approche | Qualité | Vitesse | Complexité | Recommandé Cesium |
|----------|---------|---------|------------|-------------------|
| MediaRecorder temps réel | ⭐⭐ Saccadé | ⭐⭐⭐ Rapide (~8min) | ⭐ Simple | ❌ Non |
| Screenshots setInterval | ⭐⭐⭐ Moyen | ⭐ Très lent (~20h) | ⭐⭐ Moyen | ❌ Non |
| **Manual Render** | ⭐⭐⭐⭐⭐ Parfait | ⭐⭐ Lent (~2-3h) | ⭐⭐⭐ Complexe | ✅ **OUI** |

## Recommandation Finale

Pour une qualité **parfaite sans saccades**, implémenter l'approche **Manual Render** avec:

1. `useDefaultRenderLoop: false`
2. `scene.render()` manuel pour chaque position
3. Attendre `globe.tilesLoaded` avant capture
4. Screenshot de chaque frame

**Estimation**:
- Vol de 6 min = ~360 points GPS (1 par seconde)
- À 15 FPS = ~5400 frames
- 1 frame/seconde en moyenne = **~90 minutes total**

**Trade-off**:
- ✅ Qualité parfaite, 0 saccades
- ❌ 3× plus lent que MediaRecorder actuel

## Décision à Prendre

1. **Garder MediaRecorder** (rapide mais saccadé) pour exports quotidiens
2. **Implémenter Manual Render** (lent mais parfait) comme option "haute qualité"

Ou:

3. **Implémenter uniquement Manual Render** et accepter temps d'export plus long

