# Backend as Source of Truth for Decision de Vol

The **Decision de Vol** is calculated by the backend and exposed through a dedicated `flight-decision` API rather than being assembled inside frontend components or folded into the generic weather endpoint. This keeps weather decision rules, risk precedence, configurable thresholds, and future tests in one place, while the frontend remains primarily responsible for presenting the structured recommendation returned by the API.

The API returns both a decision summary and an analyzed hourly breakdown. The frontend should receive ready-to-display levels, scores, risks, confidence, wind-orientation analysis, landing safety, and optional alternative sites instead of recalculating those concepts from raw weather data.

Decision levels are returned as stable French domain API codes without accents (`favorable`, `vigilance`, `limite`, `deconseille`, `unavailable`) with translation keys, not translated labels. The backend remains the source of truth for the chosen level, while the frontend is responsible only for localization. `unavailable` means the backend cannot produce a reliable decision from the available data; it is not the same as a discouraged flight window.

Risks and reasons are returned as structured diagnostics with stable codes, severities, translation keys, parameters, and optional affected periods. The backend identifies the risk and its severity; the frontend translates and presents it without reinterpreting the weather data.

Decision levels and risk severities are separate concepts. Decision levels use `favorable`, `vigilance`, `limite`, `deconseille`, and `unavailable`; risk severities use `info`, `vigilance`, `limiting`, and `blocking`.

The final level for a time window is resolved with a hybrid rule: blocking risks prevent `favorable` and `vigilance`, limiting risks prevent `favorable`, vigilance risks require visible caution, and the numeric score is used only after those risk constraints are applied.

Recommended flight windows group consecutive hourly decisions whose level is `favorable` or `vigilance`. A single acceptable hour is enough to form a recommended window. The displayed level for the grouped window is the most cautious level inside the group, and the displayed score is the minimum hourly score in that group.

When several recommended windows exist, the primary window is selected by best decision level first, then highest minimum score, then longest duration. For the current day, past windows are ignored; ties prefer the nearest upcoming window.

For the current day, the hourly analysis may include past hours marked as past, but the summary must not recommend a past window. If all good windows are already past, the summary should say that no recommended window remains and may show the best past window for awareness.

Decision times are expressed in the current canonical app timezone, `Europe/Paris`, and the API should make that timezone explicit in its response.

Live SpotAiR wind is initially treated as a confidence modifier and discrepancy alert, not as a direct blocking source for the Decision de Vol. If nearby live readings strongly contradict the forecast, the backend should expose that discrepancy so the frontend can warn the pilot and lower confidence.

SpotAiR influence on confidence is weighted by station distance: readings within 5 km have strong influence, readings from 5 to 10 km have moderate influence, and farther readings are informational only unless the configured live-wind search radius is lower.

Alternative sites are returned only when they are clearly better than the selected site: either a better decision level or the same level with a minimum window score at least 15 points higher. At most three alternatives are shown, and they remain secondary to the selected site's decision.

Missing data degrades the decision according to its criticality. Missing hourly weather makes the decision unavailable or discouraged; missing decollage orientation or associated landing data creates vigilance and lowers confidence; missing SpotAiR or thermal details is informational unless other risks are present; relying on a single forecast source lowers confidence.

Thunderstorm and convective risk is part of the backend decision model when CAPE and Lifted Index are available. A low risk is treated as vigilance, moderate risk as limiting, and high risk as blocking.

The decision model accepts an Objectif de Vol selected from the weather page. The objective changes how thermal activity and related risks are interpreted without moving decision logic into the frontend.

The initial supported objectives are `tranquille`, `progression`, and `thermique`. Distance flying is intentionally excluded from the first model because it requires additional criteria such as ceiling, wind aloft, route drift, and airspace constraints.

The selected objective changes thermal interpretation: `tranquille` treats weak thermals as neutral or positive and strong thermals as limiting; `progression` values moderate thermals while treating strong thermals cautiously; `thermique` values exploitable thermal activity but still treats moderate or high thunderstorm risk as limiting or blocking.

The active objective is carried by the weather page URL when explicitly selected, while a settings value provides the default objective. The URL value wins for the current page so decisions are shareable and navigation remains predictable.

The existing Para-Index remains a general weather score. The Decision de Vol exposes a separate objective-aware Score Objectif so changing the Objectif de Vol does not mutate the meaning of Para-Index elsewhere in the application.

The decision cockpit should lead with Score Objectif, while existing detailed weather views can continue to show Para-Index. Both scores may coexist, but each must be shown in its own context to avoid implying they are interchangeable.

The weather page presents the Decision de Vol as a synthetic cockpit first, followed by detailed panels for windows, risks, wind-decollage compatibility, landing safety, confidence, and alternatives. Mobile presentation prioritizes the summary and uses collapsible detail sections.

The Objectif de Vol selector is shown inside or immediately below the Decision de Vol cockpit, not hidden in settings. Changing it updates the weather page URL and triggers a backend recalculation for the active decision.

Changing the active Objectif de Vol does not automatically change the persisted default objective. Persisting a new default remains an explicit user action so temporary comparisons do not silently alter future weather decisions.

City searches show weather context rather than a complete Decision de Vol. A complete decision requires a Site with decollage context because wind orientation and landing safety are part of the decision model.

The complete decision API is reserved for Sites, while free coordinates and city searches use a separate weather-context API. This keeps the boundary clear between complete flight decisions and general weather context.

The first implementation focuses on `flight-decision` for Sites. City search continues to use the existing weather display and should clearly tell the pilot to select a Decollage for a complete Decision de Vol.

Landing safety influences the V1 decision when associated landings and their weather are available. When landing data cannot be evaluated, the API returns a vigilance diagnostic that landing safety was not evaluated instead of fabricating a result.

V1 prepares the response shape for live-wind confidence diagnostics, but SpotAiR integration is not required for the first complete Decision de Vol implementation. The initial decision can be computed from forecasts, site orientation, available landing safety, risk precedence, and source confidence.

V1 also prepares an `alternatives` field but does not need to calculate alternative sites. The first implementation should make the selected site's Decision de Vol reliable before expanding into multi-site recommendation.

V1 requires both unit tests for the backend decision engine and endpoint tests for the public API contract. Tests must cover the decision levels, blocking risks, objective-specific thermal interpretation, unavailable data, and presence of stable codes plus translation keys.
