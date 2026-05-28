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
