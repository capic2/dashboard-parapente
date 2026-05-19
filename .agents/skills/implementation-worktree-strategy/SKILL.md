---
name: implementation-worktree-strategy
description: Enforces the Git start-of-work strategy for repository code changes by checking the current branch, fetching `origin/main`, and deciding whether to stay on the current branch or create a worktree from `origin/main`. Use when the user asks to implémenter, ajouter, corriger, refactorer, modifier du code, faire une feature, faire une implémentation, changer le frontend, changer le backend, or otherwise requests a code change, especially when worktrees must be created in `.codenomad/worktree` with names prefixed by `wt-`.
---

# Implementation Worktree Strategy

## Quick start

Before any implementation task:

1. Check the current Git branch.
2. If on `main`, fetch `origin/main` and create a worktree from `origin/main`.
3. If on another branch, ask whether to create a worktree.
4. If yes, fetch `origin/main` and create the worktree from `origin/main`.
5. If no, stay on the current branch.
6. When a worktree is created, immediately launch the `worktree-bootstrap` subagent for dependency readiness.

Create worktrees in `.codenomad/worktree` with names starting with `wt-`.
Whenever a worktree is created, immediately name the current AI session with the exact worktree name.

## Analysis Baseline

- Treat `origin/main` as the baseline for implementation analysis before editing.
- Do not rely on local `main` for conclusions unless it has been verified aligned with `origin/main`.
- If local `main` is stale, dirty, or ambiguous, create the implementation worktree from `origin/main` and continue analysis there.
- If the user asks about local uncommitted changes or a specific branch/worktree, analyze that explicit target and say so.

## Worktree Bootstrap Subagent

After creating a worktree, launch the `worktree-bootstrap` subagent immediately and let it run in parallel with the main implementation work.

Subagent responsibility:

- Work in the new worktree path.
- Verify dependency readiness using `local-machine-stack` as the source of truth for exact pnpm/Nx commands.
- Install dependencies only when missing or unusable.
- Do not rely on pnpm's global virtual store; each worktree must have a workspace-local dependency layout usable by Nx and Knip.
- Run a lightweight readiness check after install/check.
- Return a concise report with status, commands run, failures, and whether any files changed.

The main agent remains responsible for interpreting blockers and making code changes. The `worktree-bootstrap` subagent must not edit source code or commit files.

## Rules

### If current branch is `main`

- Fetch `origin/main`.
- Create a worktree from `origin/main`.
- Name the current AI session with the exact worktree name.
- Launch the `worktree-bootstrap` subagent.
- Continue implementation in that worktree.

### If current branch is not `main`

Ask:

`On est sur la branche <branch>. Faut-il créer un worktree depuis main, ou rester sur la branche actuelle ?`

If yes:

- Fetch `origin/main`.
- Create a worktree from `origin/main` in `.codenomad/worktree`.
- Use a name like `wt-<task-label>`.
- Name the current AI session with the exact worktree name.
- Launch the `worktree-bootstrap` subagent.
- Continue there.

If no:

- Stay on the current branch.
- Continue there.

## Required commands

Before creating any worktree, run `git fetch origin main`.

Create the worktree and branch from `origin/main`, not from local `main`: `git worktree add -b wt-<task-label> .codenomad/worktree/wt-<task-label> origin/main`.

Never create an implementation worktree from stale local `main` unless the repository has no remote, and report that limitation.

## Naming

Derive the worktree name from the user's implementation request, not from the full raw prompt and not from the system reminder.

Use this process:

Extract 2 to 5 meaningful words from the implementation intent, convert to lowercase, remove accents/punctuation/special characters, replace spaces with `-`, and prefix with `wt-`.

- `implémenter le login Google` -> `wt-google-login`
- `corriger le bug du dashboard` -> `wt-dashboard-bugfix`
- `ajouter un widget météo` -> `wt-weather-widget`

## Scope

Use for implementation requests: feature work, bug fixes, refactors, and code changes.

Do not use for explanation-only, review-only, or docs-only requests.
