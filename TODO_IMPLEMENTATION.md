# 📋 TODO - Implémentation Plan 2026

> **Référence :** Voir `docs/IMPLEMENTATION_PLAN_2026.md` pour détails complets

---

## 🎯 PHASE 1 : FONDATIONS ESSENTIELLES (4-6 semaines)

### Sprint 1 : Multi-Atterrissages avec Météo (15-21h)

**Statut :** 🔴 À faire  
**Priorité :** ⭐⭐⭐ Haute

#### Backend

- [ ] Migration SQL : `apps/backend/db/migrations/006_add_landing_associations.sql`
- [ ] Modèle `SiteLandingAssociation` dans `models.py`
- [ ] Schemas Pydantic dans `schemas.py`
- [ ] Endpoint `GET /api/sites/{site_id}/landings`
- [ ] Endpoint `POST /api/sites/{site_id}/landings`
- [ ] Endpoint `PATCH /api/sites/{site_id}/landings/{assoc_id}`
- [ ] Endpoint `DELETE /api/sites/{site_id}/landings/{assoc_id}`
- [ ] Endpoint `GET /api/weather/flight/{site_id}/{day_index}`
- [ ] Tests backend (6 tests minimum)

#### Frontend

- [ ] Types TypeScript dans `libs/shared-types/src/index.ts`
- [ ] Hook `useLandingAssociations` dans `hooks/useLandingAssociations.ts`
- [ ] Hook `useAddLandingAssociation`
- [ ] Hook `useUpdateLandingAssociation`
- [ ] Hook `useRemoveLandingAssociation`
- [ ] Hook `useFlightWeatherMulti`
- [ ] Composant `LandingAssociationsManager.tsx`
- [ ] Composant `WeatherMultiLanding.tsx`
- [ ] Intégration dans `EditSiteModal.tsx`
- [ ] Tests frontend (3 tests minimum)

**Critères de succès :**

- ✅ Un site peut avoir 3+ atterrissages
- ✅ Distance auto-calculée
- ✅ Météo affichée en 2 colonnes
- ✅ Tests passent à 100%

---

### Sprint 2 : Données Complètes Sites (14-20h)

**Statut :** 🔴 À faire  
**Priorité :** ⭐⭐⭐ Haute

#### A. Élévations (4-6h)

- [ ] Module `apps/backend/spots/kmz_parser.py`
- [ ] Fonction `download_pgs_kmz()`
- [ ] Fonction `parse_kmz()`
- [ ] Fonction `enrich_spots_with_elevations()`
- [ ] Endpoint `POST /api/admin/spots/enrich-elevations`
- [ ] Tests parsing KMZ

#### B. Orientations (4-6h)

- [ ] Modèle `UserOrientationContribution` dans `models.py`
- [ ] Endpoint `POST /api/spots/{spot_id}/orientation-contribution`
- [ ] Endpoint `GET /api/spots/{spot_id}/orientation-contributions`
- [ ] UI contribution orientations
- [ ] Vote system (upvote/downvote)

#### C. Photos & Descriptions (6-8h)

- [ ] Module `apps/backend/spots/media_scraper.py`
- [ ] Fonction `scrape_pgs_site_details()`
- [ ] Champs BDD : `photos`, `description_detail`, `access_info`
- [ ] Endpoint `POST /api/admin/spots/{spot_id}/scrape-details`
- [ ] UI affichage photos carousel
- [ ] Background task scraping batch

**Critères de succès :**

- ✅ 90%+ sites PGS ont élévation
- ✅ Système contribution orientations fonctionnel
- ✅ Photos affichées pour sites principaux

---

### Sprint 3 : Recherche "Où Voler Maintenant" (6-8h)

**Statut :** 🔴 À faire  
**Priorité :** ⭐⭐⭐ Haute

#### Backend

- [ ] Module `apps/backend/flyability.py`
- [ ] Fonction `calculate_flyability_score()`
- [ ] Fonction `is_wind_compatible()`
- [ ] Fonction `get_current_weather()`
- [ ] Endpoint `GET /api/sites/flyable-now`
- [ ] Tests calcul scores (5 tests)

#### Frontend

- [ ] Composant `FlyableNowButton.tsx` (bouton flottant)
- [ ] Composant `FlyableSiteCard.tsx`
- [ ] Hook `useFlyableNow` dans `hooks/useFlyableNow.ts`
- [ ] Modal résultats avec liste
- [ ] Géolocalisation navigateur

**Critères de succès :**

- ✅ Bouton visible en permanence
- ✅ Résultats < 2 secondes
- ✅ Score pertinent (tests manuels)
- ✅ Explication claire par site

---

## 🎯 PHASE 2 : INTELLIGENCE & ALERTES (3-4 semaines)

### Sprint 4 : Alertes Météo Intelligentes (14-20h)

**Statut :** 🔴 À faire  
**Priorité :** ⭐⭐⭐ Haute

#### Backend

- [ ] Modèle `WeatherAlert` dans `models.py`
- [ ] Module `apps/backend/alert_scheduler.py`
- [ ] Fonction `check_weather_alerts()` (scheduler)
- [ ] Fonction `evaluate_alert()`
- [ ] Fonction `send_notifications()`
- [ ] Module `notifications/telegram.py`
- [ ] Module `notifications/email.py`
- [ ] Endpoint `GET /api/alerts`
- [ ] Endpoint `POST /api/alerts`
- [ ] Endpoint `PATCH /api/alerts/{alert_id}`
- [ ] Endpoint `DELETE /api/alerts/{alert_id}`
- [ ] Endpoint `POST /api/alerts/{alert_id}/test`
- [ ] Tests évaluation alertes

#### Frontend

- [ ] Composant `AlertManager.tsx`
- [ ] Composant `CreateAlertModal.tsx`
- [ ] Composant `AlertCard.tsx`
- [ ] Hook `useAlerts` dans `hooks/useAlerts.ts`
- [ ] Hook `useCreateAlert`
- [ ] Hook `useUpdateAlert`
- [ ] Hook `useDeleteAlert`

#### Configuration

- [ ] Variables `.env` (TELEGRAM_BOT_TOKEN, etc.)
- [ ] Création bot Telegram
- [ ] Configuration SMTP email
- [ ] Documentation setup alertes

**Critères de succès :**

- ✅ Alertes vérifiées toutes les heures
- ✅ Notifications Telegram fonctionnelles
- ✅ Notifications Email fonctionnelles
- ✅ Pas de faux positifs (cooldown)
- ✅ UI intuitive configuration

---

### Sprint 5 : Analytics & Statistiques (18-27h)

**Statut :** 🔴 À faire  
**Priorité :** ⭐⭐ Moyenne-Haute

#### Backend

- [ ] Modèle `FlightStatistics` dans `models.py`
- [ ] Modèle `UserActivityLog` dans `models.py`
- [ ] Module `apps/backend/analytics.py`
- [ ] Fonction `calculate_user_statistics()`
- [ ] Fonction `generate_insights()`
- [ ] Endpoint `GET /api/analytics/summary`
- [ ] Endpoint `GET /api/analytics/charts`
- [ ] Cache statistiques (refresh quotidien)
- [ ] Tests calculs stats

#### Frontend

- [ ] Page `Analytics.tsx`
- [ ] Composant `StatCard.tsx`
- [ ] Composant `ChartCard.tsx`
- [ ] Composant `RecordCard.tsx`
- [ ] Composants graphiques (Recharts) :
  - [ ] `FlightsBarChart.tsx` (vols par mois)
  - [ ] `SitesPieChart.tsx` (sites favoris)
  - [ ] `DistanceLineChart.tsx` (progression)
- [ ] Hook `useAnalyticsSummary`
- [ ] Hook `useAnalyticsCharts`

#### Dépendances

- [ ] Backend : `pip install numpy pandas`
- [ ] Frontend : `npm install recharts`

**Critères de succès :**

- ✅ Dashboard charge < 1 seconde
- ✅ Insights pertinents générés
- ✅ Graphiques interactifs
- ✅ Données temps réel
- ✅ Design responsive

---

## 🛠️ SETUP INITIAL (1-2h)

### Environnement

- [ ] Créer branche `feature/multi-landing-and-improvements`
- [ ] Installer dépendances backend :
  ```bash
  cd apps/backend
  pip install apscheduler python-telegram-bot fastapi-mail numpy pandas
  ```
- [ ] Installer dépendances frontend :
  ```bash
  cd apps/frontend
  npm install recharts
  ```

### Configuration

- [ ] Créer `.env.example` avec variables requises
- [ ] Documenter configuration Telegram Bot
- [ ] Documenter configuration Email SMTP
- [ ] Créer script setup automatique

---

## 📊 MÉTRIQUES & VALIDATION

### Phase 1

- [ ] Tests unitaires : 90%+ coverage
- [ ] Tests E2E : Scénarios principaux
- [ ] Performance : Recherche < 2s
- [ ] UI : Responsive mobile/desktop

### Phase 2

- [ ] Alertes : Latence < 5min
- [ ] Analytics : Charge < 1s
- [ ] Notifications : 99% delivery
- [ ] Insights : Pertinence validée

---

## 📝 DOCUMENTATION

### Pendant Développement

- [ ] Mise à jour `CHANGELOG.md` par sprint
- [ ] Documentation API (`docs/API.md`)
- [ ] Docstrings Python (Google style)
- [ ] Comments TypeScript (JSDoc)

### Post-Implémentation

- [ ] `docs/ALERTES.md` : Guide configuration
- [ ] `docs/ANALYTICS.md` : Explication métriques
- [ ] `docs/MULTI_LANDING.md` : Guide associations
- [ ] `USER_GUIDE.md` : Mise à jour features

---

## 🎉 PROCHAINES ÉTAPES

1. **Valider le plan** ✅ (fait)
2. **Setup environnement** (1-2h)
3. **Sprint 1 - Multi-Atterrissages** (2 semaines)
4. **Review & ajustements**
5. **Sprint 2 - Données Complètes** (2 semaines)

---

**Créé le :** 20 Mars 2026  
**Dernière mise à jour :** 20 Mars 2026  
**Statut global :** 🔴 Pas démarré (0/5 sprints)

---

## 🚀 COMMANDES RAPIDES

### Démarrer Sprint 1

```bash
git checkout -b feature/sprint-1-multi-landing
cd apps/backend
# Créer migration
touch db/migrations/006_add_landing_associations.sql
```

### Tester localement

```bash
# Backend
cd apps/backend
pytest tests/test_landing_associations.py -v

# Frontend
cd apps/frontend
npm test -- LandingAssociations
```

### Commit pattern

```bash
git commit -m "feat(landing): Add SiteLandingAssociation model"
git commit -m "feat(landing): Add CRUD endpoints for associations"
git commit -m "feat(landing): Add LandingAssociationsManager UI"
```
