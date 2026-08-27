---
name: dashboard-parapente-workflow
description: Guides implementation, debugging, review, validation, and GitHub workflow in the dashboard-parapente Nx monorepo. Use when modifying frontend/backend code, choosing Nx commands, validating impacted projects, handling GitHub PRs/issues, CodeRabbit comments, or applying repository-specific tooling rules.
---

# Dashboard Parapente Workflow

## Quick Start

Use this skill for repository workflow decisions, GitHub operations, and frontend/backend conventions.

1. Read the closest applicable `AGENTS.md`.
2. Inspect the current structure before editing.
3. Keep changes minimal and scoped.
4. Do not modify unrelated dirty files.
5. Load `local-machine-stack` before running pnpm, Nx, lint, test, build, or type-check commands.

Projects: `frontend` in `apps/frontend`, `backend` in `apps/backend`, `design-system` in `libs/design-system`, `shared-types` in `libs/shared-types`.

## Tooling

- Use `Glob` for file discovery, `Grep` for code search, and `Read` for known files.
- Use `apply_patch` for manual edits; avoid shell-based file editing.
- Never use destructive git commands.
- Use `local-machine-stack` as the source of truth for pnpm paths, dependency readiness, command timeouts, and Nx validation commands.
- Let specialized skills define their own project-specific commands, while `local-machine-stack` supplies shared machine invariants and generic validation commands.

## Analysis Source Of Truth

- When a pull request, branch, commit, worktree, or diff is supplied, analyze that target. For pull-request reviews, always use the PR base, head, and diff.
- When no analysis or review target is supplied, use the current `main` commit published by GitHub as the default source of truth for repository analysis, diagnostics, code review, and behavior checks.
- Resolve the GitHub SHA first with `gh api repos/{owner}/{repo}/commits/main --jq .sha`; never assume the local `origin/main` tracking ref is current.
- For read-only analysis, inspect files at that GitHub SHA with GitHub API or raw URLs without changing local refs.
- For implementation, fetch `origin/main` and create/use a clean worktree from the freshly fetched ref.
- If GitHub is unavailable, report that the analysis uses a local ref that may be stale.
- Only analyze local uncommitted changes, a non-main branch, or a specific worktree when that target is supplied by the user or review context.
- State which target is being analyzed when the distinction matters: a GitHub SHA, local checkout, or a named worktree.

## Worktrees

Load `implementation-worktree-strategy` before implementation tasks: feature work, bug fixes, refactors, and code changes.

When a worktree is created, work from the new worktree path and run the lightweight readiness check locally. Use `worktree-bootstrap` only when dependencies are missing/unusable and parallel setup is explicitly useful.

Do not open a PR from a stale worktree. Fetch remote changes, update against `origin/main`, resolve conflicts, and rerun impacted checks first.

## Frontend

Applies to `apps/frontend/**`; follow `apps/frontend/AGENTS.md`.

- Prefer TanStack Router loaders for route data.
- Use React Query for server state.
- Avoid ad hoc component fetching when loader plus query fits.
- Keep Storybook stories focused and use CSF Factory.
- Update `apps/frontend/chromatic.config.json` when stories are added or restructured.

Run frontend build when behavior, routing, bundling, or UI code changes. Use `local-machine-stack` for the exact validation command.

## Backend

Applies to `apps/backend/**`; follow `apps/backend/AGENTS.md`.

- Use Python `>=3.12` and explicit typing on new functions.
- Keep routes, schemas, business logic, and data access separated.
- Validate API input and output with Pydantic.
- Follow existing SQLAlchemy patterns.
- Add pytest coverage for new business behavior or bug fixes.

Use `local-machine-stack` for the exact backend validation command.

## Validation

Prefer affected Nx validation from `local-machine-stack` for implementation and PR validation. Use direct project targets only after an affected run identifies a failing project, or when explicitly requested. Use `run-many` only when affected detection is inappropriate or a full-repo check is required.

For long validation runs, run commands locally by default. Use a validation subagent only when the user requests parallel execution or the task has independent workstreams that justify its token cost.

## GitHub And CodeRabbit

Use `gh` for all GitHub interactions: issues, PRs, checks, releases, comments, API calls, and GitHub URLs.

Before creating or updating a PR, check branch status, review commits and diff against the base branch, run impacted checks, and fix failures.

Before pushing changes to a branch associated with a PR, check the PR state with
`gh`. Never push additional commits to a PR that is already merged or closed;
create a new branch from the current `origin/main` and open a new PR for the
follow-up changes.

Run the `coderabbit-cli` skill at the end of implementation, after relevant validation and before marking the work ready to ship, unless the user explicitly skips it. Do not defer CodeRabbit to the push step.

For CodeRabbit comments, inspect only relevant PR conversations directly by default. Delegate discovery and triage only when the user requests it or the PR has enough independent conversations to justify the extra agent.

## Git
- Do not commit unless explicitly requested.
- Use Conventional Commits when committing.
- Never commit secrets.
- Never amend unless explicitly requested.
