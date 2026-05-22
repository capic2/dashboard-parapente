---
name: open-webstorm-worktree
description: Opens JetBrains WebStorm in a new window on the current workspace or git worktree. Use when the user asks to open WebStorm, open the IDE, or open the current worktree in WebStorm.
---

# Open WebStorm Worktree

Open the current working directory in WebStorm, preferring a new IDE window.

## Quick Start

Run this from the current workspace or worktree:

```bash
webstorm --new-window "$PWD"
```

## Workflow

1. Determine the current directory with `pwd`.
2. If the `webstorm` launcher is available, run `webstorm --new-window "$PWD"`.
3. If the launcher is unavailable on macOS, run `open -na "WebStorm" --args "$PWD"`.
4. If that does not open the expected folder, run `open -a "WebStorm" "$PWD"` as a final fallback.
5. If all commands fail, explain that the JetBrains command-line launcher may need to be enabled from WebStorm or JetBrains Toolbox.

## Rules

- Do not change directory before opening WebStorm.
- Use the current workspace or worktree exactly as provided by the session.
- Do not create or modify project files for this task.
- Prefer a new WebStorm window over reusing an existing one.
