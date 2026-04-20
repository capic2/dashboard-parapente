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
nx lint frontend && nx lint backend
```

### 2. Run formatting and typing checks
Verify style and types.

```bash
npm run -s lint && npm run -s type-check
```

### 3. Run tests
Run unit tests for changed areas.

```bash
nx test frontend --skip-nx-cache && nx test backend --skip-nx-cache
```

### 4. Run build checks
Ensure both apps still build.

```bash
nx build frontend --skip-nx-cache && nx build backend --skip-nx-cache
```
