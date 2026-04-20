# Packmind Commands Index

This file contains all available coding commands that can be used by AI agents (like Cursor, Claude Code, GitHub Copilot) to find and use proven patterns in coding tasks.

## Available Commands

- [Check repo status](commands/check-repo-status.md) : Check repository status by inspecting git changes and dependency install state to quickly confirm you’re in the right project and ready to work before making changes or debugging unexpected behavior.
- [Create shared pytest fixture command.draft](commands/create-shared-pytest-fixture-commanddraft.md) : Extract repeated test payloads into shared JSON-backed pytest fixtures exposed via a common conftest.py to reduce duplication and improve consistency when multiple backend tests reuse the same domain entities or API/DB data.
- [Run ci parity locally.draft](commands/run-ci-parity-locallydraft.md) : Run CI parity checks locally by installing dependencies and executing the same build/lint/type-check/unit/E2E and backend pytest commands as the main pipeline to catch failures early and speed debugging before pushing a commit, opening a PR, or investigating a CI-only failure.
- [Run full test cycle](commands/run-full-test-cycle.md) : Run the full local dashboard-parapente validation pipeline—install dependencies, execute frontend/backend tests, run E2E smoke checks, and build production artifacts—to catch integration issues early and ensure release-ready confidence before merging, after model changes, or when validating a release candidate.
- [Run quality check](commands/run-quality-check.md) : Run Nx linting, formatting/type checks, tests, and builds locally to catch quality issues early and reproduce CI failures quickly before opening a pull request or committing feature-branch changes.
- [Sync storybook chromatic stories.draft](commands/sync-storybook-chromatic-storiesdraft.md) : Sync `.chromatic.stories.tsx` wrappers with their corresponding `*.stories.tsx` exports to keep Chromatic visual regression snapshots complete and consistently labeled when adding, renaming, or refactoring Storybook stories in UI PRs.


---

*This file was automatically generated from deployed command versions.*