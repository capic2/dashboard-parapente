# Add Behavior Tests for UI Logic

## Scope
Frontend (`apps/frontend/**`).

## When
- A change adds non-trivial behavior (state transitions, branching, async effects).

## Do
- Add a matching `*.test.ts` or `*.test.tsx`.
- Validate user-visible behavior and critical logic branches.

## Why
- Prevents regressions and protects expected behavior.

## Examples
- Good: tests for loading, error, success, and key user interactions.
- Avoid: snapshots only when behavior changed.
