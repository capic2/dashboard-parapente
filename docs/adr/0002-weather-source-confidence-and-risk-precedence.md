# Weather Source Confidence and Risk Precedence

The weather model separates **Sources de Prevision** from **Sources d'Observation** because forecasts build the future weather basis while live observations only confirm or contradict the current hour. Adding more sources should improve **Confiance Meteo** and **Decision de Vol**, but source count alone is not precision: confidence must account for freshness, reliability, local resolution, field completeness, and configured priority.

Blocking risks follow the most cautious credible signal instead of being diluted by optimistic averages. Experimental or fragile sources can be enabled and shown to the pilot, but they may only alert or lower confidence until they are considered reliable; they must not create a blocking risk by themselves.

The rejected alternative is a simple average across every enabled source. That would make the system look more precise as source count grows, while allowing weak or stale sources to hide important wind, gust, rain, or live-observation discrepancies.
