# Check repository status

Generate a quick snapshot of repository state before starting work.

## When to Use
- At the start of any task before making changes
- Before debugging unexpected behavior in the repository

## Context Validation Checkpoints
- Are we inside the intended project directory?
- Do we have write access to the workspace?

## Steps

### 1. Show git status
Display modified, staged, and untracked files.

```bash
git status --short
```

### 2. Show package and install state
Check installed packages and available local artifacts.

```bash
packmind-cli install --status
```

### 3. Summarize outcome
Conclude with a short status report and next suggested action.
