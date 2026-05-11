---
name: ship
description: Delegates repository shipping to the lightweight ship subagent so it can commit relevant changes, push the branch, and open a GitHub pull request. Use when the user explicitly asks to ship changes, commit and push, publish a branch, or create/open a PR.
---

# Ship

## Rule

This skill must not perform shipping directly in the main agent.

When this skill is triggered, immediately launch a `ship` subagent and give it the complete shipping instructions. Use the smallest or cheapest available OpenAI execution path for that subagent when model selection is exposed by the runtime. If model selection is not exposed, use the lightweight `ship` subagent type.

## Subagent Invocation

Launch a subagent with:

- `subagent_type`: `ship`
- Working directory: current repository or worktree
- Goal: create a commit, push the current branch, and open a PR
- Context: user request, current branch/worktree path, validation already run, and any preferred PR title/body

The main agent should not inspect every diff in detail unless the subagent reports a blocker that requires help.

## Instructions For The Subagent

Give the subagent these instructions:

1. Inspect Git state with `git status`, unstaged diff, staged diff, and recent log.
2. Refuse to ship from `main`.
3. Refuse to commit secrets, credentials, `.env` files, or unrelated dirty files.
4. Stage only relevant files for the requested shipment.
5. Create a Conventional Commit that reflects the actual diff.
6. Push the branch, using upstream setup only when needed.
7. Open a PR with `gh pr create`.
8. Return a concise report with commit SHA, branch, PR URL, validation status, blockers, and warnings.

## Guardrails

- Never force-push.
- Never use destructive Git commands.
- Never use `--no-verify` unless the user explicitly requested it.
- Never amend unless the user explicitly requested it and it is safe.
- Never push directly to `main`.
- If checks are missing or failing, report the blocker instead of opening a PR unless the user explicitly wants to proceed.
- Use `gh` for all GitHub interactions.

## Report Format

Successful report:

```text
Shipped successfully.

- Commit: <sha>
- Branch: <branch>
- PR: <url>
- Validation: <commands/status>
```

Blocked report:

```text
Shipping blocked.

- Reason: <reason>
- Branch/status: <summary>
- Required next step: <action>
```
