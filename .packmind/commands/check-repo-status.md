# Check repository status

Generate a quick snapshot of repository state before starting work.

## When to Use
- At the start of any task before making changes
- Before debugging unexpected behavior in the repository
- Before preparing a commit or opening a pull request

## Context Validation Checkpoints
- Are we inside the intended project directory?
- Do we have write access to the workspace?
- Are we in a dedicated PR worktree named `wt-<branch-or-pr-id>`?

## Steps

### 1. Show git status
Display modified, staged, and untracked files.

```bash
git status --short
```

### 2. Validate worktree naming and isolation
Confirm this branch runs in a dedicated worktree and follows naming rules.

```bash
git worktree list
CURRENT_WT="$(basename "$(git rev-parse --show-toplevel)")"
echo "$CURRENT_WT" | grep -E '^wt-.+'
```

### 3. Validate worktree base against `origin/main`
Confirm branch ancestry matches the baseline standard.

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD && echo "OK: HEAD includes origin/main"
```

### 4. Show package and install state
Check installed packages and available local artifacts.

```bash
packmind-cli install --status
```

### 5. Summarize outcome
Conclude with a short status report and next suggested action.
