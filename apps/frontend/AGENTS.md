# AGENTS - Frontend

This file defines frontend rules for `apps/frontend`.

## Scope

- Applies to all files under `apps/frontend/**`.
- Inherits from root `AGENTS.md`. If there is a conflict, this file has priority.

## Data Fetching and Routing

- Prioritize TanStack Router with loaders.
- Use React Query for caching, synchronization, and server state.
- Avoid ad hoc fetching inside components when a loader + query fits.

## Storybook

- Create stories using CSF Factory, annd use STORY.test() when behavior needs verification.
- Keep stories focused on clear, reproducible states/variants.

## Chromatic

- Keep `apps/frontend/chromatic.config.json` updated when stories are added or restructured.
- Verify that new stories are included in the Chromatic workflow.

## Minimum Quality

- Enforce strict TypeScript and repo `oxlint`/`oxfmt` rules.
- Recommended commands:
  - `pnpm nx lint frontend`
  - `pnpm nx test frontend`
  - `pnpm nx build frontend`
