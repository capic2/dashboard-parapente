# 🚀 Quick Start - Dashboard Parapente

## Démarrage Rapide

### 1. Lancer le Dev Server
```bash
cd paragliding/dashboard/frontend
npm run dev
```
→ Ouvrir http://localhost:5175

### 2. Tester les 3 Pages
- **Dashboard** : http://localhost:5175/ (météo + stats)
- **Vols** : http://localhost:5175/flights
- **Analyses** : http://localhost:5175/analytics
- **Paramètres** : http://localhost:5175/settings

### 3. Build Production
```bash
npm run build
npm run preview
```

---

## 📁 Structure des Pages

```
frontend/src/pages/
├── Dashboard.tsx          ← Météo + aperçu stats
├── FlightHistory.tsx      ← Liste vols + 3D viewer
├── Analytics.tsx          ← Graphiques et stats
└── Settings.tsx           ← Préférences + export/import
```

---

## 🎯 Fonctionnalités par Page

### FlightHistory (/flights)
- Sélectionner un vol → voir détails + 3D
- Éditer notes → cliquer "✏️ Modifier"
- Supprimer → "🗑️ Supprimer" → confirmer
- Filtrer → via hook `useFlights({ siteId, dateFrom, limit })`

### Analytics (/analytics)
- Stats auto-chargées depuis `/api/flights/stats`
- Graphiques générés avec Recharts
- Lazy loading → performance optimale

### Settings (/settings)
- **Onglet Général** : Changer unités, langue, thème, notifications
- **Onglet Sites** : Marquer sites favoris ⭐
- **Onglet Données** : Export/Import JSON, reset
- Sauvegarde auto → cliquer "💾 Sauvegarder"

---

## 🛠️ Hooks Disponibles

```typescript
// Vols
const { data: flights } = useFlights({ limit: 50 })
const { data: flight } = useFlight(flightId)
const { data: stats } = useFlightStats()
const updateFlight = useUpdateFlight(flightId)
const deleteFlight = useDeleteFlight(flightId)

// Sites
const { data: sites } = useSites()
const { data: site } = useSite(siteId)

// Météo
const { data: weather } = useWeather(spotId)
```

---

## 🎨 Personnalisation

### Modifier les Couleurs
```typescript
// tailwind.config.js (ou inline classes)
bg-purple-600  → bg-blue-600  // Changer couleur principale
text-purple-600 → text-blue-600
```

### Ajouter une Langue
```typescript
// Settings.tsx
<button onClick={() => setSettings({ ...settings, language: 'de' })}>
  🇩🇪 Deutsch
</button>
```

### Nouveau Graphique
```typescript
// Analytics.tsx - Ajouter dans la grid
<MyCustomChart />
```

---

## 📊 API Endpoints Utilisés

```
GET  /api/flights          → Liste vols
GET  /api/flights/:id      → Détail vol
GET  /api/flights/stats    → Statistiques globales
POST /api/flights          → Créer vol
PATCH /api/flights/:id     → Modifier vol
DELETE /api/flights/:id    → Supprimer vol

GET  /api/spots            → Liste sites
GET  /api/spots/:id        → Détail site

GET  /api/weather/:spotId  → Météo spot
```

---

## 🐛 Debugging

### Console Logs
```bash
# Frontend
npm run dev
# Ouvrir DevTools console → voir logs React Query

# Backend (si besoin)
cd ../backend
uvicorn main:app --reload
```

### Erreurs Courantes

**❌ "Site undefined"**
→ Vérifier que l'API `/api/spots` retourne des données

**❌ "Flight stats null"**
→ Vérifier que des vols existent dans la DB

**❌ "Cesium viewer error"**
→ Vérifier que `cesium` est installé : `npm install cesium`

**❌ "Build error: CSS"**
→ Vérifier Tailwind config : `npm install -D tailwindcss@latest`

---

## ✅ Checklist Avant Commit

- [ ] `npm run type-check` → Aucune erreur critique
- [ ] `npm run build` → Build success
- [ ] `npm run dev` → Toutes les pages chargent
- [ ] Navigation fonctionne (cliquer tous les liens Header)
- [ ] Console DevTools → Pas d'erreur rouge

---

## 📚 Documentation Complète

- **PAGES_IMPLEMENTATION.md** → Détails techniques complets
- **COMPLETION_REPORT.md** → Rapport final de livraison
- **QUICK_START.md** → Ce fichier (référence rapide)

---

## 🆘 Support

Si problème :
1. Vérifier console navigateur (F12)
2. Vérifier console terminal (npm run dev)
3. Consulter PAGES_IMPLEMENTATION.md
4. Tester avec `npm run build` pour voir erreurs TypeScript

---

**Dernière mise à jour:** 27 février 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅
