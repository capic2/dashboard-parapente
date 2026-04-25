# Packmind Standards Index

This standards index contains all available coding standards that can be used by AI agents (like Cursor, Claude Code, GitHub Copilot) to find and apply proven practices in coding tasks.

## Available Standards

- [Add Behavior Tests for UI Logic](./standards/add-behavior-tests-for-ui-logic.md) : Add behavior tests for non-trivial frontend UI logic changes in apps/frontend/** (state transitions, branching, async effects) to prevent regressions and ensure predictable behavior.
- [Enforce Git, Security, and Quality Baseline](./standards/enforce-git-security-and-quality-baseline.md) : Establish a Git, security, and quality baseline for monorepo changes under apps/* and libs/* to reduce risk and maintain consistent standards before commits or PRs.
- [Keep Chromatic Config in Sync](./standards/keep-chromatic-config-in-sync.md) : Keep Chromatic configuration synchronized with frontend Storybook stories in `apps/frontend/**` when stories are added, renamed, moved, or restructured to ensure accurate visual regression coverage.
- [Maintain Storybook + Chromatic Pairing](./standards/maintain-storybook-chromatic-pairing.md) : Maintain pairing between each Storybook story and a dedicated Chromatic story wrapper under apps/frontend/src/** to keep visual baseline snapshots synchronized with interactive story coverage.
- [Prefer Router Loaders + React Query](./standards/prefer-router-loaders-react-query.md) : Prefer React Router loaders with React Query for route-level server data fetching to centralize loading logic, enable caching, and improve navigation performance.
- [React Best Practices](./standards/react-best-practices.md) : A production-focused React standard for preventing common state, effect, rendering, and data-fetching pitfalls in apps with real users and real latency.
- [Require Backend Tests for Behavior Changes](./standards/require-backend-tests-for-behavior-changes.md) : Require backend tests in apps/backend/** for bug fixes or new business behavior changes to prevent regressions and ensure expected behavior.
- [Separate FastAPI Layers](./standards/separate-fastapi-layers.md) : Separate FastAPI endpoint routing, business logic, and data access layers in apps/backend to improve maintainability and testability when adding or modifying API endpoints.
- [TypeScript Best Practices](./standards/typescript-best-practices.md) : Advanced TypeScript rules for production services and libraries to standardize correctness, runtime safety, and operational behavior across common non-framework codepaths.
- [Use CSF Factory for Stories](./standards/use-csf-factory-for-stories.md) : Standardize Storybook story creation and refactoring in the frontend (`apps/frontend/**`) using the CSF Factory pattern to improve consistency and maintainability.
- [Use Shared Fixtures in Backend Tests](./standards/use-shared-fixtures-in-backend-tests.md) : Prefer reusable test fixtures and loader helpers in backend tests under apps/backend/tests/** with shared definitions in apps/backend/tests/fixtures/** to reduce duplication and keep test data stable across modules.


---

*This standards index was automatically generated from deployed standard versions.*