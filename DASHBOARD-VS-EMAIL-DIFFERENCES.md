# Dashboard vs Email: Prévisions Horaires - Différences Expliquées

## 🔴 PROBLÈME IDENTIFIÉ

Les prévisions horaires affichées dans le **dashboard** ne correspondent pas exactement à celles du **rapport email quotidien**.

---

## 📊 Où Vient la Différence?

### 1️⃣ **Pipeline des Données**

#### EMAIL (source de vérité ✅)
```
generate-weather-report-v5.js
  ↓
Fetche Open-Meteo + WeatherAPI
  ↓
Filtre heures 11-18 AVANT calcul
  ↓
Applique logique complète: generateVerdictWithExplanation() + calculateScore()
  ↓
Envoie email avec Para-Index horaire
```

#### DASHBOARD (frontend)
```
useWeather hook (React)
  ↓
Appelle /api/weather/{spotId}?day_index=0 (backend FastAPI)
  ↓
Backend retourne TOUTES les heures 0-23
  ↓
Frontend transforme les données
  ↓
Frontend FILTRE à 11-18 APRÈS réception
  ↓
Applique logique simplifiée: calculateHourlyParaIndex()
  ↓
Affiche dans le dashboard
```

---

## 🎯 Les 2 Calculs Différents

### **EMAIL: Calcul Complet** (Logique du mail)
```javascript
// generate-weather-report-v5.js - ligne ~100-180

function calculateScore(flyableHours) {
  let score = 100;  // Base 100
  
  const avgWind = average(flyableHours.windspeed);
  const maxGust = max(flyableHours.windgust);
  const totalRain = sum(flyableHours.precip);
  const avgLI = average(flyableHours.lifted_index);
  const avgTemp = average(flyableHours.temperature);
  
  // Pénalités précises:
  if (avgWind < 5) score -= 70;      // Vent insuffisant
  if (avgWind < 8) score -= 40;      // Vent faible
  if (avgWind > 20) score -= 50;     // Vent trop fort
  if (avgWind > 15) score -= 30;     // Vent élevé
  if (maxGust > 25) score -= 50;     // Rafales fortes
  if (totalRain > 2) score -= 30;    // Pluie importante
  if (avgLI < -5) score -= 20;       // Thermiques très forts
  
  // Bonus:
  if (avgWind >= 8 && avgWind <= 15) score += 40;  // Vent optimal
  if (avgTemp >= 15 && avgTemp <= 25) score += 20; // Température ok
  
  return Math.max(0, score);  // 0-100
}

// Verdict par heure: ✅ BON / 🟡 MOYEN / 🔴 MAUVAIS
// PUIS convertit en emoji pour affichage
```

### **DASHBOARD: Calcul Simplifié** (Frontend React)
```typescript
// frontend/src/hooks/useWeather.ts - ligne ~230

const calculateHourlyParaIndex = (hour: any): number => {
  const wind = hour.wind_speed || 0;
  const gust = hour.wind_gust || 0;
  const precip = hour.precipitation || 0;
  
  let score = 50;  // Base 50 (plus bas qu'email!)
  
  // Vent (ideal: 10-25 km/h)
  if (wind < 5) score -= 30;
  else if (wind < 10) score -= 10;
  else if (wind >= 10 && wind <= 25) score += 20;  // ← Range différent (10-25 vs 8-15)
  else if (wind > 25) score -= 20;
  
  // Rafales
  if (gust > 35) score -= 20;
  else if (gust > 25) score -= 10;
  
  // Précipitation
  if (precip > 0) score -= 30;
  
  // ⚠️ IGNORE: lifted_index, température, etc.
  
  return Math.max(0, Math.min(100, score));
};

// ⚠️ PUIS convertit en 0-10: Math.round(score / 10)
```

---

## 🔑 Les 3 Principales Différences

| Aspect | EMAIL (v5.js) | DASHBOARD | Impact |
|--------|---------------|-----------|---------|
| **Plage de vent optimal** | 8-15 km/h | 10-25 km/h | ✋ Les heures à 8-9 km/h: EMAIL = BON, DASHBOARD = FAIBLE |
| **Base du score** | 100 | 50 | Sévérité différente |
| **Facteurs considérés** | Vent, rafales, pluie, LI, temp | Vent, rafales, pluie | IGNORE lifted_index + température |
| **Verdict horaire** | Verdict du jour (BON/MOYEN/MAUVAIS) | Verdict par heure | Peut diverger |

---

## 💡 Exemple Concret

**Heure 11h: Vent 9 km/h, Rafales 14 km/h, Pluie 0mm, LI -3, Temp 16°C**

### EMAIL dit:
```
✅ BON — Vent 9 km/h (dans range 8-15)
Score: 100 - 0 (vent ok) - 0 (rafales ok) = 100
Para-Index: 10/10 ✅
```

### DASHBOARD dit:
```
🟡 MOYEN — Vent 9 km/h (en-dessous de 10)
Score: 50 - 10 (wind < 10) + 0 = 40
Para-Index: 4/10 🟡
```

**C'est la même heure, deux verdicts différents!** ⚠️

---

## 🔧 Comment Corriger?

### Option 1: **Unifier les calculs** (RECOMMANDÉ)
- Utiliser la **logique du mail** comme référence (elle est validée ✅)
- Mettre à jour le backend para_index.py pour utiliser les mêmes formules
- Dashboard utiliserait alors les mêmes scores que le mail

### Option 2: **Garder les deux**
- EMAIL: Score complet (v5.js) — source de vérité
- DASHBOARD: Score simplifié pour rapidité d'affichage
- Ajouter une note "Scores simplifiés pour aperçu" au dashboard

### Option 3: **Mettre à jour le mail**
- Utiliser les calculs simplifiés du dashboard partout
- ⚠️ Pas recommandé (le mail est validé depuis des mois)

---

## 📍 Fichiers Impliqués

### EMAIL (Source de vérité):
```
/home/capic/.openclaw/workspace/paragliding/generate-weather-report-v5.js
  └─ calculateScore() ligne ~100
  └─ generateVerdictWithExplanation() ligne ~140
  └─ Filtre 11-18 ligne ~65
```

### DASHBOARD:
```
/home/capic/.openclaw/workspace/paragliding/dashboard/frontend/src/hooks/useWeather.ts
  └─ calculateHourlyParaIndex() ligne ~230
  └─ Filtre 11-18 dans HourlyForecast.tsx ligne ~36
  
/home/capic/.openclaw/workspace/paragliding/dashboard/backend/para_index.py
  └─ calculate_para_index() — utilisé par l'API
```

---

## ✅ Recommandation

**Garder le mail comme source de vérité** et synchroniser le dashboard avec lui.

### Prochaines étapes:
1. ✅ Documenter les différences (FAIT)
2. Mettre à jour `para_index.py` backend pour utiliser logique mail
3. Mettre à jour `calculateHourlyParaIndex` frontend pour correspondre
4. Ajouter un test de comparaison (email vs dashboard)
5. Valider que les deux affichent les mêmes verdicts

---

## 📝 Note Technique

Le mail utilise:
- **Range optimal:** 8-15 km/h (basé sur thermique léger)
- **Base score:** 100 (Tous les éléments doivent aggraver)
- **Tous facteurs:** Wind, gusts, rain, LI, temp

Le dashboard utilise:
- **Range optimal:** 10-25 km/h (basé sur vol général)
- **Base score:** 50 (Plus conservateur)
- **Facteurs réduits:** Wind, gusts, rain seulement

**C'est la cause principale de la divergence.**
