# Changelog

## 2026-05-14

### New features

- **Manual paste support**: paste your classifier history table directly from the USPSA website when the automatic lookup is unavailable. Supports both the 2025+ 8-column format and the older 7-column format.
- **What-if simulator**: add hypothetical future scores to project your classification percentage. The simulator shows the 8-score window with Y/F flags updating in real time as you add scores.
- **Color-coded scores**: percent column in the classifier table is now colored by classification bracket (GM/M/A/B/C/D) matching the chart threshold lines.
- **All-time best**: the classification summary card now shows your all-time highest classification percentage alongside your current one.

### Bug fixes

- **2-digit year dates**: pasted tables with 2-digit years (e.g. 5/10/26) now parse correctly; previously all rows were silently skipped.
- **Concurrent request errors**: the scraping service returned 409 errors when the lookup button was clicked multiple times. Retries are now disabled and the button stays locked for the full duration of the request.
- **Stale cache**: cached error responses no longer persist across page refreshes.

## 2026-05-13

### New features

- **Dark mode**: three-way theme toggle (Light / Auto / Dark) in the header. Preference persisted to `localStorage`. Auto mode follows the OS preference in real time.
- **Chart dark mode**: chart tooltip, grid, and axis labels now adapt to dark mode.
- **Classification % line**: the chart line now shows your USPSA classification percentage after each classifier, labeled clearly as "Classification %" instead of "Rolling avg".

### Bug fixes

- **Chart labels clipped**: GM/M/A/B/C/D threshold labels on the right side of the chart were being cut off. Chart margin increased to give them room.
- **Font mismatch in chart tooltip**: tooltip now inherits the app font instead of using the browser default.
- **Unknown · Unknown ghost**: a stale cached response could cause "UNKNOWN · Unknown" to display before any lookup was performed. Fixed with cache versioning and defensive parser checks.
