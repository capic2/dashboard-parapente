---
name: Dashboard Parapente
description: A practical weather and flight workspace for paragliding pilots.
colors:
  altitude-blue: "#0284c7"
  altitude-blue-hover: "#0369a1"
  terrain-slate: "#334155"
  cloud-gray: "#f9fafb"
  paper-white: "#ffffff"
  horizon-line: "#e5e7eb"
  flight-green: "#16a34a"
  caution-orange: "#ea580c"
  danger-red: "#dc2626"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
  pill: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.altitude-blue}"
    textColor: "{colors.paper-white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "#f3f4f6"
    textColor: "#374151"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card-neutral:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "1rem"
  input-default:
    backgroundColor: "{colors.paper-white}"
    textColor: "#111827"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
---

# Design System: Dashboard Parapente

## Overview

**Creative North Star: “Le cockpit météo du pilote”**

The interface is a practical, technical cockpit for preparing and reviewing flights. Its visual language keeps changing weather and flight data easy to scan: a clear sky-blue accent marks active choices and primary actions, while restrained slate and gray surfaces keep dense information legible. The same system supports both light and dark themes.

The character is clear, practical, and technical, with a welcoming touch. Cards and controls use familiar shapes and direct state feedback; the interface favors useful hierarchy over decorative treatment.

**Key Characteristics:**
- Sky blue identifies primary actions, active navigation, and weather emphasis.
- Neutral surfaces and slate text organize information in both themes.
- Compact cards support comparison; stronger depth is reserved for prominent panels and overlays.

## Colors

The palette pairs **Bleu d’altitude** with **Ardoise de terrain**, using semantic green, orange, and red only to communicate status.

### Primary
- **Bleu d’altitude**: Primary buttons, active navigation, selected states, links, focus rings, and weather emphasis. Its darker hover and pressed states preserve clear interaction feedback.

### Neutral
- **Ardoise de terrain**: Supporting text, labels, and structural contrast.
- **Cloud gray**: Light page backgrounds and quiet neutral surfaces.
- **Paper white**: Cards, fields, menus, and other raised light-theme surfaces.
- **Horizon line**: Subtle borders that separate adjacent surfaces without dominating them.
- Dark mode uses deep gray and slate surfaces with light text; it retains the same blue accent and semantic status cues.

**The Status-Has-Meaning Rule.** Green, orange, and red communicate outcome or caution. Do not use them as interchangeable decoration.

## Typography

**Display Font:** System sans-serif stack (with platform UI sans-serif fallbacks)
**Body Font:** System sans-serif stack (with platform UI sans-serif fallbacks)

**Character:** A familiar interface sans-serif keeps weather readings, controls, and flight records direct and compact. Headings use the same family with stronger size and weight rather than a separate display face.

### Hierarchy
- **Display:** No distinct display face is established; prominent page headings use the shared sans-serif family.
- **Headline:** Semibold, usually 1.5–2rem with tight leading; identifies a page or major panel.
- **Title:** Semibold, commonly 1–1.25rem; labels cards and functional sections.
- **Body:** Regular, usually 0.875–1rem with comfortable leading; carries descriptions and data context.
- **Label:** Medium, commonly 0.75–0.875rem; supports controls, compact metadata, and status chips.

**The Shared-Family Rule.** Keep the interface in its existing system sans-serif family; use size and weight to create hierarchy.

## Layout

Pages use a centered workspace with a maximum width of approximately 80rem (1280px). The outer page padding is compact on small screens and increases to 1rem at the medium breakpoint. Weather and dashboard sections use responsive flex and grid layouts; multi-column content collapses to fewer columns on narrow screens. Cards commonly use 0.75–1rem internal padding, with 0.5–1rem gaps between related controls and panels. Navigation moves from a wrapping desktop row to a slide-in mobile drawer.

**The Readable-Workspace Rule.** Keep related weather readings together and preserve the responsive collapse of comparison grids instead of shrinking data labels to fit.

## Elevation & Depth

Depth is restrained and hybrid: a fine border and neutral surface do most of the grouping, with light shadows for separation. More noticeable shadows identify selected cards, floating menus, dialogs, and the weather hero. The selected-card treatment may also add a colored border and ring.

### Shadow Vocabulary
- **Resting card:** A minimal shadow for separation from the page.
- **Interactive or selected card:** A stronger shadow paired with a border or focus ring to clarify state.
- **Floating panel:** A pronounced shadow for menus, dialogs, and prominent weather panels.

**The Selective-Depth Rule.** Reserve stronger shadows for priority panels and floating layers; keep routine cards quiet.

## Shapes

Controls and standard cards use gently rounded corners, most often 0.5rem. Larger page headers, weather panels, and feature cards use 0.75–1.5rem corners; chips use a pill silhouette. Borders are thin and low contrast at rest, becoming more apparent for selected, interactive, or error states. Clip decorative overflow within prominent panels.

## Components

### Buttons
- **Character:** Clear, compact controls with familiar touch targets.
- **Shape:** Rounded corners, usually 0.5rem; small and medium sizes provide at least a 2.5rem touch target on narrow screens.
- **Primary:** Sky-blue fill with white text; medium buttons use 1rem horizontal and 0.5rem vertical padding.
- **Hover / Focus:** Darken the fill on hover and press. Keyboard focus uses a visible blue ring with a contrasting offset.
- **Secondary / Ghost / Outline:** Neutral fills, transparent surfaces, or a fine border; keep labels dark in light mode and readable in dark mode.
- **Semantic variants:** Success, warning, danger, purple accent, and cyan variants exist in the shared button component. Use them only when the action or status warrants the color.

### Chips
- **Style:** Compact rounded pills for status, category, or recency, with tinted background and strong, readable text.
- **State:** Use a distinct status color for current/live, stale, caution, and error states; keep the meaning consistent across weather and flight views.

### Cards / Containers
- **Corner Style:** Usually 0.5rem in shared primitives; feature cards commonly use 0.75–1rem.
- **Background:** White or gray surfaces in light mode; layered gray and slate surfaces in dark mode.
- **Shadow Strategy:** Light at rest; stronger for selected or floating content.
- **Border:** Thin neutral border at rest; accent border and ring for selected or focused states.
- **Internal Padding:** Commonly 0.75–1rem, with roomier padding for dialogs and prominent feature panels.

### Inputs / Fields
- **Style:** Full-width white or dark-neutral field, thin neutral border, rounded corners, and compact horizontal padding.
- **Focus:** Blue focus ring and a transparent border shift keep the active field easy to find.
- **Error / Disabled:** Use readable red error text; disabled controls reduce emphasis and block interaction.

### Navigation
- **Style:** Compact sans-serif links in a wrapping desktop row; active destination uses a filled blue background and white text.
- **Hover / Focus:** Neutral hover surface and a visible keyboard ring.
- **Mobile:** Theme control and menu button remain reachable in the header; the navigation opens in a full-height side drawer with generously sized links.

### Weather Hero
- **Character:** A high-contrast blue-to-slate gradient panel gives the selected site and forecast context a clear anchor.
- **Content:** Keep the selected location primary; group date and source details in compact translucent tiles. On mobile, preserve a two-column metadata arrangement.
- **Depth and shape:** Prominent shadow and large rounded corners distinguish the hero from routine data cards.

## Do's and Don'ts

### Do:
- **Do** use the altitude blue for the primary action, active route, selected state, and visible keyboard focus.
- **Do** keep text and data contrast strong in both light and dark themes.
- **Do** give interactive controls clear hover, focus, pressed, and disabled states.
- **Do** use semantic status colors consistently and pair color with text or an icon.
- **Do** preserve responsive layouts and mobile touch targets.

### Don't:
- **Don't** introduce a second display typeface or a competing brand accent without an explicit visual-system decision.
- **Don't** give routine cards the same shadow weight as a dialog or feature hero.
- **Don't** use status colors as decoration or rely on color alone to communicate a state.
- **Don't** remove dark-theme treatments when extending shared components.
