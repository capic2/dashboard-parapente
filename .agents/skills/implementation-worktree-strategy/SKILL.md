---
name: implementation-worktree-strategy
description: Enforces the Git start-of-work strategy for repository code changes by checking the current branch, fetching `origin/main`, and deciding whether to stay on the current branch or create a worktree from `origin/main`. Use when the user asks to implémenter, ajouter, corriger, refactorer, modifier du code, faire une feature, faire une implémentation, changer le frontend, changer le backend, or otherwise requests a code change. Prefer Codex-managed worktrees, with names prefixed by `wt-`.
---

# Implementation Worktree Strategy

## Quick start

Before any implementation task:

1. Check the current Git branch.
2. If on `main`, fetch `origin/main` and create a worktree from `origin/main`.
3. If on another branch, ask whether to create a worktree.
4. If yes, fetch `origin/main` and create the worktree from `origin/main`.
5. If no, stay on the current branch.
6. When a worktree is created, check dependency readiness locally. Use the `worktree-bootstrap` subagent only when installation is missing/unusable and parallel setup would materially reduce wait time.

When the Codex app worktree tool is available, create worktrees with that tool and use a name starting with `wt-`. For CLI-only sessions without the tool, create worktrees in `.codex/worktree`.
Whenever a worktree is created, immediately name the current AI session with the exact worktree name.

## Analysis Baseline

- Treat the current `main` commit published by GitHub as the implementation baseline.
- Fetch `origin/main` before analysis and verify that the fetched SHA matches GitHub `main`; do not assume an existing local tracking ref is current.
- Do not rely on local `main` for conclusions unless it has been verified aligned with the freshly fetched `origin/main`.
- If local `main` is stale, dirty, or ambiguous, create the implementation worktree from the freshly fetched `origin/main` and continue analysis there.
- If the user asks about local uncommitted changes or a specific branch/worktree, analyze that explicit target and say so.

## Worktree Bootstrap Subagent

After creating a worktree, perform the lightweight readiness check locally. Delegate setup only when dependencies are missing or unusable and the user has asked for parallel execution.

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
- Run the local readiness check; launch `worktree-bootstrap` only for missing/unusable dependencies when parallel setup is explicitly useful.
- Continue implementation in that worktree.

### If current branch is not `main`

Ask:

`On est sur la branche <branch>. Faut-il créer un worktree depuis main, ou rester sur la branche actuelle ?`

If yes:

- Fetch `origin/main`.
- Create a worktree from `origin/main` using the Codex app worktree tool, or in `.codex/worktree` for CLI-only sessions.
- Use a name like `wt-<task-label>`.
- Name the current AI session with the exact worktree name.
- Run the local readiness check; launch `worktree-bootstrap` only for missing/unusable dependencies when parallel setup is explicitly useful.
- Continue there.

If no:

- Stay on the current branch.
- Continue there.

## Required commands

Before creating any worktree, run `git fetch origin main`.

Create the worktree and branch from `origin/main`, not from local `main`. In the Codex app, use the managed worktree tool with `origin/main` as the ref. In CLI-only sessions, use: `git worktree add -b wt-<task-label> .codex/worktree/wt-<task-label> origin/main`.

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
