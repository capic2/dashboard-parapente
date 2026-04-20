# AGENTS - Global Rules

This file defines global rules for the entire monorepo.

## Rule Hierarchy

1. The `AGENTS.md` file closest to the modified code has priority.
2. If rules conflict, the local rule overrides the parent rule.
3. Global rules remain active unless explicitly overridden locally.

## Scope

- Nx monorepo: `apps/*` and `libs/*`.
- This file covers cross-cutting rules (git, security, quality, workflow).

## Workflow

- Always limit changes to what is required by the task.
- Follow existing conventions before introducing a new pattern.
- Never modify out-of-scope files without an explicit reason.

## Git

- Do not use destructive commands (`reset --hard`, `checkout --`, etc.).
- Keep commits small and explicit.
- Use Conventional Commits when a commit is requested.

## Security

- Never commit secrets (`.env`, API keys, tokens, credentials).
- Never expose sensitive values in logs, tests, docs, or stories.

## Minimum Quality

- Run lint and targeted tests on impacted projects via Nx.
- Common commands:
  - `pnpm lint`
  - `pnpm test`
  - or targeted commands: `pnpm nx lint <project>`, `pnpm nx test <project>`

## Local Rules

- Backend: see `apps/backend/AGENTS.md`.
- Frontend: see `apps/frontend/AGENTS.md`.
<!-- start: Packmind standards -->
# Packmind Standards

Before starting your work, make sure to review the coding standards relevant to your current task.

Always consult the sections that apply to the technology, framework, or type of contribution you are working on.

All rules and guidelines defined in these standards are mandatory and must be followed consistently.

Failure to follow these standards may lead to inconsistencies, errors, or rework. Treat them as the source of truth for how code should be written, structured, and maintained.

# Standard: Add Behavior Tests for UI Logic

Add behavior tests for non-trivial frontend UI logic changes in apps/frontend/** (state transitions, branching, async effects) to prevent regressions and ensure predictable behavior. :
* A change adds non-trivial behavior (state transitions, branching, async effects).

Full standard is available here for further request: [Add Behavior Tests for UI Logic](.packmind/standards/add-behavior-tests-for-ui-logic.md)

# Standard: Keep Chromatic Config in Sync

Keep Chromatic configuration synchronized with frontend Storybook stories in `apps/frontend/**` when stories are added, renamed, moved, or restructured to ensure accurate visual regression coverage. :
* Stories are added, renamed, moved, or restructured.

Full standard is available here for further request: [Keep Chromatic Config in Sync](.packmind/standards/keep-chromatic-config-in-sync.md)

# Standard: Enforce Git, Security, and Quality Baseline

Establish a Git, security, and quality baseline for monorepo changes under apps/* and libs/* to reduce risk and maintain consistent standards before commits or PRs. :
* Preparing any change for commit or PR.

Full standard is available here for further request: [Enforce Git, Security, and Quality Baseline](.packmind/standards/enforce-git-security-and-quality-baseline.md)

# Standard: Maintain Storybook + Chromatic Pairing

Maintain pairing between each Storybook story and a dedicated Chromatic story wrapper under apps/frontend/src/** to keep visual baseline snapshots synchronized with interactive story coverage. :
* No rules defined yet.

Full standard is available here for further request: [Maintain Storybook + Chromatic Pairing](.packmind/standards/maintain-storybook-chromatic-pairing.md)

# Standard: React Best Practices

A production-focused React standard for preventing common state, effect, rendering, and data-fetching pitfalls in apps with real users and real latency. :
* Define ErrorBoundary and Suspense boundaries near feature edges; avoid a single top-level boundary that obscures failing component context.
* Guard async effects with AbortController and ignore stale responses before setting state.
* Isolate non-serializable resources in refs or module singletons; avoid storing AbortController, WebSocket, or timers in React state.
* Keep derived data out of state; compute via useMemo or inline expressions from the source state and props.
* Memoize Context provider values and callbacks; avoid passing freshly created objects/functions as Context value.
* Normalize list keys to stable identifiers; avoid array index, Math.random(), or object references as keys.
* Prefer functional state updates when next state depends on previous state; avoid reading stale state from closures.
* Sanitize untrusted HTML before using dangerouslySetInnerHTML; avoid rendering raw user-provided HTML strings.
* Specify complete Hook dependency arrays and extract stable callbacks with useCallback or inline them inside the effect.
* Wrap event handlers and effects with consistent error routing; avoid unhandled promise rejections from async handlers.

Full standard is available here for further request: [React Best Practices](.packmind/standards/react-best-practices.md)

# Standard: Prefer Router Loaders + React Query

Prefer React Router loaders with React Query for route-level server data fetching to centralize loading logic, enable caching, and improve navigation performance. :
* A page currently fetches data directly in a component.
* A route needs server data.

Full standard is available here for further request: [Prefer Router Loaders + React Query](.packmind/standards/prefer-router-loaders-react-query.md)

# Standard: Use CSF Factory for Stories

Standardize Storybook story creation and refactoring in the frontend (`apps/frontend/**`) using the CSF Factory pattern to improve consistency and maintainability. :
* Creating new stories.
* Refactoring existing stories.

Full standard is available here for further request: [Use CSF Factory for Stories](.packmind/standards/use-csf-factory-for-stories.md)

# Standard: TypeScript Best Practices

Advanced TypeScript rules for production services and libraries to standardize correctness, runtime safety, and operational behavior across common non-framework codepaths. :
* Implement retries only for idempotent operations with bounded attempts and backoff; avoid unbounded loops or retrying non-idempotent side effects.
* Keep tests isolated by controlling time, randomness, and global state; avoid tests that depend on real timeouts, Math.random, or shared module singletons.
* Manage resources with deterministic cleanup using try/finally or using; avoid leaving timers, event listeners, streams, or file handles open.
* Model config access with a typed loader that validates required keys and parses types; avoid reading process.env directly across the codebase.
* Prefer immutable data with readonly and avoid exporting mutable singletons; isolate shared state behind functions or classes with explicit update methods.
* Set explicit timeouts and cancellation for all network or long-running async operations using AbortSignal; avoid Promises that can hang indefinitely.
* Type async callbacks as returning Promise<void> and handle rejections at the boundary; avoid floating Promises inside event handlers and timers.
* Use structured logging with stable keys and include error stack and correlation context; avoid concatenated strings and logging only error.message.
* Use typed errors or discriminated Result types for expected failures; avoid throwing raw strings or relying on message matching.
* Validate all untrusted inputs at module boundaries using runtime schemas and return typed values; avoid casting unknown data to domain types.

Full standard is available here for further request: [TypeScript Best Practices](.packmind/standards/typescript-best-practices.md)

# Standard: Separate FastAPI Layers

Separate FastAPI endpoint routing, business logic, and data access layers in apps/backend to improve maintainability and testability when adding or modifying API endpoints. :
* Adding or modifying API endpoints.

Full standard is available here for further request: [Separate FastAPI Layers](.packmind/standards/separate-fastapi-layers.md)

# Standard: Require Backend Tests for Behavior Changes

Require backend tests in apps/backend/** for bug fixes or new business behavior changes to prevent regressions and ensure expected behavior. :
* A bug fix or new business behavior is introduced.

Full standard is available here for further request: [Require Backend Tests for Behavior Changes](.packmind/standards/require-backend-tests-for-behavior-changes.md)

# Standard: Use Shared Fixtures in Backend Tests

Prefer reusable test fixtures and loader helpers in backend tests under apps/backend/tests/** with shared definitions in apps/backend/tests/fixtures/** to reduce duplication and keep test data stable across modules. :
* No rules defined yet.

Full standard is available here for further request: [Use Shared Fixtures in Backend Tests](.packmind/standards/use-shared-fixtures-in-backend-tests.md)
<!-- end: Packmind standards -->
<!-- start: Packmind standards -->
# Packmind Standards

Before starting your work, make sure to review the coding standards relevant to your current task.

Always consult the sections that apply to the technology, framework, or type of contribution you are working on.

All rules and guidelines defined in these standards are mandatory and must be followed consistently.

Failure to follow these standards may lead to inconsistencies, errors, or rework. Treat them as the source of truth for how code should be written, structured, and maintained.

# Standard: Add Behavior Tests for UI Logic

Add behavior tests for non-trivial frontend UI logic changes in apps/frontend/** (state transitions, branching, async effects) to prevent regressions and ensure predictable behavior. :
* A change adds non-trivial behavior (state transitions, branching, async effects).

Full standard is available here for further request: [Add Behavior Tests for UI Logic](.packmind/standards/add-behavior-tests-for-ui-logic.md)

# Standard: Keep Chromatic Config in Sync

Keep Chromatic configuration synchronized with frontend Storybook stories in `apps/frontend/**` when stories are added, renamed, moved, or restructured to ensure accurate visual regression coverage. :
* Stories are added, renamed, moved, or restructured.

Full standard is available here for further request: [Keep Chromatic Config in Sync](.packmind/standards/keep-chromatic-config-in-sync.md)

# Standard: Enforce Git, Security, and Quality Baseline

Establish a Git, security, and quality baseline for monorepo changes under apps/* and libs/* to reduce risk and maintain consistent standards before commits or PRs. :
* Preparing any change for commit or PR.

Full standard is available here for further request: [Enforce Git, Security, and Quality Baseline](.packmind/standards/enforce-git-security-and-quality-baseline.md)

# Standard: Maintain Storybook + Chromatic Pairing

Maintain pairing between each Storybook story and a dedicated Chromatic story wrapper under apps/frontend/src/** to keep visual baseline snapshots synchronized with interactive story coverage. :
* No rules defined yet.

Full standard is available here for further request: [Maintain Storybook + Chromatic Pairing](.packmind/standards/maintain-storybook-chromatic-pairing.md)

# Standard: React Best Practices

A production-focused React standard for preventing common state, effect, rendering, and data-fetching pitfalls in apps with real users and real latency. :
* Define ErrorBoundary and Suspense boundaries near feature edges; avoid a single top-level boundary that obscures failing component context.
* Guard async effects with AbortController and ignore stale responses before setting state.
* Isolate non-serializable resources in refs or module singletons; avoid storing AbortController, WebSocket, or timers in React state.
* Keep derived data out of state; compute via useMemo or inline expressions from the source state and props.
* Memoize Context provider values and callbacks; avoid passing freshly created objects/functions as Context value.
* Normalize list keys to stable identifiers; avoid array index, Math.random(), or object references as keys.
* Prefer functional state updates when next state depends on previous state; avoid reading stale state from closures.
* Sanitize untrusted HTML before using dangerouslySetInnerHTML; avoid rendering raw user-provided HTML strings.
* Specify complete Hook dependency arrays and extract stable callbacks with useCallback or inline them inside the effect.
* Wrap event handlers and effects with consistent error routing; avoid unhandled promise rejections from async handlers.

Full standard is available here for further request: [React Best Practices](.packmind/standards/react-best-practices.md)

# Standard: Prefer Router Loaders + React Query

Prefer React Router loaders with React Query for route-level server data fetching to centralize loading logic, enable caching, and improve navigation performance. :
* A page currently fetches data directly in a component.
* A route needs server data.

Full standard is available here for further request: [Prefer Router Loaders + React Query](.packmind/standards/prefer-router-loaders-react-query.md)

# Standard: Use CSF Factory for Stories

Standardize Storybook story creation and refactoring in the frontend (`apps/frontend/**`) using the CSF Factory pattern to improve consistency and maintainability. :
* Creating new stories.
* Refactoring existing stories.

Full standard is available here for further request: [Use CSF Factory for Stories](.packmind/standards/use-csf-factory-for-stories.md)

# Standard: TypeScript Best Practices

Advanced TypeScript rules for production services and libraries to standardize correctness, runtime safety, and operational behavior across common non-framework codepaths. :
* Implement retries only for idempotent operations with bounded attempts and backoff; avoid unbounded loops or retrying non-idempotent side effects.
* Keep tests isolated by controlling time, randomness, and global state; avoid tests that depend on real timeouts, Math.random, or shared module singletons.
* Manage resources with deterministic cleanup using try/finally or using; avoid leaving timers, event listeners, streams, or file handles open.
* Model config access with a typed loader that validates required keys and parses types; avoid reading process.env directly across the codebase.
* Prefer immutable data with readonly and avoid exporting mutable singletons; isolate shared state behind functions or classes with explicit update methods.
* Set explicit timeouts and cancellation for all network or long-running async operations using AbortSignal; avoid Promises that can hang indefinitely.
* Type async callbacks as returning Promise<void> and handle rejections at the boundary; avoid floating Promises inside event handlers and timers.
* Use structured logging with stable keys and include error stack and correlation context; avoid concatenated strings and logging only error.message.
* Use typed errors or discriminated Result types for expected failures; avoid throwing raw strings or relying on message matching.
* Validate all untrusted inputs at module boundaries using runtime schemas and return typed values; avoid casting unknown data to domain types.

Full standard is available here for further request: [TypeScript Best Practices](.packmind/standards/typescript-best-practices.md)

# Standard: Separate FastAPI Layers

Separate FastAPI endpoint routing, business logic, and data access layers in apps/backend to improve maintainability and testability when adding or modifying API endpoints. :
* Adding or modifying API endpoints.

Full standard is available here for further request: [Separate FastAPI Layers](.packmind/standards/separate-fastapi-layers.md)

# Standard: Require Backend Tests for Behavior Changes

Require backend tests in apps/backend/** for bug fixes or new business behavior changes to prevent regressions and ensure expected behavior. :
* A bug fix or new business behavior is introduced.

Full standard is available here for further request: [Require Backend Tests for Behavior Changes](.packmind/standards/require-backend-tests-for-behavior-changes.md)

# Standard: Use Shared Fixtures in Backend Tests

Prefer reusable test fixtures and loader helpers in backend tests under apps/backend/tests/** with shared definitions in apps/backend/tests/fixtures/** to reduce duplication and keep test data stable across modules. :
* No rules defined yet.

Full standard is available here for further request: [Use Shared Fixtures in Backend Tests](.packmind/standards/use-shared-fixtures-in-backend-tests.md)
<!-- end: Packmind standards -->
