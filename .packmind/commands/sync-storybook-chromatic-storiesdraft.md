# Sync Storybook and Chromatic Story Files

Create and maintain `.chromatic.stories.tsx` files whenever Storybook stories are added or changed, so visual regression coverage stays aligned.

## When to Use

- Adding a new `*.stories.tsx` file
- Renaming or removing exports in existing Storybook stories
- Seeing Chromatic drift due to missing or outdated snapshots
- Preparing a PR that touches front-end UI coverage

## Checkpoints

- Do the impacted components/pages already have one `.chromatic.stories.tsx` file?
- Are all intended base stories imported and rendered as snapshots?
- Does the base story still export the same story names as before the refactor?

## Steps

### 1. Enumerate paired stories

For each modified `*.stories.tsx`, ensure there is one `*.chromatic.stories.tsx` next to it.

```bash
ls apps/frontend/src/{components,pages}/**/*.stories.tsx
ls apps/frontend/src/{components,pages}/**/*.chromatic.stories.tsx
```

### 2. Update import mapping

Keep Chromatic files importing only existing story exports from the source story file (for example `Default`, `Loading`, `EmptyState`).

### 3. Refactor Chromatic file to wrap source stories

Use `FigureWrapper` blocks and `story.composed.name` to preserve consistent snapshot labels.

```tsx
import { FigureWrapper } from '../../../.storybook/FigureWrapper.tsx';
import { Default, EmptyState } from './FlightHistory.stories.tsx';

export const FlightHistoryChromatic = preview.meta({
  title: 'Pages/FlightHistory/Chromatic',
  tags: ['!autodocs'],
}).story({
  render: () => (
    <div className="flex flex-col gap-2">
      <FigureWrapper title={Default.composed.name}>
        <Default.Component />
      </FigureWrapper>
      <FigureWrapper title={EmptyState.composed.name}>
        <EmptyState.Component />
      </FigureWrapper>
    </div>
  ),
});
```

### 4. Run visual check

Run the local storybook build path used in CI and validate Chromatic snapshots for changed stories.
