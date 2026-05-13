---
name: local-machine-stack
description: Documents the local machine setup for this Nx monorepo, including the absolute pnpm binary path and validated commands for lint, tests, builds, and targeted Nx tasks. Use when working in this repository and the user asks to run local commands, lint/test/build the repo, diagnose command availability, or use pnpm/Nx on this machine.
---

# Local Machine Stack

## Quick Start

Use this pnpm binary on this machine:

```bash
/home/capic/.local/share/pnpm/pnpm
```

Do not assume `pnpm`, `npm`, `npx`, `yarn`, or `corepack` are available in `PATH`.

Before running Nx commands, verify local dependencies exist. If `node_modules/.bin/nx` or required packages such as `typescript` are missing, run:

```bash
CI=true /home/capic/.local/share/pnpm/pnpm install --frozen-lockfile
```

For new worktrees, prefer the `worktree-bootstrap` subagent to perform this dependency readiness check in parallel with implementation work. The subagent should only run install when dependencies are missing or unusable.

Do not enable pnpm's global virtual store in this repository. Nx and Knip expect dependency resolution from the workspace-local `node_modules` layout, and CI can fail when packages resolve through a global virtual store path.

## Repository

Workspace root:

```bash
/media/nas/usb2/developement/moi/dashboard-parapente
```

This is an Nx monorepo with these main projects:

- `frontend`
- `backend`
- `design-system`
- `shared-types`

## Lint

For Nx lint tasks, prefer `affected`, disable Nx Cloud noise, and use a long timeout.

Bash tool settings:

- `workdir`: `/media/nas/usb2/developement/moi/dashboard-parapente`
- `timeout`: `360000`

Command:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint --parallel=5 --exclude=e2e
```

Only use a full-repo direct Nx command when affected detection is explicitly inappropriate:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx run-many -t lint --all
```

When output is very large, verify success with the exit code:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm lint >/tmp/dashboard-parapente-lint.log 2>&1; status=$?; printf 'lint_exit_code=%s\n' "$status"; exit "$status"
```

## Affected Nx Commands

Use affected commands for Nx validation, even when only one project appears impacted:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t lint --parallel=5 --exclude=e2e
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t test --parallel=5 --exclude=e2e
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t build --parallel=5 --exclude=e2e
```

Use direct project targets such as `nx affected lint frontend` or `nx affected test backend` only as follow-up diagnostics after an affected run identifies a failing project, or when explicitly requested.

For direct Oxlint checks on frontend/design-system:

```bash
/home/capic/.local/share/pnpm/pnpm exec oxlint -c .oxlintrc.json apps/frontend/src
/home/capic/.local/share/pnpm/pnpm exec oxlint -c .oxlintrc.json libs/design-system/src
```

## Tests And Build

Use the same pnpm binary and disable Nx Cloud if running through Nx:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t build,lint,type-check,test --parallel=5 --exclude=e2e
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t test --parallel=5 --exclude=e2e
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx affected -t build --parallel=5 --exclude=e2e
```

Use a longer Bash timeout for full-repo tasks:

- affected: `360000`
- lint: `360000`
- test: `360000` or higher if e2e/browser tests are involved
- build: `360000`

## Notes

Lint can produce many warnings while still succeeding. Treat the process exit code as authoritative for pass/fail.

If a command creates temporary build artifacts such as `*.tsbuildinfo`, remove untracked generated artifacts unless they are intentionally part of the task.

Keep `enableGlobalVirtualStore: false` in `pnpm-workspace.yaml` so workspace tools resolve dependencies from local project links.
