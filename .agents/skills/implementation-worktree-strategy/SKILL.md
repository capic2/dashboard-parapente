---
name: implementation-worktree-strategy
description: Enforces the Git start-of-work strategy for repository code changes by keeping local `main` current and doing development in a dedicated worktree from `origin/main`. Never develop in the primary checkout unless the user explicitly asks. Use when the user asks to implémenter, ajouter, corriger, refactorer, modifier du code, faire une feature, faire une implémentation, changer le frontend, changer le backend, or otherwise requests a code change. Prefer Codex-managed worktrees, with names prefixed by `wt-`.
---

# Implementation Worktree Strategy

## Quick start

Before any implementation task:

1. Check the current Git branch and working-tree state.
2. Fetch `origin/main` and verify its SHA against the current `main` published by GitHub.
3. Fast-forward the local `main` branch to that verified `origin/main`. Keep local `main` aligned before starting development, regardless of the current branch.
4. If the current checkout is the primary repository checkout, create a dedicated worktree from the verified `origin/main`, regardless of its checked-out branch. Only develop in the primary checkout when the user explicitly asks for it.
5. If already in a dedicated worktree, ask whether to continue there or create a new worktree from the verified `origin/main`.
6. Continue in the current worktree if the user chooses it; otherwise create a new worktree from the verified `origin/main`.
7. When a worktree is created, check dependency readiness locally. Use the `worktree-bootstrap` subagent only when installation is missing/unusable and parallel setup would materially reduce wait time.

If local `main` has uncommitted changes, preserve them before fast-forwarding and reapply them afterward; never discard them. If updating `main` or restoring its changes is blocked or produces conflicts, stop and report the condition without dropping the backup or starting a worktree from stale `main`. If `main` is checked out in another worktree, update it there only after confirming that worktree's state.

When the Codex app worktree tool is available, create worktrees with that tool and use a name starting with `wt-`. For CLI-only sessions without the tool, create worktrees in `.codex/worktree`.
Whenever a worktree is created, immediately name the current AI session with the exact worktree name.

## Primary Checkout Rule

- The primary checkout is the repository directory initially opened for the task; a dedicated worktree is a separate path registered by Git's worktree list.
- Never make development changes in the primary repository checkout. This includes implementation edits, tests that write files, builds, and starting a development server from that checkout.
- Use a dedicated worktree for all development, even when the primary checkout is on a feature branch.
- Only make development changes in the primary checkout when the user explicitly asks to do so. A request to update local `main` is permission for the fast-forward operation only, not for other development work there.
- Read-only Git inspection and the required local `main` fast-forward are allowed in the primary checkout.

## Analysis Baseline

- Treat the current `main` commit published by GitHub as the implementation baseline.
- Fetch `origin/main` before analysis and verify that the fetched SHA matches GitHub `main`; do not assume an existing local tracking ref is current.
- Keep the local `main` branch fast-forwarded to the verified `origin/main` before starting any development task, even when the current branch is not `main`.
- Do not rely on local `main` for conclusions unless it has been verified aligned with the freshly fetched `origin/main`.
- If local `main` is stale, dirty, or ambiguous, update it safely before development; if it cannot be aligned without losing or conflicting with local changes, stop and report the blocker.
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

### If the current checkout is the primary repository

Unless the user explicitly asks to develop in the primary checkout:

- Fetch `origin/main`.
- Fast-forward local `main` to the verified `origin/main` ref before creating a worktree.
- Create a worktree from `origin/main`.
- Name the current AI session with the exact worktree name.
- Run the local readiness check; launch `worktree-bootstrap` only for missing/unusable dependencies when parallel setup is explicitly useful.
- Continue implementation in that worktree.

Do this whether the primary checkout currently has `main` or another branch checked out. If the user explicitly asks to develop in the primary checkout, follow that instruction instead of creating a worktree.

### If already in a dedicated worktree

Ask:

`On est dans le worktree <worktree> sur la branche <branch>. Faut-il continuer ici ou créer un nouveau worktree depuis main ?`

If yes:

- Fetch `origin/main`.
- Fast-forward local `main` to the verified `origin/main` ref before creating the worktree.
- Create a worktree from `origin/main` using the Codex app worktree tool, or in `.codex/worktree` for CLI-only sessions.
- Use a name like `wt-<task-label>`.
- Name the current AI session with the exact worktree name.
- Run the local readiness check; launch `worktree-bootstrap` only for missing/unusable dependencies when parallel setup is explicitly useful.
- Continue there.

If no:

- Stay in the current dedicated worktree and branch.
- Keep local `main` aligned with the verified `origin/main` ref.
- Continue there.

## Required commands

Before creating any worktree, run `git fetch origin main`.

Before starting development:

1. Verify `git rev-parse origin/main` matches the SHA returned by GitHub for `main`.
2. Find the worktree where local branch `main` is checked out with `git worktree list`, and inspect its status.
3. If that worktree is clean, run `git -C <main-worktree> merge --ff-only origin/main`.
4. If it is dirty, preserve tracked and untracked changes, fast-forward `main`, then reapply the changes without dropping the backup. If the update or reapplication conflicts, stop and report it.
5. Verify the local `main` HEAD equals the verified `origin/main` SHA before creating a worktree.

Do not update local `main` by merge-commit, rebase, reset, or any operation that discards local changes. Create the implementation worktree from `origin/main`, not from local `main`.

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
