# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily one paragliding pilot using a personal dashboard to check flying conditions and manage their own flights.

## Product Purpose

Dashboard Parapente brings paragliding weather decisions and personal flight records into one web app. Success means the pilot can assess conditions for flying sites, then review their flights and related telemetry or media in the same place.

## Positioning

The product combines aggregated site weather and a paragliding-specific Para-Index with flight history, analytics, telemetry, and video workflows. Its distinction is the connected weather-to-flight record workflow for an individual pilot.

## Operating Context

- Compare weather and flying conditions across takeoff sites and forecast times.
- Review, organize, and analyze personal flights, including GPS and telemetry data.
- Manage generated flight media and optional YouTube integration.

## Capabilities and Constraints

- The frontend includes site weather and forecasts, a Para-Index, best-site recommendations, live wind and airspace information, flight records and analytics, telemetry views, and flight-media workflows.
- The app has authenticated routes and supports French and English.
- Preserve the calibration player and protected GPX/OSV synchronization behavior, including the GPX origin and combined automatic/manual offset contract. Changes to these require explicit authorization for the relevant task.
- The documented forecast accuracy and safety guarantees are undecided; future work must not imply that forecasts or the Para-Index guarantee safe flying.

## Brand Commitments

- Product name: Dashboard Parapente.
- The interface currently supports French and English. No additional voice or brand rules have been established.

## Evidence on Hand

- Existing frontend routes and workflows are the product evidence: `apps/frontend/src/routes/` and `apps/frontend/src/pages/`.
- The privacy page documents account data, flight information, GPS files, and user-imported or generated videos: `apps/frontend/src/routes/privacy.tsx`.
- Do not fabricate testimonials, customer counts, forecast accuracy figures, or performance claims.

## Product Principles

- Keep weather decisions and personal flight records connected in one pilot workflow.
- Make weather information specific to paragliding sites and flying conditions.
- Keep the pilot's flight history and related telemetry useful for later review.
- Preserve established calibration and telemetry alignment behavior.
