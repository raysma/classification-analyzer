# Changelog

## 2026-05-14

### New features

- **Manual paste support**: paste your classifier history table directly from the USPSA website when the automatic lookup is unavailable. Supports both the 2025+ 8-column format and the older 7-column format.
- **What-if simulator**: add hypothetical future scores to project your classification percentage. The simulator shows the 8-score window with Y/F flags updating in real time as you add scores.
- **Color-coded scores**: percent column in the classifier table is now colored by classification bracket (GM/M/A/B/C/D) matching the chart threshold lines.
- **All-time best**: the classification summary card now shows your all-time highest classification percentage alongside your current one.
- **Updated USPSA parser**: automatic lookup updated for USPSA's redesigned classification page, including support for the new 8-column table layout and 2-digit year dates.

## 2026-05-13

### New features

- **Dark mode**: three-way theme toggle (Light / Auto / Dark) in the header. Preference persisted to `localStorage`. Auto mode follows the OS preference in real time.
- **Chart dark mode**: chart tooltip, grid, and axis labels now adapt to dark mode.
- **Classification % line**: the chart line now shows your USPSA classification percentage after each classifier, labeled clearly as "Classification %" instead of "Rolling avg".
