# Separate FastAPI Layers

## Scope
Backend (`apps/backend/**`).

## When
- Adding or modifying API endpoints.

## Do
- Keep routes, schemas, business logic, and data access separated.
- Validate request/response contracts with Pydantic.
- Return consistent HTTP status codes and actionable error messages.

## Why
- Improves maintainability, testability, and API clarity.

## Examples
- Good: route delegates to service; service delegates to data access.
- Avoid: route handlers mixing persistence, business rules, and response formatting.
