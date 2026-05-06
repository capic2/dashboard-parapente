---
name: implementation-worktree-strategy
description: Enforces the Git start-of-work strategy for repository code changes by checking the current branch, updating `main` when required, and deciding whether to stay on the current branch or create a worktree from `main`. Use when the user asks to implémenter, ajouter, corriger, refactorer, modifier du code, faire une feature, faire une implémentation, changer le frontend, changer le backend, or otherwise requests a code change, especially when worktrees must be created in `.codenomad/worktree` with names prefixed by `wt-`.
---

# Implementation Worktree Strategy

## Quick start

Before any implementation task:

1. Check the current Git branch.
2. If on `main`, update `main` with `gh pull` and create a worktree from `main`.
3. If on another branch, ask whether to create a worktree.
4. If yes, update `main` and create the worktree from `main`.
5. If no, stay on the current branch.

Create worktrees in `.codenomad/worktree` with names starting with `wt-`.
Rename the session with the worktree name.

## Rules

### If current branch is `main`

- Update `main`.
- Create a worktree from `main`.
- Continue implementation in that worktree.

### If current branch is not `main`

Ask:

`On est sur la branche <branch>. Faut-il créer un worktree depuis main, ou rester sur la branche actuelle ?`

If yes:

- Update `main`.
- Create a worktree from `main` in `.codenomad/worktree`.
- Use a name like `wt-<task-label>`.
- Continue there.

If no:

- Stay on the current branch.
- Continue there.

## Naming

Derive the worktree name from the user's implementation request, not from the full raw prompt and not from the system reminder.

Use this process:

1. Extract a short task label from the main implementation intent.
2. Keep 2 to 5 meaningful words.
3. Convert to lowercase.
4. Replace spaces with `-`.
5. Remove accents, punctuation, and special characters.
6. Prefix with `wt-`.

Examples:

- `implémenter le login Google` -> `wt-google-login`
- `corriger le bug du dashboard` -> `wt-dashboard-bugfix`
- `ajouter un widget météo` -> `wt-weather-widget`

## Scope

Use for implementation requests: feature work, bug fixes, refactors, and code changes.

Do not use for explanation-only, review-only, or docs-only requests.
