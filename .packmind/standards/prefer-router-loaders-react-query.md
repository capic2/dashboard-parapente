# Prefer Router Loaders + React Query

## Scope
Frontend (`apps/frontend/**`).

## When
- A route needs server data.
- A page currently fetches data directly in a component.

## Do
- Fetch route-level data with TanStack Router loaders.
- Use React Query for caching, synchronization, retries, and server state lifecycle.
- Keep component bodies focused on rendering and interactions.

## Why
- Improves consistency of loading and error handling.
- Reduces duplicated data-fetching logic.

## Examples
- Good: loader prefetches query; component consumes query state.
- Avoid: `useEffect` + manual fetch in page components when loader/query is suitable.
