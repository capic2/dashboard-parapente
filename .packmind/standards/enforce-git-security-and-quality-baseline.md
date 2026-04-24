# Enforce Git, Security, and Quality Baseline

## Scope

Monorepo (`apps/*`, `libs/*`).

## When

* Preparing any change for commit or PR.

## Rules

* Use a dedicated `git worktree` per pull request.
* Name each worktree with the `wt-<branch-or-pr-id>` prefix pattern.
* Create the PR worktree from `main` (prefer `origin/main` after `git fetch`) unless a documented repository policy requires another base branch.
* Install dependencies in the PR worktree before running lint, tests, builds, or reproduction steps.
* Required baseline before quality checks:
  * Run `pnpm install` at repository root.
  * If backend Python commands are needed, install backend dependencies (`python3 -m pip install -r apps/backend/requirements.txt` or project equivalent).
* Run required validation checks in the same worktree before merge.
* If a PR includes CodeRabbit review comments and you implement fixes for them, mark each addressed CodeRabbit conversation thread as resolved.
* Si une PR contient des commentaires de review CodeRabbit et que vous les corrigez, marquez chaque conversation CodeRabbit traitée comme résolue.
* Remove the PR worktree once the pull request is merged or closed, then run `git worktree prune`.
* Do not remove a worktree while active processes are still running inside it.
* Do not use destructive Git commands (`reset --hard`, `checkout --`, force push) unless explicitly requested and approved.
* Never commit secrets (`.env`, tokens, API keys, credentials) or expose sensitive values in logs.
* Run lint and tests on impacted projects before finalizing commit/PR.
