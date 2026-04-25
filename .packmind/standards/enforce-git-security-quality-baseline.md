# Enforce Git, Security, and Quality Baseline

## Scope
Monorepo (`apps/*`, `libs/*`).

## When
- Preparing any change for commit or PR.

## Do
- Avoid destructive git commands (`reset --hard`, `checkout --`, etc.).
- Keep commits small and explicit; use Conventional Commits when requested.
- Run targeted Nx checks on impacted projects (`pnpm nx lint <project>`, `pnpm nx test <project>`).
- Never commit secrets (`.env`, API keys, tokens, credentials).

## Why
- Improves delivery safety, review quality, and CI reliability.

## Examples
- Good: run lint/tests for touched projects before opening PR.
- Avoid: committing secrets or skipping basic validation.
