# AGENTS - Backend

This file defines backend rules for `apps/backend`.

## Scope

- Applies to all files under `apps/backend/**`.
- Inherits from root `AGENTS.md`. If there is a conflict, this file has priority.

## Stack and Style

- Python `>=3.12` with explicit typing on new functions.
- Follow rules defined in `apps/backend/pyproject.toml` (Ruff, Black, Pytest).
- Avoid logic duplication: prefer reusable functions/services.

## FastAPI

- Keep clear separation between routes, schemas, business logic, and data access.
- Validate API inputs/outputs with Pydantic schemas.
- Handle errors explicitly (consistent HTTP codes, actionable messages).

## Database

- Follow existing SQLAlchemy patterns.
- Avoid implicit schema changes: use dedicated scripts/migrations when needed.

## Tests and Validation

- Any new business behavior or bug fix must include a pytest test.
- Use targeted tests when possible to speed up feedback loops.
- Recommended commands:
  - `pnpm nx lint backend`
  - `pnpm nx test backend`

## Out of Scope

- Do not add frontend rules here.
- For frontend UI/data-fetching conventions, see `apps/frontend/AGENTS.md`.
