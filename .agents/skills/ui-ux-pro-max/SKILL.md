---
name: ui-ux-pro-max
description: Provides UI/UX design intelligence for web and mobile interfaces, including design systems, visual styles, palettes, typography, UX heuristics, charts, accessibility, and stack-specific implementation guidance. Use when designing, implementing, reviewing, polishing, or fixing UI/UX, frontend screens, landing pages, dashboards, forms, navigation, responsive layouts, dark/light mode, charts, or visual design.
---

# UI/UX Pro Max

Use this skill for concrete UI/UX work: design systems, frontend screens, visual polish, responsive behavior, accessibility, charts, landing pages, dashboards, forms, navigation, and stack-specific implementation guidance.

## Required Workflow

1. Extract the request context before searching: product type, industry, style keywords, target surface, and stack. Use the user's stack, otherwise default to `html-tailwind`.

2. Generate a design system first. Do this before implementation or critique:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<product industry style keywords>" --design-system -p "<Project Name>"
```

3. Persist the design system when the work spans multiple pages, sessions, or future reuse:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>"
```

4. Add a page override when a page needs rules that differ from the master system:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>" --page "<page>"
```

5. For a persisted project, check `design-system/<project-slug>/pages/<page>.md` first. Page rules override `MASTER.md`; otherwise follow `MASTER.md`.

6. Supplement with focused searches only when needed:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "real-time dashboard" --domain chart
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "elegant luxury serif" --domain typography
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "lucide navigation" --domain icons
```

7. Get stack-specific guidance before coding UI details:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "layout responsive forms" --stack html-tailwind
```

## Search Reference

Available domains: `product`, `style`, `typography`, `color`, `landing`, `chart`, `ux`, `icons`, `react`, `web`.

Available stacks: `html-tailwind`, `react`, `nextjs`, `astro`, `vue`, `nuxtjs`, `nuxt-ui`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `jetpack-compose`.

## Implementation Rules

- Avoid generic AI-looking layouts; choose a clear visual direction from the generated design system.
- Preserve any existing product design system unless the user explicitly asks for a redesign.
- Use SVG icons from a consistent library such as Lucide, Heroicons, or Simple Icons; do not use emoji as UI icons.
- Verify brand logos from an official source or Simple Icons; do not approximate logo paths.
- Keep icon sizes consistent with fixed viewBox and utility sizes.
- Add `cursor-pointer` to clickable cards, buttons, tabs, and controls.
- Provide visible hover, active, disabled, and keyboard focus states.
- Avoid hover transforms that shift layout; prefer color, border, opacity, or shadow transitions.
- Keep transitions between 150ms and 300ms unless the interaction clearly requires otherwise.
- Ensure light mode contrast is readable; do not use low-opacity glass surfaces that disappear on light backgrounds.
- Ensure dark mode borders, surfaces, and muted text remain distinguishable.
- Account for fixed and floating navigation so content is not hidden behind it.
- Use consistent container widths and spacing rhythm across sections.
- Respect `prefers-reduced-motion` for animated or parallax effects.

## Delivery Checklist

Before delivery, verify:
- No emoji icons are used as production UI icons.
- Clickable elements have `cursor-pointer` and clear feedback.
- Focus states are visible for keyboard navigation.
- Light and dark modes have sufficient text, surface, and border contrast.
- Responsive layouts work at approximately 375px, 768px, 1024px, and 1440px.
- There is no horizontal scroll on mobile.
- Images have useful `alt` text.
- Form inputs have labels or accessible names.
- Color is not the only indicator of state.
- Motion respects `prefers-reduced-motion`.
