# Run full test cycle

Run the complete local validation pipeline for dashboard-parapente.

## When to Use
- Before merging to main
- After backend or frontend model changes
- When validating a release candidate locally

## Context Validation Checkpoints
- Are all required services (Redis, database) available?
- Are environment variables configured for test execution?

## Steps

### 1. Install dependencies
Install missing dependencies before running tests.

```bash
pnpm install --frozen-lockfile
```

### 2. Run test suites
Execute both frontend and backend tests.

```bash
pnpm nx test frontend --skip-nx-cache && pnpm nx test backend --skip-nx-cache
```

### 3. Run end-to-end checks
Execute lightweight E2E smoke command if available.

```bash
pnpm nx e2e e2e --skip-nx-cache
```

### 4. Run production build
Compile production artifacts.

```bash
pnpm nx build frontend --configuration=production --skip-nx-cache && pnpm nx build backend --skip-nx-cache
```

### 5. Summarize outcome
Report pass/fail state and list failing commands if any.
