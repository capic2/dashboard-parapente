# Require Self-Review for Agent-Produced Code

## Scope
Monorepo (`apps/*`, `libs/*`).

## When

* Any code change is produced or modified by an AI agent.

## Rules

* Before finalizing, run a self-review over changed files to identify simplifications, edge cases, consistency issues, and missing tests.
* If issues are found during self-review, fix them in the same change set when in scope.
* In the final handoff, include a concise "Self-review" note describing what was checked and what was improved.
