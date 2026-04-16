# Backend Tests

Suite de tests pour le backend Dashboard Parapente.

## Structure

```
tests/
├── test_models.py           # Tests des modèles SQLAlchemy
├── test_routes.py           # Tests des endpoints API (spots, flights, weather)
├── test_emagram.py          # Tests du système d'emagrammes (existant)
├── test_emagram_endpoints.py # Tests des endpoints emagram (nouveau)
├── test_admin.py            # Tests des endpoints admin (nouveau)
└── test_scrapers.py         # Tests des scrapers
```

## Lancer les tests

### Tous les tests (Nx recommandé)
```bash
pnpm nx test backend
```

### Tests unitaires seulement (rapides)
```bash
pnpm nx test backend -- -m "not integration and not slow"
```

### Tests d'intégration (nécessitent APIs externes)
```bash
pnpm nx test:integration backend
```

### Tests rapides sans coverage
```bash
pnpm nx test backend -- -m "not slow" --no-cov
```

### Générer rapport de coverage
```bash
pnpm nx test backend -- --cov-report=html --cov-report=term
```

> Note: `./run_tests.sh` reste disponible pour un usage local direct, mais le flux Nx est désormais la référence du monorepo.

## Marqueurs de tests

- `@pytest.mark.unit` - Tests unitaires isolés
- `@pytest.mark.integration` - Tests nécessitant APIs/services externes
- `@pytest.mark.slow` - Tests lents (> 5 secondes)

## Coverage

Objectif minimum : **50%**

Voir le rapport HTML : `htmlcov/index.html`

## Fixtures disponibles

- `client` - FastAPI TestClient avec base de données de test
- `db_session` - Session SQLAlchemy de test
- `test_db` - Base de données SQLite temporaire

## Exemples

### Test unitaire simple
```python
def test_create_site(db_session):
    site = Site(id="test", code="TST", name="Test", latitude=47.0, longitude=6.0)
    db_session.add(site)
    db_session.commit()
    
    retrieved = db_session.query(Site).filter_by(id="test").first()
    assert retrieved.name == "Test"
```

### Test d'endpoint API
```python
def test_get_spots(client, db_session):
    response = client.get("/api/spots")
    assert response.status_code == 200
    data = response.json()
    assert "sites" in data
```

### Test d'intégration
```python
@pytest.mark.integration
def test_weather_api(client):
    response = client.get("/api/weather/arguel")
    assert response.status_code == 200
```

## Variables d'environnement pour tests

Créer un fichier `.env.test` :

```env
# Test environment
TESTING=true
DATABASE_URL=sqlite:///./test.db

# API Keys (optionnel pour tests d'intégration)
GOOGLE_API_KEY=your_test_key
ANTHROPIC_API_KEY=your_test_key
WEATHERAPI_KEY=your_test_key
```

## CI/CD

Les tests sont automatiquement lancés sur GitHub Actions à chaque push.

Voir `.github/workflows/backend-tests.yml`
