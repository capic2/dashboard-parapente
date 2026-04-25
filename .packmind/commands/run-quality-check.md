# Run quality checks

Run the project quality gates before committing code.

## When to Use
- Before opening a pull request
- After implementing a feature branch change
- When CI failures need fast local reproduction

## Context Validation Checkpoints
- Are dependencies installed in the project root?
- Is Node.js version compatible with Nx tooling in this project?

## Steps

### 1. Run linting
Execute frontend and backend lint checks.

```bash
pnpm nx lint frontend && pnpm nx lint backend
```

### 2. Run unit tests
Run frontend and backend unit tests.

```bash
pnpm nx test frontend --skip-nx-cache && pnpm nx test backend --skip-nx-cache
```

### 3. Run build checks
Ensure both apps still build.

```bash
pnpm nx build frontend --skip-nx-cache && pnpm nx build backend --skip-nx-cache
```

### 4. Optional repo-wide baseline checks
Run full monorepo lint and tests before finalizing PR.

```bash
pnpm lint && pnpm test
```
