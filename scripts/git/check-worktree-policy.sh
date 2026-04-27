#!/bin/sh
set -eu

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_NAME="$(basename "$REPO_ROOT")"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if ! printf '%s' "$WORKTREE_NAME" | grep -Eq '^wt-.+'; then
  cat <<EOF
ERROR: worktree name policy violation.
- Current worktree: $WORKTREE_NAME
- Expected pattern: wt-<branch-or-pr-id>

Create a dedicated PR worktree from origin/main, for example:
  git fetch origin
  git worktree add ../wt-my-feature -b my-feature origin/main
EOF
  exit 1
fi

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  cat <<EOF
ERROR: branch policy violation.
- Current branch: $CURRENT_BRANCH

Use a dedicated feature branch in the PR worktree.
EOF
  exit 1
fi

if ! git rev-parse --verify --quiet refs/remotes/origin/main >/dev/null; then
  cat <<EOF
ERROR: missing local reference to origin/main.

Run:
  git fetch origin main
EOF
  exit 1
fi

if ! git merge-base --is-ancestor origin/main HEAD; then
  cat <<EOF
ERROR: branch is not based on origin/main.

Recreate your worktree from origin/main or rebase before committing:
  git fetch origin
  git rebase origin/main
EOF
  exit 1
fi

echo "OK: worktree policy check passed ($WORKTREE_NAME / $CURRENT_BRANCH)."
