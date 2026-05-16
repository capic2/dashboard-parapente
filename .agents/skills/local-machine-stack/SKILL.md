---
name: local-machine-stack
description: Documents the local machine setup for this Nx monorepo, including the absolute pnpm binary path and validated commands for lint, tests, builds, and targeted Nx tasks. Use when working in this repository and the user asks to run local commands, lint/test/build the repo, diagnose command availability, or use pnpm/Nx on this machine.
---

# Local Machine Stack

## Quick Start

Run repository commands from the active checkout or worktree root. Use this pnpm binary on this machine:

```bash
/home/capic/.local/share/pnpm/pnpm
```

Do not assume `pnpm`, `npm`, `npx`, `yarn`, or `corepack` are available in `PATH`.

Before Nx commands, verify local dependencies exist. If `node_modules/.bin/nx` or required packages such as `typescript` are missing, run:

```bash
CI=true /home/capic/.local/share/pnpm/pnpm install --frozen-lockfile
```

For new worktrees, prefer the `worktree-bootstrap` subagent for this readiness check. It should only run install when dependencies are missing or unusable.

Do not enable pnpm's global virtual store in this repository. Nx and Knip expect dependency resolution from the workspace-local `node_modules` layout, and CI can fail when packages resolve through a global virtual store path.

## Repository

This is an Nx monorepo. Main projects:

- `frontend`
- `backend`
- `design-system`
- `shared-types`

## Validation Commands

For Nx tasks, prefer `affected`, disable Nx Cloud noise, and use Bash timeout `360000` or higher.

Full implementation and PR validation:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t build,lint,type-check,test --parallel=5 --exclude=e2e
```

Individual affected targets:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint --parallel=5 --exclude=e2e
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t test --parallel=5 --exclude=e2e
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t build --parallel=5 --exclude=e2e
```

Only use full-repo direct Nx commands when affected detection is explicitly inappropriate:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx run-many -t lint --all
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx run-many -t test --all
```

Use direct project targets such as `nx affected -t lint frontend` or `nx affected -t test backend` only as follow-up diagnostics after an affected run identifies a failing project, or when explicitly requested.

For direct Oxlint checks on frontend/design-system:

```bash
/home/capic/.local/share/pnpm/pnpm exec oxlint -c .oxlintrc.json apps/frontend/src
/home/capic/.local/share/pnpm/pnpm exec oxlint -c .oxlintrc.json libs/design-system/src
```

Use longer Bash timeouts for full-repo tasks:

- affected: `360000`
- lint: `360000`
- test: `360000` or higher if e2e/browser tests are involved
- build: `360000`

## Notes

Lint can produce many warnings while still succeeding. Treat the process exit code as authoritative for pass/fail.

When output is very large, redirect logs and print the exit code.

If a command creates temporary build artifacts such as `*.tsbuildinfo`, remove untracked generated artifacts unless they are intentionally part of the task.

Keep `enableGlobalVirtualStore: false` in `pnpm-workspace.yaml` so workspace tools resolve dependencies from local project links.
