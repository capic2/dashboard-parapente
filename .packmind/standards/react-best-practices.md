# React Best Practices

This standard covers high-impact React patterns around effects, concurrency, async work, state ownership, rendering performance, input handling, and boundaries between UI and side effects.

## Rules

* Guard async effects with AbortController and ignore stale responses before setting state.
* Specify complete Hook dependency arrays and extract stable callbacks with useCallback or inline them inside the effect.
* Memoize Context provider values and callbacks; avoid passing freshly created objects/functions as Context value.
* Keep derived data out of state; compute via useMemo or inline expressions from the source state and props.
* Normalize list keys to stable identifiers; avoid array index, Math.random(), or object references as keys.
* Prefer functional state updates when next state depends on previous state; avoid reading stale state from closures.
* Wrap event handlers and effects with consistent error routing; avoid unhandled promise rejections from async handlers.
* Isolate non-serializable resources in refs or module singletons; avoid storing AbortController, WebSocket, or timers in React state.
* Sanitize untrusted HTML before using dangerouslySetInnerHTML; avoid rendering raw user-provided HTML strings.
* Define ErrorBoundary and Suspense boundaries near feature edges; avoid a single top-level boundary that obscures failing component context.
