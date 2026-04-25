# Format Date-Only Values with UTC-Safe Intl

Format frontend date-only values (`YYYY-MM-DD`) with a timezone-safe strategy so rendered day/month values do not shift by user locale.

## Rules

* Avoid `new Date(dateOnlyString)` and `Date.parse(dateOnlyString)` for date-only values in frontend code
* Use `Intl.DateTimeFormat` with `timeZone: 'UTC'` when formatting date-only values
* Reuse a shared helper for date-only parsing and formatting instead of inline logic
