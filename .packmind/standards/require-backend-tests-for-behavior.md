# Require Backend Tests for Behavior Changes

## Scope
Backend (`apps/backend/**`).

## When
- A bug fix or new business behavior is introduced.

## Do
- Add/update pytest coverage for changed behavior.
- Prefer targeted tests while iterating, then run project checks.

## Why
- Reduces regression risk and documents intent.

## Examples
- Good: reproduce bug with a failing test, then fix and pass.
- Avoid: behavior changes without test updates.
