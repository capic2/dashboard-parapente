---
description: Validate, commit, push, and open a pull request for the current branch.
agent: build
model: openai/gpt-5.4-mini-fast
---

Ship the current branch or worktree.

Follow the dashboard-parapente workflow and these guardrails:

- Inspect Git state with `git status`, unstaged diff, staged diff, and recent log before changing anything.
- Refuse to ship from `main`.
- Refuse to commit secrets, credentials, `.env` files, or unrelated dirty files.
- Stage only files relevant to the requested shipment.
- Run impacted validation before committing. Prefer targeted Nx checks; for PR validation prefer `NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t build,lint,type-check,test --parallel=5 --exclude=e2e` when appropriate.
- For frontend changes, run `NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint frontend`, `NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t test frontend --parallel=5`, and `NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx build frontend`.
- For backend changes, run `NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint backend` and `NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t test backend --parallel=5`.
- Run the `coderabbit-cli` skill before committing or pushing, unless the user explicitly asks to skip CodeRabbit review.
- Create a Conventional Commit that reflects the actual diff.
- Push the branch, using upstream setup only when needed.
- Open a PR with `gh pr create` after fetching the remote and ensuring the branch is not stale against `origin/main`.
- Never force-push.
- Never use destructive Git commands.
- Never use `--no-verify` unless the user explicitly requested it.
- Never amend unless the user explicitly requested it and it is safe.
- Never push directly to `main`.
- If checks are missing or failing, ask the main agent to fix the failing checks and rerun validation before committing or opening a PR. Only report a blocker if the main agent cannot fix the failure or needs user input. Do not open a PR with failing checks unless the user explicitly wants to proceed.
- Use `gh` for all GitHub interactions.

Return a concise report with commit SHA, branch, PR URL, validation status, blockers, and warnings.
