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
- When a pull request, branch, commit, worktree, or diff is supplied, analyze
  that target. For pull-request reviews, always use the PR base, head, and diff.
- When no target is supplied, treat the current `main` commit published by
  GitHub as the default source of truth for code analysis, diagnostics, reviews,
  and functional behavior checks. Resolve its SHA through GitHub before drawing
  conclusions; do not assume the local `origin/main` tracking ref is current.
- For read-only analysis, inspect files at that GitHub SHA. For implementation,
  fetch `origin/main` and create or update a clean worktree from the freshly
  fetched ref, unless the user explicitly asks to inspect local uncommitted
  changes or a specific branch/worktree.
- If GitHub cannot be reached, state clearly that the analysis uses a local ref
  that may be stale.

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
