# Create Shared Pytest Fixtures

When test data is repeated across multiple backend tests, extract it into shared fixtures to reduce noise and improve consistency.

## When to Use

- You see the same object shape repeated in multiple test files
- Many tests mutate local hard-coded payloads for the same domain entity
- Onboarding new tests that need realistic API payloads and DB records

## Checkpoints

- Which entities are repeated most often across tests?
- Does each test require different state or just shared defaults?
- Can a fixture be loaded from JSON once and adjusted per test?

## Steps

### 1. Select a repeatable test domain

Identify one repeated domain (e.g., sites, flights, weather API responses) and centralize its canonical structure.

### 2. Add or update fixture files

Create `apps/backend/tests/fixtures/*.json` and keep payloads normalized by entity.

```json
{
  "sites": [
    {"id": "site-arguel", "name": "Arguel", "elevation_m": 427}
  ]
}
```

### 3. Expose fixtures through shared `conftest.py` fixtures

Add lightweight fixture functions so tests consume a single source of truth.

```python
@pytest.fixture
def sample_sites():
    import json

    fixtures_path = Path(__file__).parent / "tests" / "fixtures" / "sites.json"
    with open(fixtures_path) as f:
        data = json.load(f)
    return data["sites"]
```

### 4. Replace repeated inline literals

Swap duplicated inline payload creation with fixture usage and keep unique edge cases as explicit locals.
