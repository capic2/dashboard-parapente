---
name: dashboard-parapente-workflow
description: Workflow expert for the dashboard-parapente Nx monorepo. Use when implementing, debugging, testing, reviewing, or modifying frontend/backend code in this repository, especially when choosing commands, project targets, validation steps, GitHub workflow, and repo-specific tooling.
---

# Dashboard Parapente Workflow

## Repository

- Nx monorepo.
- Frontend project: `frontend` under `apps/frontend`.
- Backend project: `backend` under `apps/backend`.
- Package manager executable: `/home/capic/.local/share/pnpm/pnpm`.

## Tool Usage
- Prefer `Glob` to find files by path or extension.
- Prefer `Grep` to search code content.
- Use `Read` for specific files.
- Use `apply_patch` for manual edits.
- Avoid shell-based file editing.
- Do not use destructive git commands.

## GitHub
- Use `gh` for all GitHub interactions.
- Use `gh` for issues, pull requests, checks, releases, comments, and GitHub API calls.
- If the user provides a GitHub URL, inspect it with `gh`.
- When fixing CodeRabbit CI review comments, REPLY to each resolved conversation and CLOSE it.

## Worktrees
- For branch/worktree start-of-work decisions, use the `implementation-worktree-strategy` skill.
- This skill only defines repository commands, validation strategy, GitHub usage, and tooling preferences.
- Before opening a PR from a worktree, fetch the remote and update the worktree branch with the latest `origin/main`.
- Do not create a PR from a stale worktree; resolve merge/rebase conflicts and rerun impacted checks first.

## Start Of Work
- Read the closest applicable `AGENTS.md`.
- Check current structure before editing.
- Keep changes minimal and scoped.
- Do not modify unrelated dirty files.

## Frontend

Use when files are under `apps/frontend`.

- Follow TanStack Router loader patterns.
- Use React Query for server state.
- Avoid ad hoc fetching inside components when loader + query fits.
- Keep Storybook stories focused.
- Use CSF Factory.
- Update `apps/frontend/chromatic.config.json` when stories are added or restructured.

Commands:

```bash
/home/capic/.local/share/pnpm/pnpm nx lint frontend
/home/capic/.local/share/pnpm/pnpm nx test frontend
/home/capic/.local/share/pnpm/pnpm nx build frontend
```

## Backend

Use when files are under `apps/backend`.

- Python >= 3.12.
- Add explicit typing on new functions.
- Keep routes, schemas, business logic, and data access separated.
- Validate API input/output with Pydantic.
- Add pytest coverage for new business behavior or bug fixes.

Commands:

```bash
/home/capic/.local/share/pnpm/pnpm nx lint backend
/home/capic/.local/share/pnpm/pnpm nx test backend
```

## Global Commands
Run all tests:

```bash
/home/capic/.local/share/pnpm/pnpm nx run-many -t test
```

Run all lint targets:

```bash
/home/capic/.local/share/pnpm/pnpm nx run-many -t lint
```

## Validation Strategy
- Prefer targeted lint/test commands during implementation.
- Use `run-many -t test` when changes impact multiple projects or before final validation.
- Use `run-many -t lint` for global lint validation.
- Use frontend build when frontend behavior, routing, bundling, or UI code changes.
- Before creating or updating a PR, run all impacted checks from the active worktree and fix failures first.
- For frontend PRs, run `nx lint frontend`, `nx test frontend`, and `nx build frontend` from the worktree before opening the PR.
- Do not create the PR if required checks cannot run locally because of the worktree environment; stop, report the blocker, and ask before proceeding.

## Git
- Do not commit unless explicitly requested.
- If committing, use Conventional Commits.
- Never commit secrets.
- Never amend unless explicitly requested.
