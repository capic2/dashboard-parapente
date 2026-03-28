# 🚀 PLAN D'IMPLÉMENTATION DÉTAILLÉ - Dashboard Parapente

## Roadmap Évolutive 2026

**Date de création :** 20 Mars 2026  
**Type de projet :** Évolutif/Continu  
**Profil développeur :** Expert (autonome)  
**Approche :** Full-stack en parallèle  
**Usage :** Personnel

---

## 📐 ARCHITECTURE ACTUELLE

### Stack Technique

- **Monorepo :** Nx (moderne, performant ✅)
- **Backend :** Python/FastAPI + SQLAlchemy + SQLite
- **Frontend :** React + TypeScript + Vite + TanStack Query
- **Testing :** Playwright E2E + tests unitaires
- **Activité :** 867 commits dernier mois (projet très actif)

### Modules Existants

- ✅ Gestion sites utilisateur (table `sites`)
- ✅ Base de données externe 3,594 spots (table `paragliding_spots`)
- ✅ Recherche géographique (module `spots/`)
- ✅ Prévisions météo multi-sources avec consensus
- ✅ Gestion vols avec GPX
- ✅ Export vidéo Cesium 3D
- ✅ Système emagram avec LLM
- ✅ Hooks React optimisés (TanStack Query)

---

## 🎯 OBJECTIFS PRIORITAIRES

### Phase 1 : FONDATIONS ESSENTIELLES (4-6 semaines)

1. ⭐⭐⭐ **Multi-Atterrissages avec Météo** (15-21h)
2. ⭐⭐⭐ **Données Complètes Sites** (14-20h)
3. ⭐⭐⭐ **Recherche "Où Voler Maintenant"** (6-8h)

### Phase 2 : INTELLIGENCE & ALERTES (3-4 semaines)

4. ⭐⭐⭐ **Alertes Météo Intelligentes** (14-20h)
5. ⭐⭐ **Statistiques & Analytics Personnelles** (18-27h)

### Phase 3 : EXTENSIONS (Continu)

- Carte interactive
- PWA Mobile
- Features additionnelles selon besoins

---

## 📋 PHASE 1 : FONDATIONS ESSENTIELLES

### 1.1 - MULTI-ATTERRISSAGES AVEC MÉTÉO (15-21h)

#### Objectif

Permettre d'associer plusieurs sites d'atterrissage à un décollage et afficher la météo pour chacun.

#### Architecture

**Nouveau Modèle BDD :**

```python
class SiteLandingAssociation(Base):
    __tablename__ = "site_landing_associations"

    id = Column(String, primary_key=True)  # UUID
    takeoff_site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    landing_site_id = Column(String, ForeignKey("sites.id"), nullable=False)

    # Métadonnées
    is_primary = Column(Boolean, default=False)
    distance_km = Column(Float)  # Auto-calculé
    usage_conditions = Column(String)  # "Si vent fort", etc.
    notes = Column(Text)

    # Statistiques
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('takeoff_site_id', 'landing_site_id'),
    )
```

#### Fichiers à Créer/Modifier

| Fichier                                                             | Action      | Description                      |
| ------------------------------------------------------------------- | ----------- | -------------------------------- |
| `apps/backend/db/migrations/006_add_landing_associations.sql`       | 🆕 Créer    | Migration SQL table junction     |
| `apps/backend/models.py`                                            | 🔧 Modifier | Ajouter `SiteLandingAssociation` |
| `apps/backend/schemas.py`                                           | 🔧 Modifier | Schemas Pydantic associations    |
| `apps/backend/routes.py`                                            | 🆕 Ajouter  | 5 nouveaux endpoints CRUD        |
| `apps/backend/routes.py`                                            | 🆕 Ajouter  | Endpoint météo multi-landing     |
| `libs/shared-types/src/index.ts`                                    | 🔧 Modifier | Types TypeScript associations    |
| `apps/frontend/src/hooks/useLandingAssociations.ts`                 | 🆕 Créer    | Hooks React CRUD                 |
| `apps/frontend/src/components/forms/LandingAssociationsManager.tsx` | 🆕 Créer    | UI gestion associations          |
| `apps/frontend/src/components/WeatherMultiLanding.tsx`              | 🆕 Créer    | Affichage météo multi-colonnes   |
| `apps/frontend/src/components/forms/EditSiteModal.tsx`              | 🔧 Modifier | Intégrer section atterrissages   |

#### Endpoints API

```
GET    /api/sites/{site_id}/landings           # Liste associations
POST   /api/sites/{site_id}/landings           # Ajouter association
PATCH  /api/sites/{site_id}/landings/{assoc_id} # Modifier association
DELETE /api/sites/{site_id}/landings/{assoc_id} # Supprimer association
GET    /api/weather/flight/{site_id}/{day_index} # Météo déco + atterros
```

#### Critères de Succès

- ✅ Un site décollage peut avoir N atterrissages
- ✅ 1 atterrissage marqué "principal"
- ✅ Distance auto-calculée via Haversine
- ✅ Météo distincte pour chaque atterrissage
- ✅ UI intuitive (section dans édition site)
- ✅ Affichage 2 colonnes : déco | atterros

#### Temps estimé

- Backend (BDD + API) : 7-10h
- Frontend (Hooks + UI) : 6-9h
- Tests : 2-3h
- **Total : 15-21h**

---

### 1.2 - DONNÉES COMPLÈTES SITES (14-20h)

#### Problèmes Identifiés

**A. Élévations Manquantes**

- Sites concernés : 3,145 sites ParaglidingSpots
- Impact : Impossibilité calcul finesse, distance plané

**B. Orientations Manquantes**

- Sites concernés : 118 sites OpenAIP
- Impact : Impossibilité filtrer par compatibilité vent

**C. Photos/Descriptions**

- Sites concernés : Majorité
- Impact : Utilisateur ne peut pas visualiser le site

#### Solutions

**Solution A : Élévations - Télécharger KMZ**

- Télécharger KMZ depuis ParaglidingSpots
- Parser avec `zipfile` + `xml.etree`
- Enrichir spots par matching GPS
- **Temps : 4-6h**

**Solution B : Orientations - Crowdsourcing**

- Permettre utilisateurs d'ajouter orientations
- Validation communauté (upvotes/downvotes)
- Alternative future : calcul topographique auto
- **Temps : 4-6h**

**Solution C : Photos - Scraping**

- Scraper pages détails ParaglidingSpots
- Playwright pour extraction
- Stocker URLs photos dans JSON
- **Temps : 6-8h**

#### Fichiers à créer

- `apps/backend/spots/kmz_parser.py` : Parser KMZ
- `apps/backend/spots/media_scraper.py` : Scraper photos
- `apps/backend/models.py` : Ajouter champs (photos, description_detail)

#### Temps estimé : 14-20h

---

### 1.3 - RECHERCHE "OÙ VOLER MAINTENANT" (6-8h)

#### Objectif

Un bouton qui trouve instantanément les meilleurs sites volables MAINTENANT.

#### Algorithme Flyability Score

```python
def calculate_flyability_score(site, weather, user_prefs) -> int:
    """Score 0-100 selon :
    - Vent compatible orientation (40 pts max)
    - Vitesse vent acceptable (30 pts max)
    - Pas de pluie (20 pts max)
    - Para index (10 pts max)
    """
```

#### Endpoint API

```python
GET /api/sites/flyable-now?user_lat=47.2&user_lon=6.0&max_distance_km=100&min_score=60
```

#### UI Component

- Bouton flottant rouge géant "🚀 OÙ VOLER MAINTENANT ?"
- Modal avec liste sites scorés
- Carte site avec météo + explication

#### Fichiers à créer

- `apps/backend/flyability.py` : Module calcul scores
- `apps/frontend/src/components/FlyableNowButton.tsx` : Bouton + Modal
- `apps/frontend/src/hooks/useFlyableNow.ts` : Hook React

#### Temps estimé : 6-8h

---

## 📋 PHASE 2 : INTELLIGENCE & ALERTES

### 2.1 - ALERTES MÉTÉO INTELLIGENTES (14-20h)

#### Objectif

Notifications push/email/telegram quand conditions parfaites.

#### Types d'Alertes

1. **Conditions Parfaites** : Para index > 80
2. **Vent Compatible** : Orientation match + vitesse OK
3. **Fenêtre Météo** : Plusieurs jours volables
4. **Changement Conditions** : Amélioration/détérioration
5. **Conditions Spéciales** : Thermiques forts, vol d'onde

#### Architecture

**Modèle BDD :**

```python
class WeatherAlert(Base):
    id = Column(String, primary_key=True)
    user_id = Column(String, default="default_user")
    name = Column(String, nullable=False)
    site_id = Column(String, ForeignKey("sites.id"))

    # Trigger config (JSON)
    trigger_config = Column(JSON, nullable=False)

    # Notification settings
    notification_channels = Column(JSON)  # ["email", "telegram", "push"]
    notify_hours_before = Column(Integer, default=24)

    # State
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime)
    trigger_count = Column(Integer, default=0)
```

**Scheduler (APScheduler) :**

- Vérification toutes les heures
- Évalue chaque alerte active
- Envoie notifications si conditions remplies

#### Intégrations Notifications

**Telegram Bot :**

```python
async def send_telegram_notification(alert, message):
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=message)
```

**Email SMTP :**

```python
async def send_email_notification(alert, message):
    fm = FastMail(mail_config)
    await fm.send_message(message_obj)
```

#### Fichiers à créer

- `apps/backend/models.py` : Modèle `WeatherAlert`
- `apps/backend/alert_scheduler.py` : Scheduler APScheduler
- `apps/backend/notifications/telegram.py` : Intégration Telegram
- `apps/backend/notifications/email.py` : Intégration Email
- `apps/backend/routes.py` : 5 endpoints CRUD alertes
- `apps/frontend/src/components/AlertManager.tsx` : UI gestion

#### Configuration requise (.env)

```bash
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
NOTIFICATION_EMAIL=destination@email.com
```

#### Temps estimé : 14-20h

- Backend (scheduler + intégrations) : 10-14h
- Frontend (UI) : 4-6h

---

### 2.2 - STATISTIQUES & ANALYTICS (18-27h)

#### Objectif

Dashboard stats personnelles + insights sur pratique parapente.

#### Métriques à Tracker

**Modèle BDD :**

```python
class FlightStatistics(Base):
    user_id = Column(String, primary_key=True)

    # Totals
    total_flights = Column(Integer)
    total_hours = Column(Float)
    total_distance_km = Column(Float)
    total_elevation_gain_m = Column(Integer)

    # Averages
    avg_duration_minutes = Column(Float)
    avg_distance_km = Column(Float)

    # Records
    max_altitude_m = Column(Integer)
    max_distance_km = Column(Float)
    longest_flight_id = Column(String)

    # Favorites
    favorite_site_id = Column(String)
    favorite_site_flight_count = Column(Integer)

    # Progression
    first_flight_date = Column(Date)
    last_flight_date = Column(Date)
    flights_last_30_days = Column(Integer)
    flights_this_year = Column(Integer)
```

#### Insights Générés

```python
def generate_insights(stats, db) -> List[str]:
    """
    Exemples :
    - "🔥 Vous volez plus que d'habitude ce mois-ci !"
    - "⭐ Votre spot préféré : Mont Poupet (15 vols)"
    - "💡 Essayez un nouveau site ce mois-ci"
    """
```

#### API Endpoints

```
GET /api/analytics/summary     # Stats + insights
GET /api/analytics/charts      # Données graphiques
```

#### UI Dashboard

- Stats cards (vols totaux, heures, distance, altitude max)
- Graphiques Recharts :
  - Vols par mois (bar chart)
  - Sites favoris (pie chart)
  - Progression distance (line chart)
- Section records avec badges
- Insights personnalisés

#### Fichiers à créer

- `apps/backend/models.py` : Modèles stats
- `apps/backend/analytics.py` : Module calcul
- `apps/backend/routes.py` : Endpoints analytics
- `apps/frontend/src/pages/Analytics.tsx` : Page dashboard
- `apps/frontend/src/components/charts/` : Composants graphiques

#### Dépendances

```bash
# Backend
pip install numpy pandas

# Frontend
npm install recharts
```

#### Temps estimé : 18-27h

- Backend (calculs + caching) : 8-12h
- Frontend (dashboard + charts) : 8-12h
- Tests : 2-3h

---

## 🗺️ ROADMAP GLOBALE

### Sprint 1 (Semaines 1-2) - Multi-Atterrissages

**Objectif :** Système complet atterrissages multiples + météo

**Livrables :**

- ✅ Table junction + API CRUD
- ✅ UI gestion associations
- ✅ Météo multi-colonnes
- ✅ Tests passants

### Sprint 2 (Semaines 3-4) - Données Complètes

**Objectif :** Enrichir base données sites

**Livrables :**

- ✅ Élévations KMZ ParaglidingSpots
- ✅ Orientations (crowdsourcing MVP)
- ✅ Photos/descriptions (scraping basique)

### Sprint 3 (Semaines 5-6) - Recherche Intelligente

**Objectif :** "Où voler maintenant"

**Livrables :**

- ✅ Algorithme flyability score
- ✅ Endpoint API optimisé
- ✅ Bouton flottant UI
- ✅ Modale résultats

### Sprint 4 (Semaines 7-10) - Alertes

**Objectif :** Notifications météo proactives

**Livrables :**

- ✅ Système alertes complet
- ✅ Scheduler APScheduler
- ✅ Intégrations (email + telegram)
- ✅ UI gestion alertes

### Sprint 5 (Semaines 11-14) - Analytics

**Objectif :** Dashboard statistiques

**Livrables :**

- ✅ Calcul stats automatique
- ✅ Insights personnalisés
- ✅ Graphiques Recharts
- ✅ Page Analytics complète

---

## ✅ CHECKLIST GLOBALE

### Phase 1 - Fondations Essentielles

**Multi-Atterrissages (15-21h) :**

- [ ] Migration SQL table junction
- [ ] Modèle SQLAlchemy `SiteLandingAssociation`
- [ ] 5 endpoints API CRUD
- [ ] Endpoint météo multi-landing
- [ ] Hooks React associations
- [ ] Composant `LandingAssociationsManager`
- [ ] Composant `WeatherMultiLanding`
- [ ] Intégration `EditSiteModal`
- [ ] Tests backend (6 tests)
- [ ] Tests frontend (3 tests)

**Données Complètes (14-20h) :**

- [ ] Module `kmz_parser.py`
- [ ] Endpoint enrichissement élévations
- [ ] Module orientations (crowdsourcing)
- [ ] Module `media_scraper.py`
- [ ] Endpoint scraping photos
- [ ] Champs BDD (photos, description_detail, access_info)
- [ ] Tests parsing KMZ

**Recherche "Où Voler" (6-8h) :**

- [ ] Module `flyability.py` calcul scores
- [ ] Endpoint `GET /sites/flyable-now`
- [ ] Composant `FlyableNowButton`
- [ ] Composant `FlyableSiteCard`
- [ ] Hook `useFlyableNow`
- [ ] Tests algorithme scores
- [ ] Tests endpoint API

### Phase 2 - Intelligence & Alertes

**Alertes (14-20h) :**

- [ ] Modèle `WeatherAlert`
- [ ] Module `alert_scheduler.py`
- [ ] Fonction `evaluate_alert`
- [ ] Intégration Telegram
- [ ] Intégration Email
- [ ] 5 endpoints CRUD alertes
- [ ] Composant `AlertManager`
- [ ] Composant `CreateAlertModal`
- [ ] Hook `useAlerts`
- [ ] Configuration `.env`
- [ ] Tests évaluation alertes
- [ ] Tests notifications

**Analytics (18-27h) :**

- [ ] Modèles `FlightStatistics`, `UserActivityLog`
- [ ] Module `analytics.py`
- [ ] Fonction `calculate_user_statistics`
- [ ] Fonction `generate_insights`
- [ ] Endpoints analytics
- [ ] Page `Analytics.tsx`
- [ ] Composants graphiques (Recharts)
- [ ] Installation dépendances
- [ ] Tests calculs stats
- [ ] Tests génération insights

---

## 🛠️ OUTILS & DÉPENDANCES

### Backend Python (requirements.txt)

```txt
# Alertes & Scheduling
apscheduler==3.10.4
python-telegram-bot==20.7
fastapi-mail==1.4.1

# Analytics
numpy==1.26.0
pandas==2.1.0

# Scraping
playwright==1.40.0

# Parsing géographique (optionnel)
rasterio==1.3.9
pyproj==3.6.1
```

### Frontend TypeScript (package.json)

```bash
# Graphiques
npm install recharts

# Cartes (Phase 3)
npm install react-leaflet leaflet
npm install @types/leaflet -D
```

### Configuration Services (.env)

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=votre_token
TELEGRAM_CHAT_ID=votre_chat_id

# Email SMTP
MAIL_USERNAME=votre_email@gmail.com
MAIL_PASSWORD=votre_app_password
MAIL_FROM=Dashboard Parapente <noreply@parapente.app>
NOTIFICATION_EMAIL=destination@email.com

# OpenTopography (optionnel)
OPENTOPOGRAPHY_API_KEY=votre_clé
```

---

## 📏 MÉTRIQUES DE SUCCÈS

### Phase 1

- ✅ Un site peut avoir 3+ atterrissages configurés
- ✅ Météo distincte affichée pour chaque atterrissage
- ✅ 90%+ des sites PGS ont élévation
- ✅ Recherche "Où voler" retourne résultats < 2s
- ✅ Bouton flottant visible et fonctionnel

### Phase 2

- ✅ Alertes déclenchées avec < 5min de latence
- ✅ Notifications reçues via 2+ canaux
- ✅ Dashboard analytics charge < 1s
- ✅ Insights personnalisés générés
- ✅ Graphiques interactifs fonctionnels

---

## 🚨 RISQUES & MITIGATION

### Risques Techniques

**R1 : Performance scraping photos (lent)**

- Mitigation : Background tasks + queue (Celery/RQ)
- Alternative : Scraper progressif (X sites/jour)

**R2 : Rate limiting APIs externes**

- Mitigation : Cache agressif + backoff exponentiel
- Monitoring : Logs taux erreurs

**R3 : APScheduler conflicts (multi-instances)**

- Mitigation : Redis lock OU deployment single instance
- Alternative : Cron jobs système

**R4 : Base SQLite limite (concurrence)**

- Mitigation : OK pour usage personnel
- Plan B : Migration PostgreSQL (Phase 3+)

### Risques Fonctionnels

**R5 : Données météo manquantes/erreurs**

- Mitigation : Fallbacks multiples sources
- Graceful degradation : Afficher "N/A" proprement

**R6 : Faux positifs alertes**

- Mitigation : Cooldown period (pas 2x en 6h)
- Config : Seuils ajustables par user

---

## 📖 DOCUMENTATION

### À Maintenir Pendant Développement

- `CHANGELOG.md` - Mise à jour continue
- `docs/API.md` - Nouveaux endpoints
- Docstrings Python (Google style)
- Comments TypeScript (JSDoc)

### À Créer Post-Implémentation

- `docs/ALERTES.md` - Guide configuration alertes
- `docs/ANALYTICS.md` - Explication métriques
- `docs/MULTI_LANDING.md` - Guide associations
- `USER_GUIDE.md` - Section nouvelles features

---

## 🎯 DÉMARRAGE IMMÉDIAT

### Setup Environnement (1-2h)

```bash
# Créer branche feature
git checkout -b feature/multi-landing-and-improvements

# Installer nouvelles dépendances Backend
cd apps/backend
pip install apscheduler python-telegram-bot fastapi-mail numpy pandas

# Installer nouvelles dépendances Frontend
cd ../frontend
npm install recharts
```

### Commencer Sprint 1 - Multi-Atterrissages

1. Migration SQL (fondation)
2. Modèles SQLAlchemy
3. Endpoints API
4. Frontend hooks + UI
5. Tests au fur et à mesure
6. Commits atomiques

---

## 📅 TIMELINE ESTIMÉE

### Phase 1 : Fondations (4-6 semaines)

- Sprint 1 : Multi-Atterrissages (15-21h)
- Sprint 2 : Données Complètes (14-20h)
- Sprint 3 : Recherche Intelligente (6-8h)
- **Total Phase 1 : 35-49h**

### Phase 2 : Intelligence (3-4 semaines)

- Sprint 4 : Alertes Météo (14-20h)
- Sprint 5 : Analytics (18-27h)
- **Total Phase 2 : 32-47h**

### Phase 3 : Extensions (Continu)

- Carte interactive (12-18h)
- PWA Mobile (8-12h)
- Autres features selon besoins

---

## 🎉 RÉSUMÉ EXÉCUTIF

Ce plan implémente les 5 fonctionnalités prioritaires identifiées :

1. ✅ **Multi-Atterrissages** : Gestion N atterrissages par déco + météo distincte
2. ✅ **Données Complètes** : Élévations, orientations, photos enrichies
3. ✅ **Recherche Intelligente** : Bouton "Où voler maintenant" avec scoring
4. ✅ **Alertes Proactives** : Notifications Telegram/Email conditions parfaites
5. ✅ **Analytics Dashboard** : Stats personnelles + insights + graphiques

**Temps total estimé :** 67-96 heures (8-12 semaines en mode continu/évolutif)

**Next Steps :**

1. Valider le plan
2. Setup environnement
3. Démarrer Sprint 1 - Multi-Atterrissages

---

**Document créé le :** 20 Mars 2026  
**Dernière mise à jour :** 20 Mars 2026  
**Statut :** 🟢 Prêt à démarrer
