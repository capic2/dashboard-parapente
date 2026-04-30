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

For the full repository lint, prefer disabling Nx Cloud noise and use a long timeout.

Bash tool settings:

- `workdir`: `/media/nas/usb2/developement/moi/dashboard-parapente`
- `timeout`: `360000`

Command:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm lint
```

Equivalent direct Nx command:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx run-many -t lint --all
```

When output is very large, verify success with the exit code:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm lint >/tmp/dashboard-parapente-lint.log 2>&1; status=$?; printf 'lint_exit_code=%s\n' "$status"; exit "$status"
```

## Targeted Nx Commands

Use targeted commands when only one project is impacted:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx lint frontend
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx lint backend
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx lint design-system
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx lint shared-types
```

For direct Oxlint checks on frontend/design-system:

```bash
/home/capic/.local/share/pnpm/pnpm exec oxlint -c .oxlintrc.json apps/frontend/src
/home/capic/.local/share/pnpm/pnpm exec oxlint -c .oxlintrc.json libs/design-system/src
```

## Tests And Build

Use the same pnpm binary and disable Nx Cloud if running through Nx:

```bash
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm test
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm build
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx test frontend
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx build frontend
NX_NO_CLOUD=true /home/capic/.local/share/pnpm/pnpm nx test backend
```

Use a longer Bash timeout for full-repo tasks:

- lint: `360000`
- test: `360000` or higher if e2e/browser tests are involved
- build: `360000`

## Notes

Lint can produce many warnings while still succeeding. Treat the process exit code as authoritative for pass/fail.

If a command creates temporary build artifacts such as `*.tsbuildinfo`, remove untracked generated artifacts unless they are intentionally part of the task.
