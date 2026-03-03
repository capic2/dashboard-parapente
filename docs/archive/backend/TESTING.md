# Backend Testing Guide

## Overview

Complete test suite for Dashboard Parapente backend:
- **Unit tests:** Scrapers, Para-Index, models
- **Integration tests:** API routes, database
- **Fixtures:** TestClient + in-memory DB

## Structure

```
backend/
├── conftest.py           # pytest fixtures (TestClient, DB)
├── pytest.ini            # pytest config
├── run-tests.sh          # Run all tests with coverage
├── tests/
│   ├── test_routes.py    # API endpoint tests
│   ├── test_scrapers.py  # Para-Index + weather logic
│   └── test_models.py    # Database models
```

## Running Tests

### All tests:
```bash
cd backend
source venv_311/bin/activate
pytest tests/ -v
```

### Specific test file:
```bash
pytest tests/test_routes.py -v
```

### Specific test:
```bash
pytest tests/test_routes.py::TestSpotsEndpoints::test_get_spots_empty -v
```

### With coverage report:
```bash
bash run-tests.sh
```

## Test Coverage

### Unit Tests

**`test_routes.py`** - API Endpoints
- ✅ GET `/api/spots` (empty, with data)
- ✅ GET `/api/spots/{id}` (exists, not found)
- ✅ GET `/api/flights` (empty, with data, limit)
- ✅ GET `/api/flights/stats` (basic stats)
- ✅ GET `/api/weather/{id}` (validation, optional live data)
- ✅ GET `/api/alerts` (list, empty)

**`test_scrapers.py`** - Para-Index Scoring
- ✅ `score_hour()` - Ideal, no-wind, strong-wind conditions
- ✅ `calculate_para_index()` - Full day scoring (0-100)
- ✅ `analyze_hourly_slots()` - Flyable slot detection
- ✅ `format_slots_summary()` - Human-readable output
- ✅ Verdict logic (🟢 green, 🟡 yellow, 🔴 red)

**`test_models.py`** - Database Models
- ✅ Site creation + retrieval
- ✅ Site unique constraint
- ✅ Flight creation + duration calculation
- ✅ Flight ordering (newest first)
- ✅ WeatherForecast creation
- ✅ Alert creation

## Test Fixtures

### `test_db` - In-Memory Database
```python
@pytest.fixture
def test_db():
    # Uses SQLite in-memory
    # Cleaned up after each test
```

### `client` - FastAPI TestClient
```python
@pytest.fixture
def client(test_db):
    return TestClient(app)  # Full app with overridden DB
```

### `db_session` - Direct DB Access
```python
@pytest.fixture
def db_session(test_db):
    return test_db()  # For manual queries
```

## Example Test

```python
def test_get_spots_with_data(self, client, db_session):
    # Setup
    site = Site(id="site-test", name="Test", latitude=47, longitude=6, altitude=400)
    db_session.add(site)
    db_session.commit()
    
    # Test
    response = client.get("/api/spots")
    
    # Assert
    assert response.status_code == 200
    assert len(response.json()["sites"]) == 1
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run backend tests
  run: |
    cd backend
    source venv_311/bin/activate
    bash run-tests.sh
```

## Debugging Failed Tests

### Verbose output:
```bash
pytest tests/test_routes.py::TestSpotsEndpoints::test_get_spots_empty -vv --tb=long
```

### Print statements:
```bash
pytest tests/ -v -s  # -s shows print() output
```

### Stop on first failure:
```bash
pytest tests/ -x -v  # -x stops at first failure
```

## Future Additions

- [ ] Strava webhook tests
- [ ] Weather source integration tests (with mocked HTTP)
- [ ] Scheduler tests (background tasks)
- [ ] Load tests (stress testing)
- [ ] Database migration tests
- [ ] Performance benchmarks

## Notes

- All tests use **in-memory SQLite** (no disk I/O)
- Tests are **isolated** (no shared state)
- TestClient **doesn't require running server**
- Coverage target: **>80%** for core logic
