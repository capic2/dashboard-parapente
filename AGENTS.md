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
