# Orientation de Caméra Basée sur le Site

## 🎯 Vue d'Ensemble

Le système positionne automatiquement la caméra 3D selon l'**orientation du site de décollage**, offrant une vue "pilote" réaliste dès le chargement du FlightViewer3D.

## 📐 Sémantique de l'Orientation

### Définition

L'orientation représente **la direction vers laquelle regarde le pilote au décollage**.

**Exemples :**
- `orientation = "N"` → Le pilote regarde vers le **Nord**
- `orientation = "E"` → Le pilote regarde vers l'**Est**
- `orientation = "S"` → Le pilote regarde vers le **Sud**

### Logique Parapente

L'orientation correspond également à la **direction du vent favorable** :
- Si `orientation = "N"` → Vent du Nord est favorable (±45°)
- Cette logique est utilisée dans `best_spot.py` pour calculer les conditions optimales

### Cas d'Usage : Mont Poupet Nord

**Site** : Mont Poupet Nord  
**Orientation** : `N` (Nord)

**Signification** :
- ✅ Position géographique : Décollage au **Nord** du mont
- ✅ Direction de vue : Pilote regarde vers le **Nord** (dos au mont)
- ✅ Vent favorable : Vent du **Nord** (±45°)

**Résultat en 3D** : La caméra est positionnée face au Nord, offrant une vue panoramique vers la vallée.

---

## 🗺️ Mapping Orientation → Heading Caméra

Le système convertit l'orientation boussole en heading Cesium (degrés) :

| Orientation | Heading | Direction |
|-------------|---------|-----------|
| **N** | 0° | Nord |
| **NNE** | 22.5° | Nord-Nord-Est |
| **NE** | 45° | Nord-Est |
| **ENE** | 67.5° | Est-Nord-Est |
| **E** | 90° | Est |
| **ESE** | 112.5° | Est-Sud-Est |
| **SE** | 135° | Sud-Est |
| **SSE** | 157.5° | Sud-Sud-Est |
| **S** | 180° | Sud |
| **SSW** | 202.5° | Sud-Sud-Ouest |
| **SW** | 225° | Sud-Ouest |
| **WSW** | 247.5° | Ouest-Sud-Ouest |
| **W** | 270° | Ouest |
| **WNW** | 292.5° | Ouest-Nord-Ouest |
| **NW** | 315° | Nord-Ouest |
| **NNW** | 337.5° | Nord-Nord-Ouest |

**Total** : 16 directions cardinales supportées

---

## ⚙️ Paramètres Caméra

Lors du positionnement initial basé sur l'orientation :

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| **Heading** | Selon orientation | 0-360° (direction de vue) |
| **Pitch** | -10° | Légèrement vers le bas |
| **Distance** | 500m | Recul depuis le point de départ |

### Fallback (Sans Orientation)

Si un site n'a **pas** d'orientation définie :
- Vue aérienne globale du parcours de vol
- Caméra positionnée pour voir l'ensemble de la trajectoire
- Comportement par défaut de Cesium `flyToBoundingSphere`

---

## 🎮 Édition de l'Orientation

### Via FlightViewer3D

**Emplacement** : Panneau de contrôle (gauche)

**Workflow** :
1. Ouvrir un vol en 3D
2. Trouver le dropdown "**Orientation Décollage**"
3. Sélectionner une nouvelle direction (ex: N → NE)
4. La caméra se **repositionne automatiquement**
5. Changement **persisté** en base de données

**Avantages** :
- ✅ Preview immédiat de la nouvelle vue
- ✅ Test rapide des différentes orientations
- ✅ Contexte visuel direct

### Via Page Site (TODO)

**Emplacement** : Formulaire d'édition du site

**Workflow** :
1. Éditer un site
2. Dropdown "Orientation Décollage"
3. Sauvegarder
4. Tous les vols de ce site utilisent la nouvelle orientation

**Avantages** :
- ✅ Modification centralisée
- ✅ Impact sur tous les vols du site

---

## 📡 API

### GET /api/flights/{id}

Retourne le vol avec le **site complet** incluant l'orientation.

**Réponse** :
```json
{
  "id": "flight-123",
  "name": "Vol thermique Mont Poupet",
  "site_id": "site-mont-poupet-nord",
  "gpx_file_path": "db/gpx/flight_123.gpx",
  "site": {
    "id": "site-mont-poupet-nord",
    "name": "Mont Poupet Nord",
    "code": "mont-poupet-nord",
    "orientation": "N",
    "latitude": 46.9716,
    "longitude": 5.8776,
    "elevation_m": 850
  }
}
```

### PATCH /api/sites/{site_id}/orientation

Met à jour l'orientation d'un site.

**Requête** :
```bash
PATCH /api/sites/site-mont-poupet-nord/orientation?orientation=NE
```

**Réponse** :
```json
{
  "success": true,
  "site_id": "site-mont-poupet-nord",
  "name": "Mont Poupet Nord",
  "orientation": "NE",
  "message": "Orientation updated to NE"
}
```

**Orientations valides** :
```
N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW
```

**Erreurs** :
- `400` : Orientation invalide
- `404` : Site non trouvé
- `500` : Erreur serveur

---

## 🏗️ Architecture Technique

### Backend (Python/FastAPI)

#### Modèle de Données

**Fichier** : `backend/models.py`

```python
class Site(Base):
    # ... autres champs ...
    orientation = Column(String)  # N, NW, W, S, etc.
```

Pas de changement nécessaire (champ déjà existant).

#### Endpoint GET Flight Modifié

**Fichier** : `backend/routes.py` (ligne ~1286)

```python
@router.get("/flights/{flight_id}")
def get_flight(flight_id: str, db: Session = Depends(get_db)):
    flight = db.query(Flight).filter(Flight.id == flight_id).first()
    # ... 
    
    # Include site details with orientation
    if flight.site_id:
        site = db.query(Site).filter(Site.id == flight.site_id).first()
        if site:
            flight_dict["site"] = {
                "id": site.id,
                "name": site.name,
                "orientation": site.orientation,
                # ... other fields
            }
    
    return flight_dict
```

#### Endpoint PATCH Orientation

**Fichier** : `backend/routes.py` (ligne ~577)

```python
@router.patch("/sites/{site_id}/orientation")
def update_site_orientation(
    site_id: str,
    orientation: str,
    db: Session = Depends(get_db)
):
    # Validate orientation
    VALID_ORIENTATIONS = [
        'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ]
    
    if orientation.upper() not in VALID_ORIENTATIONS:
        raise HTTPException(status_code=400, detail="Invalid orientation")
    
    # Update site
    site.orientation = orientation.upper()
    db.commit()
    
    return {"success": True, "orientation": site.orientation}
```

### Frontend (React/TypeScript)

#### Utilitaires

**Fichier** : `frontend/src/utils/cameraOrientation.ts`

```typescript
export function getHeadingFromOrientation(orientation?: string): number | null {
  const ORIENTATION_TO_HEADING: Record<string, number> = {
    'N': 0, 'NE': 45, 'E': 90, 'SE': 135,
    'S': 180, 'SW': 225, 'W': 270, 'NW': 315,
    // ... + intermediate directions
  }
  
  return ORIENTATION_TO_HEADING[orientation?.toUpperCase()] ?? null
}

export function getOrientationLabel(orientation: string): string {
  // Returns "Nord", "Nord-Est", etc.
}

export function getOrientationOptions(): Array<{ value: string; label: string }> {
  // Returns dropdown options
}
```

#### Hook Flight

**Fichier** : `frontend/src/hooks/useFlight.ts`

```typescript
export interface Site {
  id: string
  name: string
  orientation?: string
  latitude?: number
  longitude?: number
  elevation_m?: number
}

export interface Flight {
  // ... autres champs ...
  site?: Site  // Inclut l'orientation
}
```

#### Positionnement Caméra

**Fichier** : `frontend/src/components/FlightViewer3D.tsx` (ligne ~451)

```typescript
useEffect(() => {
  if (!viewerRef.current || !viewerReady || !gpxData || !allPositionsRef.current.length) {
    return
  }

  const viewer = viewerRef.current
  const firstPosition = allPositionsRef.current[0]
  
  const heading = getHeadingFromOrientation(flight?.site?.orientation)

  if (heading !== null) {
    // Position camera facing orientation
    viewer.camera.setView({
      destination: firstPosition,
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch: Cesium.Math.toRadians(-10),
        roll: 0.0
      }
    })
    
    viewer.camera.moveBackward(500)
  } else {
    // Fallback: aerial view
    viewer.camera.flyToBoundingSphere(/* ... */)
  }
}, [viewerReady, gpxData, flight?.site?.orientation])
```

#### Dropdown Édition

**Fichier** : `frontend/src/components/FlightViewer3D.tsx` (ligne ~1034)

```tsx
{flight?.site && (
  <div className="mb-3">
    <label className="block text-sm font-medium mb-1">
      Orientation Décollage
    </label>
    <select
      value={flight.site.orientation || ''}
      onChange={(e) => updateOrientation(e.target.value)}
      disabled={isUpdatingOrientation}
      className="w-full px-2 py-1 border rounded text-sm bg-white"
    >
      <option value="">Non définie</option>
      {getOrientationOptions().map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <p className="text-xs text-gray-500 mt-1">
      {flight.site.orientation 
        ? `Direction: ${getOrientationLabel(flight.site.orientation)}`
        : 'Direction vers laquelle regarde le pilote'
      }
    </p>
  </div>
)}
```

---

## 📊 Données Actuelles

### Sites avec Orientation

```
Arguel              → NNW
La Côte             → N
Mont Poupet Nord    → N
Mont Poupet NW      → NW
Mont Poupet Ouest   → W
Mont Poupet Sud     → S
```

**Taux de remplissage** : 6/7 sites (~86%)

### Vols Affectés

Tous les vols liés à ces sites bénéficient automatiquement du positionnement optimisé de la caméra.

---

## 🧪 Tests

### Test 1 : Caméra avec Orientation N

1. Charger un vol Mont Poupet Nord
2. Vérifier que la caméra regarde vers le Nord (heading ≈ 0°)
3. Vérifier distance ~500m du point de départ
4. Vérifier pitch légèrement vers le bas

**Résultat attendu** : Vue panoramique vers le nord depuis le décollage

### Test 2 : Changement d'Orientation

1. Ouvrir FlightViewer3D
2. Changer orientation de N → E
3. Vérifier que la caméra pivote vers l'Est
4. Recharger la page → Vérifier que l'orientation E est conservée

**Résultat attendu** : Repositionnement immédiat + persistance

### Test 3 : Site Sans Orientation

1. Créer un vol sans orientation de site
2. Vérifier que la vue aérienne globale est utilisée
3. Pas d'erreur console

**Résultat attendu** : Fallback gracieux

### Test 4 : Toutes les Orientations

Tester séquentiellement les 16 orientations :
- Vérifier que chaque heading correspond au tableau de mapping
- Vérifier que les labels français sont corrects

---

## 🚀 Améliorations Futures

### Court Terme
- [ ] Ajouter dropdown dans page édition Site
- [ ] Créer composant réutilisable `<OrientationSelector>`
- [ ] Ajouter indicateur visuel de l'orientation dans la carte 2D

### Moyen Terme
- [ ] Rose des vents interactive (sélection visuelle)
- [ ] Preview 3D en temps réel lors de l'édition
- [ ] Détection automatique de l'orientation via analyse du terrain

### Long Terme
- [ ] Orientation variable par saison (vent dominant)
- [ ] Multi-orientations par site (ex: Nord + Nord-Ouest)
- [ ] Historique des modifications d'orientation

---

## 📚 Références

- **Code Analyse Vent** : `backend/best_spot.py` (ligne 60-91)
- **Modèle Site** : `backend/models.py` (ligne 33-58)
- **Documentation Cesium Camera** : https://cesium.com/learn/cesiumjs/ref-doc/Camera.html

---

**Statut** : ✅ Implémentation complète, déployée  
**Date** : 2026-03-06  
**Version** : 1.0.0
