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
- When handling CodeRabbit comments, delegate comment discovery, analysis, and triage to a subagent; the main agent does not need the full global context.
- The CodeRabbit subagent should inspect only the relevant PR conversations/comments via `gh` and return a concise actionable report: requested changes, affected files/lines, priority, and conversations to reply to/close.
- When fixing CodeRabbit CI review comments, REPLY to each resolved conversation and CLOSE it.

## Worktrees
- For branch/worktree start-of-work decisions, use the `implementation-worktree-strategy` skill.
- This skill only defines repository commands, validation strategy, GitHub usage, and tooling preferences.
- When a worktree is created, use the `worktree-bootstrap` subagent defined by `implementation-worktree-strategy` before relying on Nx commands.
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

Prefer affected Nx tasks for validation:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint,test,build --parallel=5 --exclude=e2e
```

Use direct project targets only for a narrow diagnostic rerun after an affected task identifies a specific failing project.

## Backend

Use when files are under `apps/backend`.

- Python >= 3.12.
- Add explicit typing on new functions.
- Keep routes, schemas, business logic, and data access separated.
- Validate API input/output with Pydantic.
- Add pytest coverage for new business behavior or bug fixes.

Prefer affected Nx tasks for validation:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint,test --parallel=5 --exclude=e2e
```

Use direct project targets only for a narrow diagnostic rerun after an affected task identifies a specific failing project.

## Global Commands
Run impacted tests:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t test --parallel=5 --exclude=e2e
```

Run impacted lint targets:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint --parallel=5 --exclude=e2e
```

## Validation Strategy
- Prefer `nx affected` for Nx lint/test/build tasks during implementation and PR validation.
- For long or multi-command validation runs, prefer a validation subagent that runs commands from the active worktree and returns a concise pass/fail report.
- Keep the main agent responsible for fixing failures and deciding whether extra validation is needed.
- Prefer `nx affected -t build,lint,type-check,test --parallel=5 --exclude=e2e` for branch/PR validation.
- Use direct project commands such as `nx lint frontend` or `nx test backend` only as a follow-up diagnostic when an affected run has already identified a failing project, or when the user explicitly asks for a direct project target.
- Use `run-many -t test` only when affected detection is not appropriate or a full-repo check is explicitly needed.
- Use `run-many -t lint` only when affected detection is not appropriate or a full-repo lint is explicitly needed.
- Use frontend build when frontend behavior, routing, bundling, or UI code changes.
- Before creating or updating a PR, run all impacted checks from the active worktree and fix failures first.
- For frontend PRs, run `nx affected -t lint,test,build --parallel=5 --exclude=e2e` from the worktree before opening the PR.
- Do not create the PR if required checks cannot run locally because of the worktree environment; stop, report the blocker, and ask before proceeding.

## Git
- Do not commit unless explicitly requested.
- If committing, use Conventional Commits.
- Never commit secrets.
- Never amend unless explicitly requested.
