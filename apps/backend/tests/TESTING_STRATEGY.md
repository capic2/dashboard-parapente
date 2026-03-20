# STRATÉGIE DE TESTS - Dashboard Parapente Backend

## 🎯 Objectifs

- **Coverage cible:** ≥ 80% sur tous les modules de production
- **Philosophie:** Test-Driven Confidence pour permettre un cleanup agressif en toute sécurité
- **Approche:** Tests unitaires + intégration + E2E API + scrapers live

---

## 📊 Scope Coverage (Modules Production)

### ✅ Inclus dans le calcul (80% requis)

**Backend racine:**
- `routes.py` - Tous les endpoints API (3,996 lignes!)
- `weather_pipeline.py` - Agrégation multi-sources + consensus
- `models.py` - Modèles SQLAlchemy
- `webhooks.py` - Webhooks Strava
- `strava.py` - Intégration Strava + parsing GPX
- `para_index.py` - Algorithme Para-Index (scoring volabilité)
- `best_spot.py` - Calcul meilleur spot (Para-Index × orientation vent)
- `emagram_multi_source.py` - Orchestration émagrammes multi-sources
- `schemas.py` - Schémas Pydantic
- `scheduler.py` - APScheduler polling météo
- `cache.py` - Gestionnaire Redis
- `video_export.py` / `video_export_manual.py` - Export vidéo Cesium
- `main.py` - Point d'entrée FastAPI
- `config.py` - Configuration
- `database.py` - SQLAlchemy setup

**Sous-dossiers:**
- `scrapers/*` - 15 scrapers météo (Open-Meteo, WeatherAPI, etc.)
- `spots/*` - Recherche spots, geocoding, distance haversine
- `meteorology/*` - Analyses classiques (LI, CAPE, cisaillement)

### ❌ Exclus du calcul (omit configuré)

- `migrations/*` - Scripts de migration DB
- `llm/*` - Analyseurs LLM (dépendances API lourdes)
- `emagram_scheduler/*` - Wrapper scheduler
- `cache_emagram/*` - Wrapper cache
- `emagram_aggregator.py` - Script obsolète
- `tests/*` - Tests eux-mêmes

---

## 🗂️ Architecture Tests

```
backend/tests/
├── fixtures/                    # Data réaliste pour tests
│   ├── sites.json              # Arguel, Chalais, Planfait
│   ├── sample_arguel.gpx       # Vol Arguel réaliste
│   ├── sample_consensus_weather.json
│   ├── sample_strava_activity.json
│   └── mock_responses/
│       └── open_meteo_response.json
│
├── unit/                        # Tests unitaires (logique pure)
│   ├── test_para_index.py
│   ├── test_best_spot_algorithm.py
│   ├── test_spots_distance.py
│   ├── test_strava_parsing.py
│   ├── test_cache.py
│   └── test_schemas_validation.py
│
├── integration/                 # Tests intégration (avec mocks)
│   ├── test_weather_pipeline.py
│   ├── test_webhooks.py
│   ├── test_scheduler.py
│   └── test_emagram_workflow.py
│
├── api/                         # Tests E2E API endpoints
│   ├── test_routes_flights.py
│   ├── test_routes_weather.py
│   ├── test_routes_spots.py
│   ├── test_routes_video.py
│   └── test_routes_weather_sources.py
│
├── scrapers/                    # Tests scrapers (live avec xfail)
│   ├── test_open_meteo.py
│   ├── test_weatherapi.py
│   ├── test_meteo_parapente.py
│   ├── test_meteociel.py
│   ├── test_meteoblue.py
│   └── test_emagram_screenshots.py
│
├── test_models.py               # Tests modèles DB (existant)
├── test_routes.py               # Tests routes basiques (existant)
├── test_emagram.py              # Tests emagram (existant - excellent!)
├── test_emagram_endpoints.py   # Tests endpoints emagram (existant)
├── test_admin.py                # Tests admin endpoints (existant)
└── test_scrapers.py             # Tests scrapers avec mocks (existant)
```

---

## 🧪 Types de Tests

### 1. Tests Unitaires (unit/)

**Caractéristiques:**
- ⚡ Rapides (< 100ms par test)
- ✅ Isolés (0 dépendances externes)
- 🎯 Logique métier pure (algorithmes, calculs)

**Modules testés:**
- `para_index.py` - Calcul Para-Index, analyse créneaux horaires
- `best_spot.py` - Wind favorability, orientation, scoring
- `spots/distance.py` - Haversine distance, bounding box
- `strava.py` - Parsing GPX, conversion streams
- `cache.py` - Redis operations (avec FakeRedis)
- `schemas.py` - Validation Pydantic

**Exemple:**
```python
@pytest.mark.unit
def test_calculate_para_index_excellent_conditions(sample_consensus_weather):
    """Vent 12 km/h, pas de pluie, bon LI → score ≥ 70"""
    result = calculate_para_index(sample_consensus_weather["consensus_hours"])
    assert result["para_index"] >= 70
    assert result["verdict"] == "BON"
```

---

### 2. Tests Intégration (integration/)

**Caractéristiques:**
- 🔗 Pipelines complexes avec mocks
- ⏱️ Moyennement rapides (< 1s par test)
- 🎭 Mock des dépendances externes (APIs, Redis, DB)

**Modules testés:**
- `weather_pipeline.py` - Agrégation multi-sources, consensus
- `webhooks.py` - Workflow Strava webhook → process → DB
- `scheduler.py` - Scheduled weather fetch
- `emagram_multi_source.py` - Screenshots → LLM → DB

**Stratégie mocking:**
```python
@pytest.mark.integration
@patch('scrapers.open_meteo.fetch_open_meteo')
@patch('scrapers.weatherapi.fetch_weatherapi')
def test_weather_pipeline_consensus(mock_weather, mock_open_meteo, mock_open_meteo_response):
    """Test consensus calculation avec 2 sources mockées"""
    mock_open_meteo.return_value = mock_open_meteo_response
    mock_weather.return_value = {...}
    
    result = get_normalized_forecast(lat=47.2, lon=6.0, day_index=0)
    
    assert result["confidence"] > 0.7  # 2 sources = bonne confiance
    assert len(result["consensus_hours"]) == 24
```

---

### 3. Tests E2E API (api/)

**Caractéristiques:**
- 🌐 Tests endpoints FastAPI complets
- 📡 TestClient FastAPI
- 🗄️ DB SQLite temporaire (fixture `test_db`)
- 🎭 Mock pipelines complexes (weather, scrapers)

**Modules testés:**
- `routes.py` - 50+ endpoints (flights, weather, spots, video, admin)

**Exemple:**
```python
def test_get_weather_full(client, arguel_site, mock_weather_pipeline):
    """GET /api/weather/{site_id} retourne 7 jours de prévisions"""
    response = client.get("/api/weather/site-arguel")
    
    assert response.status_code == 200
    data = response.json()
    assert "consensus_hours" in data
    assert len(data["consensus_hours"]) > 0
    assert data["para_index"] >= 0
```

---

### 4. Tests Scrapers Live (scrapers/)

**Caractéristiques:**
- 🌍 Appels API/scraping réels
- ⏳ Lents (5-30s par test selon scraper)
- ❌ `@pytest.mark.xfail` - Échec autorisé si API down
- 🚫 Skip en CI rapide avec `-m "not slow"`

**Modules testés:**
- `scrapers/open_meteo.py` - API Open-Meteo
- `scrapers/weatherapi.py` - API WeatherAPI
- `scrapers/meteo_parapente.py` - Scraping Playwright meteo-parapente.com
- `scrapers/meteociel.py` - Scraping meteociel.fr
- `scrapers/meteoblue.py` - API Meteoblue
- `scrapers/emagram_screenshots.py` - Capture screenshots Playwright

**Stratégie xfail:**
```python
@pytest.mark.xfail(reason="External API may be down or rate-limited")
@pytest.mark.slow
def test_fetch_open_meteo_live():
    """Test live Open-Meteo API (Arguel coordinates)"""
    result = fetch_open_meteo(lat=47.2, lon=6.0, days=1)
    
    assert result is not None
    assert "hourly" in result
    assert len(result["hourly"]["time"]) > 0
```

**Pourquoi xfail?**
- ✅ Test executé mais échec n'empêche pas CI de passer
- ✅ Si API up → test PASS (bonus!)
- ✅ Si API down → test XFAIL (attendu, pas grave)
- ✅ Coverage comptabilisé quand même

---

## 🎯 Fixtures Disponibles (conftest.py)

### Fixtures DB

| Fixture | Description | Scope |
|---------|-------------|-------|
| `test_db` | DB SQLite temporaire | function |
| `db_session` | Session SQLAlchemy | function |
| `client` | FastAPI TestClient | function |

### Fixtures Data Réaliste

| Fixture | Description | Source |
|---------|-------------|--------|
| `sample_sites` | Arguel, Chalais, Planfait | `fixtures/sites.json` |
| `sample_gpx` | Vol Arguel (12 points) | `fixtures/sample_arguel.gpx` |
| `sample_consensus_weather` | Consensus 3h (12h-14h) | `fixtures/sample_consensus_weather.json` |
| `sample_strava_activity` | Response Strava API | `fixtures/sample_strava_activity.json` |
| `mock_open_meteo_response` | Response Open-Meteo | `fixtures/mock_responses/...` |

### Fixtures DB Pré-remplies

| Fixture | Description | Dépendances |
|---------|-------------|-------------|
| `arguel_site` | Site Arguel en DB | `db_session` |
| `chalais_site` | Site Chalais en DB | `db_session` |
| `sample_flight` | Vol test Arguel | `db_session`, `arguel_site` |

### Fixtures Mocking

| Fixture | Description | Lib |
|---------|-------------|-----|
| `fake_redis` | FakeRedis in-memory | `fakeredis` |

**Usage:**
```python
def test_with_real_data(arguel_site, sample_gpx, fake_redis):
    # arguel_site déjà créé en DB
    # sample_gpx contient GPX Arguel
    # fake_redis disponible pour cache
    ...
```

---

## 🎨 Stratégie Mocking

### Quand mocker?

| Module | Mock? | Raison |
|--------|-------|--------|
| Strava API | ✅ Toujours | Éviter rate limiting, besoin credentials |
| Redis | ✅ FakeRedis | Tests rapides, isolation |
| DB | ✅ SQLite temp | Isolation, cleanup auto |
| Playwright | ✅ En unit tests | Trop lent, dépendance browser |
| Scrapers API | ❌ Tests live (xfail) | Validation réelle important |
| LLM (Gemini/Claude) | ✅ Toujours | Coût API, latence |
| FFmpeg | ✅ Subprocess | Trop lent, dépendance système |
| Telegram | ✅ Toujours | Éviter spam notifications |

### Patterns de mocking

**1. Mock httpx (APIs externes):**
```python
@patch('httpx.AsyncClient.get')
def test_fetch_strava_activity(mock_http, sample_strava_activity):
    mock_http.return_value.json.return_value = sample_strava_activity
    mock_http.return_value.status_code = 200
    
    result = get_activity_details(123456789)
    assert result["name"] == "Arguel 15-03 14h00"
```

**2. Mock Playwright (scraping):**
```python
@patch('playwright.async_api.async_playwright')
def test_scrape_meteo_parapente(mock_playwright):
    mock_page = MagicMock()
    mock_page.content.return_value = "<html>...</html>"
    mock_playwright.return_value.__aenter__.return_value.chromium.launch.return_value.new_page.return_value = mock_page
    
    result = fetch_meteo_parapente(lat=47.2, lon=6.0)
    assert result is not None
```

**3. Mock Redis (cache):**
```python
def test_cache_operations(fake_redis):
    # fake_redis est un vrai FakeRedis, pas un mock
    set_cached("test_key", {"data": "value"}, ttl=60, redis_client=fake_redis)
    
    result = get_cached("test_key", redis_client=fake_redis)
    assert result == {"data": "value"}
```

**4. Mock subprocess (FFmpeg):**
```python
@patch('subprocess.run')
def test_video_export_ffmpeg(mock_subprocess):
    mock_subprocess.return_value.returncode = 0
    
    convert_webm_to_mp4("input.webm", "output.mp4")
    
    mock_subprocess.assert_called_once()
    assert "ffmpeg" in mock_subprocess.call_args[0][0]
```

---

## 🔍 Edge Cases Couverts

### Para-Index Algorithm

- ✅ Vent nul (< 3 km/h) → Score bas
- ✅ Vent fort (> 25 km/h) → Score très bas
- ✅ Rafales extrêmes (> 30 km/h) → Dangereux
- ✅ Pluie → Pénalité
- ✅ Pas de données → Gestion erreur
- ✅ Créneaux multiples séparés
- ✅ Aucune heure volable → Liste vide

### Weather Pipeline

- ✅ Consensus 3 sources → Haute confiance
- ✅ Consensus 1 source → Basse confiance
- ✅ Vector averaging direction vent (circular)
- ✅ Source timeout → Fallback autres sources
- ✅ Cache hit → Pas de refetch
- ✅ Cache miss → Fetch + cache

### GPX Parsing

- ✅ GPX valide → Parse OK
- ✅ GPX malformé (XML invalide) → Erreur graceful
- ✅ GPX sans altitude → Géré
- ✅ GPX sans timestamps → Géré
- ✅ GPX vide → Erreur explicite

### Best Spot

- ✅ Vent aligné orientation (±45°) → Multiplier 1.0
- ✅ Vent cross (45-90°) → Multiplier 0.7
- ✅ Vent opposé (>90°) → Multiplier 0.3
- ✅ Différence angulaire circulaire (350° vs 10° = 20°)

### Scrapers

- ✅ API down → xfail (attendu)
- ✅ Rate limiting → Retry logic
- ✅ Selectors changés (Playwright) → Détection échec
- ✅ Response invalide → Erreur explicite

---

## 📋 Commandes Utiles

### Lancer tous les tests

```bash
./run_tests.sh
# Ou
pytest tests/
```

### Tests par type

```bash
# Unitaires uniquement (rapide)
./run_tests.sh unit
pytest tests/unit/ -v

# Intégration
./run_tests.sh integration
pytest tests/integration/ -v

# API endpoints
pytest tests/api/ -v

# Scrapers live (lent)
pytest tests/scrapers/ -v
```

### Tests rapides (sans scrapers)

```bash
./run_tests.sh fast
pytest tests/ -m "not slow" --no-cov
```

### Coverage

```bash
# Avec rapport HTML
./run_tests.sh coverage

# Coverage d'un module spécifique
pytest --cov=para_index --cov-report=term-missing tests/unit/test_para_index.py
pytest --cov=weather_pipeline tests/integration/test_weather_pipeline.py

# Ouvrir rapport HTML
firefox htmlcov/index.html
```

### Debug tests failing

```bash
# Mode verbose + afficher prints
pytest tests/unit/test_para_index.py -v -s

# Arrêter au premier échec
pytest tests/ -x

# Relancer uniquement tests failed
pytest --lf

# Profiling (identifier tests lents)
pytest tests/ --durations=10
```

### CI/CD simulation

```bash
# Tests rapides pour CI (skip scrapers live)
pytest tests/ -m "not slow" --cov=. --cov-report=xml

# Vérifier coverage ≥ 80%
pytest tests/ --cov=. --cov-fail-under=80
```

---

## 📈 Critères de Succès

### Coverage par Module (Cibles)

| Module | Cible | Priorité |
|--------|-------|----------|
| `para_index.py` | ≥ 95% | ⭐⭐⭐ |
| `best_spot.py` | ≥ 90% | ⭐⭐⭐ |
| `cache.py` | ≥ 90% | ⭐⭐⭐ |
| `weather_pipeline.py` | ≥ 80% | ⭐⭐⭐ |
| `strava.py` (parsing) | ≥ 80% | ⭐⭐⭐ |
| `routes.py` | ≥ 70% | ⭐⭐⭐ |
| `webhooks.py` | ≥ 75% | ⭐⭐ |
| `models.py` | ≥ 85% | ⭐⭐ |
| `spots/*` | ≥ 85% | ⭐⭐ |
| `scrapers/*` | ≥ 70% | ⭐⭐ |
| `scheduler.py` | ≥ 70% | ⭐⭐ |

### Coverage Global

- ✅ **≥ 80%** sur tous modules production
- ✅ **≥ 50%** acceptable temporairement pour video_export (Playwright complexe)
- ✅ **0% OK** pour modules exclus (llm/*, migrations/*)

### Tous Tests Passent

```bash
pytest tests/ --cov=. --cov-fail-under=80
# Exit code 0 = succès
```

**xfail acceptés:**
- ✅ Scrapers live si API down
- ✅ Pas considéré comme échec

---

## 🔧 Maintenance Tests

### Ajouter un nouveau module

1. Créer `tests/unit/test_nouveau_module.py`
2. Ajouter fixtures si besoin dans `conftest.py`
3. Viser ≥ 80% coverage
4. Lancer `pytest --cov=nouveau_module tests/unit/test_nouveau_module.py`

### API scraper change

1. Mettre à jour `fixtures/mock_responses/scraper_response.json`
2. Adapter tests unitaires (mocks)
3. Vérifier tests live (xfail OK si structure change)

### Augmenter coverage

```bash
# Identifier lignes non couvertes
pytest --cov=routes --cov-report=html tests/api/
firefox htmlcov/routes_py.html  # Voir lignes rouges

# Ajouter tests pour lignes manquantes
```

---

## 📚 Ressources

- **pytest docs:** https://docs.pytest.org/
- **FastAPI testing:** https://fastapi.tiangolo.com/tutorial/testing/
- **pytest-cov:** https://pytest-cov.readthedocs.io/
- **fakeredis:** https://github.com/cunla/fakeredis-py
- **unittest.mock:** https://docs.python.org/3/library/unittest.mock.html

---

## ✅ Checklist Avant Cleanup

**Avant de supprimer des fichiers backend:**

- [ ] Coverage global ≥ 80%
- [ ] Coverage para_index.py ≥ 95%
- [ ] Coverage best_spot.py ≥ 90%
- [ ] Coverage weather_pipeline.py ≥ 80%
- [ ] Tous tests passent (xfail OK)
- [ ] CI/CD passe (`pytest tests/ --cov-fail-under=80`)
- [ ] Documentation à jour (README.md, TESTING_STRATEGY.md)

**Workflow cleanup sécurisé:**
1. ✅ Valider coverage ≥ 80%
2. ✅ Commit tests sur branche `backend-test`
3. ✅ Merger dans `main`
4. ✅ Créer branche `cleanup-aggressive`
5. ✅ Supprimer fichiers obsolètes
6. ✅ Relancer tests → Si échec, module était utilisé → restore
7. ✅ Si tous tests passent → Cleanup validé ✅

---

**Dernière mise à jour:** 16 Mars 2026  
**Coverage actuel:** ~27% → Objectif 80%  
**Statut:** Phase 0 complète, Phase 1 en cours
