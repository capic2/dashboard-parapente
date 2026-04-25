# Keep Chromatic Config in Sync

## Scope
Frontend Storybook (`apps/frontend/**`).

## When
- Stories are added, renamed, moved, or restructured.

## Do
- Update `apps/frontend/chromatic.config.json` when needed.
- Verify new/changed stories are covered by Chromatic workflow.

## Why
- Keeps visual regression coverage complete in PRs.

## Examples
- Good: story structure and Chromatic config updated in the same change.
- Avoid: shipping story changes without Chromatic coverage.
