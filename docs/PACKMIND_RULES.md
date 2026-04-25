# Packmind Rules Draft

This document converts the repository agent rules into a Packmind-friendly format.
Use each section as a standalone rule card.

## Rule 1 - Prefer Router Loaders + React Query

**Scope**: Frontend (`apps/frontend/**`)

**When**
- A route needs server data.
- A page currently fetches data directly inside a component.

**Do**
- Fetch route-level data using TanStack Router loaders.
- Use React Query for caching, synchronization, retries, and server state lifecycle.
- Keep component bodies focused on rendering and interaction logic.

**Why**
- Improves data consistency, cache reuse, and loading-state handling.
- Reduces duplicated fetch logic across components.

**Examples**
- Good: `route.tsx` loader prefetches query, component uses query result.
- Avoid: `useEffect(() => { fetch(...) })` in page components when loader/query fits.

---

## Rule 2 - Write Stories with CSF Factory

**Scope**: Frontend Storybook (`apps/frontend/**`)

**When**
- Creating or updating component stories.

**Do**
- Create stories using CSF Factory patterns already used in the codebase.
- Keep stories focused on clear states and variants.

**Why**
- Increases consistency, readability, and maintainability in Storybook.
- Makes visual tests easier to reason about.

**Examples**
- Good: a factory-generated story file with explicit variant states.
- Avoid: ad hoc story structures that differ from the project pattern.

---

## Rule 3 - Add Behavior Tests for Non-Trivial UI Logic

**Scope**: Frontend (`apps/frontend/**`)

**When**
- A UI change introduces non-trivial behavior (state transitions, branching, async side effects).

**Do**
- Add a matching `*.test.ts` or `*.test.tsx` file.
- Test user-visible behavior and critical logic paths.

**Why**
- Prevents regressions and preserves expected behavior during refactors.

**Examples**
- Good: tests for loading/error/success states and key interactions.
- Avoid: only snapshot tests when logic behavior changed.

---

## Rule 4 - Keep Chromatic Configuration in Sync

**Scope**: Frontend Storybook (`apps/frontend/**`)

**When**
- Stories are added, renamed, moved, or restructured.

**Do**
- Update `apps/frontend/chromatic.config.json` when needed.
- Ensure new stories are included in Chromatic workflow and CI execution.

**Why**
- Prevents missing visual coverage in pull requests.

**Examples**
- Good: config updated together with story structure changes.
- Avoid: story changes merged without Chromatic coverage.

---

## Rule 5 - Keep FastAPI Layers Separated

**Scope**: Backend (`apps/backend/**`)

**When**
- Adding or changing API endpoints.

**Do**
- Separate route handlers, schemas, business logic, and data access.
- Validate request/response models with Pydantic.
- Return consistent HTTP status codes and actionable error messages.

**Why**
- Improves maintainability, testability, and API clarity.

**Examples**
- Good: route delegates to service, service delegates to repository/data layer.
- Avoid: route functions containing persistence + business + response shaping all together.

---

## Rule 6 - Require Tests for New Backend Behavior

**Scope**: Backend (`apps/backend/**`)

**When**
- A bug fix or new business behavior is introduced.

**Do**
- Add or update pytest coverage for the changed behavior.
- Prefer targeted tests during development, then run project-level checks.

**Why**
- Reduces regression risk and documents intended behavior.

**Examples**
- Good: failing test first for bug reproduction, then fix + passing test.
- Avoid: behavior changes with no test delta.

---

## Rule 7 - Enforce Safe Git and Quality Baseline

**Scope**: Monorepo (`apps/*`, `libs/*`)

**When**
- Any change is prepared for commit/PR.

**Do**
- Avoid destructive git commands (`reset --hard`, `checkout --`, etc.).
- Use small explicit commits and Conventional Commits.
- Run lint and targeted tests with Nx (`pnpm nx lint <project>`, `pnpm nx test <project>`).
- Never commit secrets (`.env`, API keys, tokens, credentials).

**Why**
- Improves change safety, review quality, and CI reliability.

**Examples**
- Good: targeted lint/test on impacted projects before PR.
- Avoid: committing secrets or bypassing validation.
