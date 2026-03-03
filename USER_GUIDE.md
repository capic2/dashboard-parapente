# 📖 User Guide / Guide Utilisateur

> **Complete guide to using the Paragliding Weather Dashboard**  
> **Guide complet d'utilisation du Dashboard Météo Parapente**

---

## 🇬🇧 English Version

### Dashboard Overview

The Paragliding Weather Dashboard provides real-time and forecasted flying conditions for your favorite paragliding sites. It combines data from **8 weather sources** to give you the most accurate predictions.

#### Key Features

- **🎯 Para-Index Score (0-100)**: Composite score indicating overall flyability
- **🌤️ Multi-Source Weather**: Data from Open-Meteo, WeatherAPI, Meteoblue, and more
- **📊 7-Day Forecast**: Hourly conditions for the week ahead
- **📍 Multi-Site Support**: Track multiple takeoff locations
- **✈️ Flight History**: Sync and analyze your flights from Strava
- **🔔 Smart Alerts**: Get notified when conditions are perfect

### Understanding Para-Index

The **Para-Index** is a 0-100 score that indicates how good conditions are for flying:

| Score | Verdict | Meaning |
|-------|---------|---------|
| **80-100** | 🟢 **EXCELLENT** | Perfect conditions, go fly! |
| **60-79** | 🟡 **GOOD** | Good conditions with minor issues |
| **40-59** | 🟠 **MARGINAL** | Flyable but challenging |
| **20-39** | 🔴 **POOR** | Not recommended |
| **0-19** | ⛔ **DANGEROUS** | Do not fly |

#### Para-Index Factors

The score considers:
- ✅ **Wind Speed** (ideal: 5-20 km/h)
- ✅ **Wind Direction** (matching site orientation)
- ✅ **Temperature** (flyable range)
- ✅ **Precipitation** (rain kills thermals)
- ✅ **Cloud Cover** (affects visibility and thermals)

### Using the Dashboard

#### 1. Site Selector

At the top of the dashboard, you'll see buttons for each flying site:

- **Single sites** (e.g., Arguel) → Click to select
- **Multi-orientation sites** (e.g., Mont Poupet) → Dropdown with N/S/W/E options

**Features:**
- Shows altitude for each site
- Displays current wind direction indicator
- Hover to prefetch weather data (instant switching)

#### 2. Current Conditions Widget

Displays real-time conditions for the selected site:

- **Para-Index** with color-coded verdict
- **Temperature** (current)
- **Wind Speed & Direction** with arrow indicator
- **Wind Gusts** (max speed)
- **Conditions Summary** (e.g., "Partly cloudy")
- **Last Updated** timestamp

**Wind Direction Arrows:**
- 🟢 Green arrow = Wind favorable for this takeoff
- 🟠 Orange arrow = Wind partially favorable
- 🔴 Red arrow = Wind unfavorable

#### 3. Hourly Forecast

Shows detailed hour-by-hour predictions:

- **Time** (24h format)
- **Temperature** graph
- **Wind Speed** with gusts
- **Wind Direction** arrow
- **Precipitation** (mm/h)
- **Para-Index** for each hour
- **Source tooltips** (hover to see which weather services agree)

**Tip:** Hover over any data point to see individual source values!

#### 4. 7-Day Forecast

Weekly overview with:
- Daily Para-Index range
- Temperature min/max
- Average wind speed
- Precipitation probability
- Conditions summary

Click any day to see hourly details.

#### 5. Best Spot Recommendation

If multiple sites are configured, the dashboard suggests the **best flying site today** based on:
- Current Para-Index scores
- Wind direction matching site orientation
- Weather trends

**Displayed info:**
- Recommended site name
- Para-Index score
- Current wind conditions
- Why it's the best choice

#### 6. Stats Panel

Quick statistics:
- **Total Flights** logged
- **Total Flight Time** (hours)
- **Favorite Site** (most flights)
- **Last Flight Date**

### Multi-Site Selection: How It Works

For sites with **multiple takeoffs** (different orientations):

**Example: Mont Poupet**
- **Nord (N)** - Best for south winds
- **Sud (S)** - Best for north winds
- **Ouest (W)** - Best for east winds

The system:
1. Groups sites by base name automatically
2. Shows dropdown with all orientations
3. Displays wind favorability for each option
4. Calculates adjusted Para-Index based on wind direction match

**Wind Matching Logic:**
- ✅ **Perfect match** (±30°): Full Para-Index
- 🟡 **Partial match** (±60°): Reduced score
- 🔴 **Opposite wind** (>90°): Heavily penalized

### Flight History

Track your flying progress:

#### Features
- **Flight log** with date, duration, altitude, distance
- **Statistics** (total flights, hours, distance)
- **Site breakdown** (where you fly most)
- **Altitude chart** (visualize your progress)
- **Strava sync** (import flights automatically)

#### Adding Flights Manually

1. Go to **Flight History** page
2. Click **"Add Flight"**
3. Fill in:
   - Date & time
   - Duration
   - Max altitude
   - Distance
   - Notes
4. Save

### Alerts (Coming Soon)

Set up notifications for perfect conditions:

- **Condition triggers**: Wind speed, direction, Para-Index threshold
- **Notification methods**: Email, Telegram, SMS
- **Time windows**: Only alert during flyable hours
- **Multi-site**: Monitor all your spots

### Tips for Best Results

#### ✅ Do's
- Check **multiple sources** via tooltips
- Review **hourly forecast** for timing your flight
- Consider **wind trends** (is it increasing or decreasing?)
- Check **7-day forecast** to plan your week
- Compare **multiple sites** to find best conditions

#### ❌ Don'ts
- Don't fly based on Para-Index alone (use your judgment!)
- Don't ignore local knowledge and current observations
- Don't fly in conditions outside your skill level
- Don't rely solely on automated forecasts (weather changes!)

### Data Sources

The dashboard aggregates data from:

1. **Open-Meteo** - Open-source weather API
2. **WeatherAPI** - Global weather data
3. **Meteoblue** - High-resolution European forecasts
4. **Météo-parapente** - Paragliding-specific forecasts
5. **Météociel** - French regional data
6. **Windy** - Wind visualization
7. **Paragliding.net** - Community forecasts
8. **Planète-voile** - Local conditions

**Consensus Algorithm:**
- Calculates median values across all sources
- Weighs sources by historical accuracy
- Flags outliers and low-confidence predictions

### Mobile Experience

The dashboard is fully responsive:

- **📱 Phone**: Compact layout, swipe navigation
- **📱 Tablet**: Optimized grid layout
- **💻 Desktop**: Full feature access

### Keyboard Shortcuts

- `1-9` - Quick switch between sites
- `r` - Refresh current data
- `f` - Toggle forecast view
- `h` - Toggle hourly/daily forecast
- `?` - Show help

---

## 🇫🇷 Version Française

### Vue d'Ensemble du Dashboard

Le Dashboard Météo Parapente fournit les conditions de vol en temps réel et prévues pour vos sites de parapente favoris. Il combine les données de **8 sources météo** pour vous donner les prédictions les plus précises.

#### Fonctionnalités Clés

- **🎯 Score Para-Index (0-100)** : Score composite indiquant la volabilité globale
- **🌤️ Météo Multi-Sources** : Données d'Open-Meteo, WeatherAPI, Meteoblue, etc.
- **📊 Prévisions 7 Jours** : Conditions horaires pour la semaine à venir
- **📍 Support Multi-Sites** : Suivez plusieurs sites de décollage
- **✈️ Historique de Vols** : Synchronisez et analysez vos vols depuis Strava
- **🔔 Alertes Intelligentes** : Soyez notifié quand les conditions sont parfaites

### Comprendre le Para-Index

Le **Para-Index** est un score de 0 à 100 qui indique la qualité des conditions de vol :

| Score | Verdict | Signification |
|-------|---------|---------------|
| **80-100** | 🟢 **EXCELLENT** | Conditions parfaites, allez voler ! |
| **60-79** | 🟡 **BON** | Bonnes conditions avec problèmes mineurs |
| **40-59** | 🟠 **LIMITE** | Volable mais challengeant |
| **20-39** | 🔴 **MAUVAIS** | Non recommandé |
| **0-19** | ⛔ **DANGEREUX** | Ne volez pas |

#### Facteurs du Para-Index

Le score considère :
- ✅ **Vitesse du vent** (idéal : 5-20 km/h)
- ✅ **Direction du vent** (correspondant à l'orientation du site)
- ✅ **Température** (plage volable)
- ✅ **Précipitations** (la pluie tue les thermiques)
- ✅ **Couverture nuageuse** (affecte visibilité et thermiques)

### Utiliser le Dashboard

#### 1. Sélecteur de Site

En haut du dashboard, vous verrez des boutons pour chaque site de vol :

- **Sites uniques** (ex: Arguel) → Cliquez pour sélectionner
- **Sites multi-orientation** (ex: Mont Poupet) → Menu déroulant avec options N/S/O/E

**Fonctionnalités :**
- Affiche l'altitude de chaque site
- Affiche l'indicateur de direction du vent actuel
- Survol pour précharger les données météo (changement instantané)

#### 2. Widget Conditions Actuelles

Affiche les conditions en temps réel pour le site sélectionné :

- **Para-Index** avec verdict en couleur
- **Température** (actuelle)
- **Vitesse & Direction du vent** avec flèche indicatrice
- **Rafales** (vitesse max)
- **Résumé des Conditions** (ex: "Partiellement nuageux")
- **Dernière mise à jour**

**Flèches de Direction du Vent :**
- 🟢 Flèche verte = Vent favorable pour ce décollage
- 🟠 Flèche orange = Vent partiellement favorable
- 🔴 Flèche rouge = Vent défavorable

#### 3. Prévisions Horaires

Affiche les prédictions détaillées heure par heure :

- **Heure** (format 24h)
- **Température** en graphique
- **Vitesse du vent** avec rafales
- **Direction du vent** (flèche)
- **Précipitations** (mm/h)
- **Para-Index** pour chaque heure
- **Infobulles sources** (survolez pour voir quels services météo sont d'accord)

**Astuce :** Survolez n'importe quel point de données pour voir les valeurs de chaque source !

#### 4. Prévisions 7 Jours

Vue d'ensemble hebdomadaire avec :
- Plage de Para-Index journalier
- Température min/max
- Vitesse moyenne du vent
- Probabilité de précipitations
- Résumé des conditions

Cliquez sur n'importe quel jour pour voir les détails horaires.

#### 5. Recommandation du Meilleur Site

Si plusieurs sites sont configurés, le dashboard suggère le **meilleur site de vol aujourd'hui** basé sur :
- Scores Para-Index actuels
- Correspondance direction du vent avec orientation du site
- Tendances météo

**Informations affichées :**
- Nom du site recommandé
- Score Para-Index
- Conditions de vent actuelles
- Pourquoi c'est le meilleur choix

#### 6. Panneau de Statistiques

Statistiques rapides :
- **Total de Vols** enregistrés
- **Temps de Vol Total** (heures)
- **Site Favori** (le plus de vols)
- **Date du Dernier Vol**

### Sélection Multi-Sites : Comment Ça Marche

Pour les sites avec **plusieurs décollages** (orientations différentes) :

**Exemple : Mont Poupet**
- **Nord (N)** - Meilleur pour vents du sud
- **Sud (S)** - Meilleur pour vents du nord
- **Ouest (O)** - Meilleur pour vents d'est

Le système :
1. Groupe les sites par nom de base automatiquement
2. Affiche un menu déroulant avec toutes les orientations
3. Affiche la favorabilité du vent pour chaque option
4. Calcule un Para-Index ajusté basé sur la correspondance de direction du vent

**Logique de Correspondance du Vent :**
- ✅ **Correspondance parfaite** (±30°) : Para-Index complet
- 🟡 **Correspondance partielle** (±60°) : Score réduit
- 🔴 **Vent opposé** (>90°) : Fortement pénalisé

### Historique de Vols

Suivez votre progression en vol :

#### Fonctionnalités
- **Journal de vols** avec date, durée, altitude, distance
- **Statistiques** (total vols, heures, distance)
- **Répartition par site** (où vous volez le plus)
- **Graphique d'altitude** (visualisez votre progression)
- **Synchronisation Strava** (importez vos vols automatiquement)

#### Ajouter des Vols Manuellement

1. Allez sur la page **Historique de Vols**
2. Cliquez sur **"Ajouter un Vol"**
3. Remplissez :
   - Date & heure
   - Durée
   - Altitude max
   - Distance
   - Notes
4. Enregistrez

### Alertes (Bientôt Disponible)

Configurez des notifications pour les conditions parfaites :

- **Déclencheurs de conditions** : Vitesse du vent, direction, seuil Para-Index
- **Méthodes de notification** : Email, Telegram, SMS
- **Fenêtres horaires** : Alerte uniquement pendant les heures volables
- **Multi-sites** : Surveillez tous vos spots

### Conseils pour de Meilleurs Résultats

#### ✅ À Faire
- Vérifiez **plusieurs sources** via les infobulles
- Consultez les **prévisions horaires** pour planifier votre vol
- Considérez les **tendances du vent** (augmente-t-il ou diminue-t-il ?)
- Vérifiez les **prévisions 7 jours** pour planifier votre semaine
- Comparez **plusieurs sites** pour trouver les meilleures conditions

#### ❌ À Ne Pas Faire
- Ne volez pas basé uniquement sur le Para-Index (utilisez votre jugement !)
- N'ignorez pas les connaissances locales et observations actuelles
- Ne volez pas dans des conditions hors de votre niveau de compétence
- Ne comptez pas uniquement sur les prévisions automatisées (la météo change !)

### Sources de Données

Le dashboard agrège les données de :

1. **Open-Meteo** - API météo open-source
2. **WeatherAPI** - Données météo globales
3. **Meteoblue** - Prévisions européennes haute résolution
4. **Météo-parapente** - Prévisions spécifiques parapente
5. **Météociel** - Données régionales françaises
6. **Windy** - Visualisation du vent
7. **Paragliding.net** - Prévisions communautaires
8. **Planète-voile** - Conditions locales

**Algorithme de Consensus :**
- Calcule les valeurs médianes entre toutes les sources
- Pondère les sources selon leur précision historique
- Signale les valeurs aberrantes et prédictions peu fiables

### Expérience Mobile

Le dashboard est entièrement responsive :

- **📱 Téléphone** : Layout compact, navigation par balayage
- **📱 Tablette** : Layout en grille optimisé
- **💻 Bureau** : Accès complet aux fonctionnalités

### Raccourcis Clavier

- `1-9` - Changement rapide entre sites
- `r` - Actualiser les données actuelles
- `f` - Basculer vue prévisions
- `h` - Basculer prévisions horaires/journalières
- `?` - Afficher l'aide

---

**Safe flights! / Bons vols ! 🪂**
