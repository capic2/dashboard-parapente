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

- Use `origin/main` as the default source of truth for repository analysis, diagnostics, code review, and behavior checks.
- Before drawing conclusions from the current checkout, check whether it is aligned with `origin/main`.
- If the current checkout is stale, dirty, or ambiguous, inspect `origin/main` directly or create/use a clean worktree from `origin/main`.
- Only analyze local uncommitted changes, a non-main branch, or a specific worktree when the user explicitly asks for that target.
- State which target is being analyzed when the distinction matters: local checkout, `origin/main`, or a named worktree.

## Worktrees

Load `implementation-worktree-strategy` before implementation tasks: feature work, bug fixes, refactors, and code changes.

When a worktree is created, work from the new worktree path, launch the `worktree-bootstrap` subagent immediately, and run impacted checks there before PR creation.

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

For long validation runs, prefer a validation subagent that runs commands from the active worktree and returns a concise pass/fail report. The main agent fixes failures and decides whether more validation is needed.

## GitHub And CodeRabbit

Use `gh` for all GitHub interactions: issues, PRs, checks, releases, comments, API calls, and GitHub URLs.

Before creating or updating a PR, check branch status, review commits and diff against the base branch, run impacted checks, and fix failures.

For CodeRabbit comments, delegate discovery and triage to a subagent. It should inspect only relevant PR conversations through `gh` and return requested changes, affected files/lines, priority, and conversations to reply to or close. When fixed, reply to each resolved conversation and close it.

## Git
- Do not commit unless explicitly requested.
- Use Conventional Commits when committing.
- Never commit secrets.
- Never amend unless explicitly requested.
