# Run CI Parity Checks Locally

Reproduce the main CI validation pipeline in one local pass so failures are caught before pushing or opening a PR.

## When to Use

- Before opening a pull request
- After changing CI-sensitive areas like frontend/backend lint, test, or build behavior
- When CI fails and you want fast local reproduction

## Checkpoints

- Are Node and Python dependencies installed in the repo root and backend folder?
- Is `pnpm-lock.yaml` up to date with installed dependencies?
- Are required environment variables available for test-only backend execution?

## Steps

### 1. Prepare local dependencies

Install package dependencies for both app stacks.

```bash
pnpm install --frozen-lockfile
cd apps/backend && python -m pip install -r requirements.txt && cd ..
```

### 2. Run the CI-equivalent Nx verification set

Execute build/lint/type-check/test together, matching the CI command shape used in the main workflow.

```bash
pnpm exec nx affected -t build,lint,type-check,test --parallel=5 --exclude=e2e
```

### 3. Validate E2E locally with same flags as CI

Run the E2E command that CI uses, including `--skipInstall` where configured in CI.

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm exec nx e2e e2e --configuration=ci --skipInstall
```

### 4. Run backend checks similar to CI setup

Run targeted pytest command shapes aligned with CI Python test intent.

```bash
cd apps/backend
pytest tests/ -m "not integration and not slow" -v --tb=short --cov=. --cov-report=term-missing --cov-report=xml --cov-fail-under=40
cd ..
```

### 5. Capture coverage artifacts if needed

Use the same artifact naming if your local CI diagnostics rely on generated coverage outputs.
