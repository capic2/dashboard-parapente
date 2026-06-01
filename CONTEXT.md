# Dashboard Parapente

This context describes the flight-site language used by pilots to prepare and track paragliding activity.

## Language

**Ville**:
A geographic search anchor used to discover nearby flight places. A **Ville** is not itself a **Site**.
_Avoid_: Site, spot

**Site**:
A real paragliding place that can be added to the user's list. A **Site** can be a **Decollage**, an **Atterrissage**, or both.
_Avoid_: Ville, generic location

**Localité de Site**:
The geographic attachment displayed with a **Site** to help the pilot locate it. It may come from the **Ville** searched by the pilot and is not necessarily the exact administrative municipality.
_Avoid_: Région, administrative city

**Site Existant**:
A **Site** discovered from an external flight-place source rather than invented from city coordinates. City-based creation should add **Sites Existants**, not arbitrary city locations.
_Avoid_: Ville, manual placeholder

**Groupe de Sites**:
A set of **Sites** that represent variants of the same named flight place, such as multiple orientations of Mont Poupet. A **Groupe de Sites** is inferred from shared naming rather than being a separate user-created place.
_Avoid_: Duplicate site, folder

**Doublon de Site**:
A candidate **Site Existant** that already appears in the user's list with the same flight-place identity. It should not be added a second time.
_Avoid_: Variant, group member

**Decollage**:
A **Site** where pilots can take off.
_Avoid_: Takeoff when writing user-facing French

**Atterrissage**:
A **Site** where pilots can land.
_Avoid_: Landing when writing user-facing French

**Decision de Vol**:
An aid for deciding whether a pilot should consider flying from a **Site** on a given day and, when relevant, during a specific time window. A **Decision de Vol** is a cautious pre-flight recommendation, not a recorded flight, a hard go/no-go order, or a safety guarantee.
_Avoid_: Vol, flight record, safety certification, go/no-go order

**Vol Tranquille**:
A flight objective that favors calm, manageable conditions over strong thermal performance. For the current pilot usage, weak thermals are neutral or positive, while strong thermals and instability require caution.
_Avoid_: Performance flight, thermal optimization

**Objectif de Vol**:
The pilot's current intention for evaluating a **Decision de Vol**, such as seeking a **Vol Tranquille** or accepting more thermal activity. The **Objectif de Vol** changes how conditions are interpreted without changing the underlying weather data.
_Avoid_: Pilot profile, fixed skill level

**Score Objectif**:
A numeric score for a **Decision de Vol** that reflects the selected **Objectif de Vol**. It complements the general weather score and should not be treated as the same thing as the Para-Index.
_Avoid_: Para-Index, generic weather score

**Vol de Progression**:
A flight objective between **Vol Tranquille** and thermal-focused flying. It accepts moderate thermal activity as useful learning conditions while still treating strong thermals and instability cautiously.
_Avoid_: Performance flight, distance flight

**Vol Thermique**:
A flight objective that actively values exploitable thermal activity while still treating excessive instability and thunderstorm risk as safety concerns.
_Avoid_: Vol tranquille, distance flight

**Creneau de Vol**:
A time window during a day when the conditions for a **Site** are considered usable enough to be highlighted to the pilot. A **Creneau de Vol** is qualified as Favorable, Vigilance, Limite, or Deconseille, with a numeric score used as supporting comparison rather than the main language.
_Avoid_: Full-day verdict, generic forecast period, score-only ranking

**Moment le Moins Defavorable**:
The least bad time window on a day where no **Creneau de Vol** is Favorable or Vigilance. It may be shown for situational awareness, but it must not be presented as a recommended time to fly.
_Avoid_: Best creneau, recommended creneau

**Risque Bloquant**:
A weather factor severe enough to prevent a **Creneau de Vol** from being presented as Favorable, regardless of its numeric score. Blocking risks take precedence over score, thermal quality, and source confidence.
_Avoid_: Minor warning, score modifier

**Risque de Vigilance**:
A weather factor that should be shown to the pilot but does not by itself prevent a **Creneau de Vol** from being usable. Weak wind, low confidence, and non-extreme thermal concerns are vigilance risks unless they cross a blocking threshold.
_Avoid_: Risque bloquant, cosmetic warning

**Confiance Meteo**:
The degree to which the available forecasts are complete, fresh, and coherent enough to support a **Decision de Vol**. **Confiance Meteo** can confirm or degrade a recommendation, but it must never improve a risky creneau.
_Avoid_: Safety guarantee, source count only

**Contexte Meteo**:
Weather information shown for a **Ville** or another location that is not enough to produce a complete **Decision de Vol**. A **Contexte Meteo** can explain general conditions and guide the pilot toward nearby **Sites**.
_Avoid_: Decision de Vol, site recommendation

**Source de Prevision**:
A weather source that predicts future conditions and can contribute to the forecast consensus used by a **Decision de Vol**.
_Avoid_: Observation live, source meteo generic

**Source d'Observation**:
A weather source that reports current or recent real-world conditions and can confirm, contradict, or lower **Confiance Meteo** without replacing the forecast basis of a **Decision de Vol**.
_Avoid_: Source de prevision, forecast model

**Heure Courante**:
The current clock hour for which live observations can meaningfully affect a **Decision de Vol**.
_Avoid_: Whole day, future forecast window

**Site Selectionne**:
The **Site** currently being evaluated by the pilot on the weather page. The primary **Decision de Vol** is always about the Site Selectionne, even when other sites are shown as alternatives.
_Avoid_: Best site, nearby city, arbitrary coordinates

**Site Alternatif**:
A different **Site** shown because its forecast may be more favorable than the **Site Selectionne** for a given day or time window. A **Site Alternatif** is secondary guidance, not the primary subject of the weather page.
_Avoid_: Site selectionne, automatic destination

**Securite Atterrissage**:
An assessment of whether an **Atterrissage** appears acceptable for landing during a day or time window. **Securite Atterrissage** complements a **Decision de Vol** but does not replace the decollage-based decision.
_Avoid_: Decision de Vol, takeoff decision

**Atterrissage Associe**:
An **Atterrissage** linked to a **Decollage** as a plausible landing option for a flight from that decollage. Atterrissages associes influence the **Decision de Vol** only through their **Securite Atterrissage**.
_Avoid_: Any nearby landing, selected decollage

**Compatibilite Vent-Decollage**:
The relationship between the forecast wind direction and the orientation of a **Decollage**. It is described with pilot-facing wind language such as Face, Travers acceptable, Travers fort, or Cul, then translated into the recommendation level used by the **Decision de Vol**.
_Avoid_: Wind score only, generic wind direction

## Example Dialogue

Dev: When a pilot searches for Annecy, should Annecy be added as a site?

Domain expert: No. Annecy is only the city used to find nearby real decollages and atterrissages.

Dev: If one real place is both a decollage and an atterrissage, do we split it?

Domain expert: No. It remains one site that can be both.

Dev: If no real site is found around a city, should we create a site from the city coordinates?

Domain expert: No. Search-based creation should only add existing flight sites.

Dev: If a new existing site belongs to the same named place as other sites, should it stand alone?

Domain expert: No. It should appear with the other variants in the same group.

Dev: If the searched site is already in the user's list, should we create another copy?

Domain expert: No. It is a doublon de site and should be blocked.

Dev: Should a doublon de site offer navigation to the existing site immediately?

Domain expert: Not initially. A simple message is enough unless doublons become frequent.

Dev: Should search-based site creation use different radius and result-count concepts from weather search?

Domain expert: No. Use the same radius and result-count choices so pilots recognize the flow.

Dev: Should search-based site creation split nearby decollages and atterrissages into separate result lists?

Domain expert: No. Show one mixed result list, with each candidate identifying whether it is a decollage, an atterrissage, or both.

Dev: How should mixed search results be ordered?

Domain expert: Closest sites first.

Dev: If the same place appears as both decollage and atterrissage in search results, should it appear twice?

Domain expert: No. Show one line and identify it as both.

Dev: After selecting a search result, should the result list disappear?

Domain expert: No. Keep the list visible and highlight the selected site so the pilot can change their choice.

Dev: Does a weather-based go/no-go assessment create a flight in the history?

Domain expert: No. It is only a decision aid before flying from a site during a day or time window.

Dev: Should the app tell the pilot to go flying?

Domain expert: No. It should give a cautious recommendation and explain the risks, but the pilot remains responsible for the final decision.

Dev: Should weak thermals make a creneau worse?

Domain expert: No. The current goal is a vol tranquille, so weak thermals are acceptable and can even be positive; strong thermals or instability are the concerns.

Dev: Is vol tranquille the only possible objective?

Domain expert: No. The pilot may choose a different objectif de vol from the weather page as confidence and desired thermal activity change.

Dev: Which objectifs de vol should be available first?

Domain expert: Start with vol tranquille, vol de progression, and vol thermique. Do not add distance flight yet because it requires additional criteria beyond the initial decision model.

Dev: What should the objective-aware decision score be called?

Domain expert: Use score objectif, because it is explicitly tied to the selected objectif de vol and is distinct from the general Para-Index.

Dev: Should the weather page lead with a full-day verdict or the best usable time window?

Domain expert: Lead with the best creneau de vol when one exists, while still showing the overall recommendation and risks.

Dev: Should pilots read the score or the condition level first?

Domain expert: They should read the condition level first, then use the score to compare similar creneaux or sites.

Dev: If the whole day is poor, should the least bad hour be called the best creneau?

Domain expert: No. Say that there is no recommended creneau, then optionally show the moment le moins defavorable for awareness.

Dev: Can a high score hide a clearly dangerous weather factor?

Domain expert: No. A risque bloquant must dominate the decision before score, thermal quality, or forecast confidence.

Dev: Which risks block a favorable creneau in the first weather decision model?

Domain expert: Significant rain, excessive average wind, excessive gusts, and tailwind at the decollage are blocking risks. Weak wind, low confidence, and non-extreme thermal concerns are vigilance risks unless later thresholds make them blocking.

Dev: Can strong forecast confidence make a risky creneau favorable?

Domain expert: No. Confiance meteo can only support or degrade the recommendation; it cannot cancel a weather risk.

Dev: Does adding more weather sources automatically make a decision more precise?

Domain expert: No. More sources are useful when they improve confiance meteo and the decision de vol, but source count alone is not precision.

Dev: Should every available weather source be required for the weather page to work?

Domain expert: No. The app should support as many activable sources as practical, but each source may fail or be disabled without blocking the main weather context or decision.

Dev: If weather sources strongly disagree on a blocking risk, should the average hide it?

Domain expert: No. A credible source that reports a blocking risk should degrade the decision instead of being diluted by more optimistic sources.

Dev: What makes a weather source credible enough to influence a blocking risk?

Domain expert: A weather source is credible for this purpose when its data is fresh, valid, and not known to be failing repeatedly.

Dev: Should forecasts and live observations influence the decision in the same way?

Domain expert: No. Sources de prevision build the forecast basis, while sources d'observation confirm, contradict, or lower confiance meteo without replacing the forecast.

Dev: Should the expanded weather source work include observations live from the start?

Domain expert: Yes. The app should expand both sources de prevision and sources d'observation, while keeping their roles distinct in the decision.

Dev: Can a source d'observation affect every forecast hour of the day?

Domain expert: No. A source d'observation can affect the decision only for the heure courante, because it reports current or recent conditions rather than the full future day.

Dev: Does heure courante include the next forecast hour?

Domain expert: No. Heure courante means only the current clock hour, not the next hour or a broader preparation window.

Dev: If a live observation contradicts the forecast during the heure courante, should it replace the forecast display?

Domain expert: No. Keep the forecast visible as the forecast basis, show the live observation beside it, and flag the contradiction clearly.

Dev: Can several weather models from the same provider count as separate sources de prevision?

Domain expert: Yes, but only when each model is clearly identified and traceable separately; otherwise source count would overstate confiance meteo.

Dev: How should sources requiring an API key appear before the key is configured?

Domain expert: They should be visible but disabled until their key is configured, so they do not break the main weather experience.

Dev: Can a source de prevision influence the decision if it lacks the necessary flight weather fields?

Domain expert: No. A source de prevision must provide the necessary flight weather fields, including wind, wind direction, gusts, and precipitation, to influence the decision de vol.

Dev: Can a source de prevision contribute when it provides only some necessary fields?

Domain expert: Yes. It may influence only the risks and confidence for the fields it provides, without increasing confidence for missing fields.

Dev: Should many weak weather sources outweigh a fresher, more reliable local source by simple averaging?

Domain expert: No. Consensus should account for source quality such as freshness, reliability, local resolution, and configured priority rather than using source count alone.

Dev: When a reliable local source disagrees with global sources, which one wins?

Domain expert: Blocking risks should follow the most cautious credible signal, while non-blocking displayed values may give more weight to the reliable local source for the fields where it is relevant.

Dev: Should a failed specialized forecast source make the whole decision unavailable?

Domain expert: No. A failed specialized source should be visible and may lower confiance meteo, but it should not by itself make the decision unavailable when enough other credible data remains.

Dev: What is the minimum credible forecast basis for a decision de vol?

Domain expert: A decision de vol should have at least two credible sources for the essential fields such as wind, wind direction, gusts, and precipitation; with fewer, the app should treat the decision as too fragile or low-confidence.

Dev: If only one credible source is available, should the app still show a normal favorable decision?

Domain expert: No. It may still provide a useful decision aid, but the result should be degraded because a single credible source is too fragile for a normal favorable decision.

Dev: What is the best possible decision level when only one credible source supports otherwise good conditions?

Domain expert: Vigilance is the best possible level in that case; favorable requires at least two credible sources for the essential fields.

Dev: Should weather settings show every possible source all the time?

Domain expert: Use a simple view for active sources and an advanced view for all potential configurable sources, so the pilot can enable many sources without making the default settings noisy.

Dev: Can experimental or fragile weather sources be enabled?

Domain expert: Yes, as long as their status is clear and the pilot keeps direct control to enable or disable them easily.

Dev: Can an experimental weather source create a blocking risk by itself?

Domain expert: No. An experimental source may alert and lower confiance meteo, but it should not create a blocking risk on its own until it is considered reliable.

Dev: How does an experimental weather source become reliable?

Domain expert: Reliability should combine observed history such as success rate, freshness, and coherence with other sources with explicit pilot control over the final source status.

Dev: Should the pilot see whether a weather source is experimental, fragile, reliable, or disabled?

Domain expert: Yes. The source status should be visible in settings and weather details so the pilot understands how source quality affects confiance meteo and decision de vol.

Dev: Where should the pilot understand which sources influenced risks and confidence?

Domain expert: Keep quick per-hour source details in the hourly hover, and use a collapsible detail panel to explain how sources affected risks and the decision de vol.

Dev: At what level should detailed source explanations be shown?

Domain expert: Show global source confidence for the day, source impact per creneau de vol, and keep per-hour source values in the hourly hover.

Dev: Should every technically possible fragile web source be integrated automatically?

Domain expert: No. Fragile or unofficial web sources should be evaluated case by case, can be marked experimental, and should not block the decision by themselves.

Dev: Who decides whether a fragile weather source is worth integrating?

Domain expert: A fragile source should meet minimum technical criteria, then the pilot decides whether its weather value justifies the maintenance cost.

Dev: Is the weather page primarily a best-site finder?

Domain expert: No. It primarily evaluates the site selectionne, then may show a site alternatif when another site appears clearly better.

Dev: Can a city search produce a complete decision de vol?

Domain expert: No. A ville can provide weather context and help discover nearby sites, but a complete decision de vol requires a site because decollage orientation and atterrissages matter.

Dev: What should the page show for a ville?

Domain expert: Show a contexte meteo and nearby sites, not a complete decision de vol.

Dev: Can an atterrissage alone answer whether the pilot should take off?

Domain expert: No. An atterrissage can have a securite atterrissage assessment, but a complete decision de vol needs a decollage or a site that is both decollage and atterrissage.

Dev: Should a good decollage remain favorable if every associated atterrissage is poor?

Domain expert: No. If all known atterrissages associes are poor, the decision de vol should be degraded. If no atterrissage associe is known, show that landing was not evaluated as a vigilance rather than treating it as proven unsafe.

Dev: Should wind alignment be shown only as a numeric angle?

Domain expert: No. Show the pilot-facing relationship first, such as Face, Travers acceptable, Travers fort, or Cul, then use the angle and score as supporting detail.

Dev: What default angle ranges should describe wind alignment at a decollage?

Domain expert: Treat 0-30 degrees as Face, 31-60 degrees as Travers acceptable, 61-100 degrees as Travers fort, and 101-180 degrees as Cul. These defaults may later be adapted per site.

Dev: How should a decollage with several orientations be evaluated?

Domain expert: Compare the wind with each known orientation, keep the best compatible orientation for the decision de vol, and show the retained orientation in the detail. If no orientation is known, show that orientation was not evaluated as a vigilance rather than blocking the decision.

Dev: Should the decision de vol define separate wind, gust, rain, and instability thresholds?

Domain expert: No. It should reuse the existing configurable weather thresholds as the source of truth, and only introduce new thresholds for concepts not already covered, such as wind-orientation angles, forecast confidence, and landing safety rules.

Dev: Should the weather decision model distinguish between several pilot profiles?

Domain expert: Not initially. The app is currently used by one pilot, so the existing configurable thresholds are enough; pilot profiles may be introduced later if the app becomes multi-user.
