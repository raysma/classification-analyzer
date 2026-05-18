# Changelog

## 2026-05-18

### Bug fixes

- **Better handling of non-existent member numbers**: unknown USPSA IDs now show "No member found with that number" instead of a generic upstream error.

## 2026-05-15

### New features

- **"Journey to" class picker**: the class-up section now lets you pick any target class (GM–D) from a dropdown instead of always defaulting to the next class above. GMs can pick a lower class to see *exactly how poorly they'd have to shoot* over their next 1–5 classifiers to drop into it — math is direction-aware (minimum required for going up, maximum allowed for going down). Down-direction cards are tinted indigo and tagged with a `↓` on the label row so the percentage stays compact on narrow mobile screens.

### Bug fixes

- **Ghost duplicate rows on tab switch**: same-day repeats of a classifier no longer pile up at the top of the table after switching divisions, and only the MRO survivor is highlighted as in-window.
- **Class-up direction respects USPSA's official class**: the dropdown's direction (up vs down vs maintain) now uses USPSA's authoritative class letter when available, not our rolling-window-derived class. Previously a GM-promoted shooter whose rolling average never reached 95% would see "next class down" as maintain (definitive %) instead of down — those classes are now correctly direction='down' and tagged with the `↓` indicator.
- **Pending classifiers no longer flagged F**: for shooters with fewer than 4 scores in a division, their existing classifiers now show as included (Y) rather than dropped (F) in the what-if panel and classifier table. They're not "dropped" — there's just no classification computed yet.
- **Smarter class-up targets for unclassified shooters**: when a shooter has fewer than 4 classifiers, the class-up cards now target the class above their trending average (based on the simple mean of their available scores) rather than always defaulting to D. A C-trending shooter sees what they need to reach B, etc.
- **USPSA-precision percentages**: percentages across the app now display with 4-decimal precision to match USPSA (e.g. `96.1064%`). Class-up cards stay at 2 decimals to fit narrow mobile screens.
- **Authoritative class from USPSA**: the summary card now parses USPSA's official class letter, current percent, and historical high percent from the "Classifications" summary table on the USPSA page. This is the source of truth and captures every promotion pathway (rolling window, major-match auto-promotion, sticky-class).
- **All-time high accuracy**: when fetched from USPSA, the all-time high reflects USPSA's recorded peak rather than our re-computed estimate. Manual paste records show the computed value with an "(estimated)" tag.
- **Sticky class letter (fallback)**: for manual-paste records, applies USPSA's "once classified, you don't drop" rule via max of current and all-time-high percent.
- **Cross-division floor (fallback)**: the one-letter-below cross-division rule is applied for computed (paste) records. A division with ≥4 scores will never display lower than one letter below your highest classified division.
- **Retired flags**: B, C, D, and G flags (retired April 2025) are no longer counted toward the rolling window. Historical scores carrying these flags will no longer incorrectly appear as included.
- **False Grand Master message**: the "Congratulations — you're Grand Master" notice no longer fires for Master-class shooters who can't quite reach GM in one classifier.

## 2026-05-14

### New features

- **Manual paste improvements**: paste support updated for USPSA's 2025+ 8-column table format and 2-digit year dates.
- **What-if redesign**: window display now shows live Y/F badge indicators and a strikethrough for scores pushed out by hypotheticals.
- **Color-coded scores**: percent column in the classifier table is now colored by classification bracket (GM/M/A/B/C/D) matching the chart threshold lines.
- **All-time best**: the classification summary card now shows your all-time highest classification percentage alongside your current one.
- **Updated USPSA parser**: automatic lookup updated for USPSA's redesigned classification page, including support for the new 8-column table layout.

## 2026-05-13

### New features

- **Automatic USPSA lookup**: enter any USPSA member number to fetch and display your full classifier history directly from uspsa.org.
- **Division tabs**: switch between divisions with tab buttons showing the classifier count for each.
- **Classifier history table**: full sortable history with flag descriptions on hover and highlighted Y / dimmed F rows matching the rolling-window calculation.
- **Classification summary**: shows your current class letter, percentage, and gap to the next class threshold.
- **Progress chart**: classification percentage plotted over time with class threshold reference lines.
- **Class-up insights**: calculates the minimum average score required across the next 1–5 classifiers to reach the next class.
- **What-if simulator**: add hypothetical future scores to project your classification percentage.
- **Manual paste**: paste your classifier history table directly from USPSA.org for any division when the automatic lookup is unavailable.
- **Dark mode**: three-way theme toggle (Light / Auto / Dark) in the header. Preference persisted to `localStorage`. Auto mode follows the OS preference in real time. Chart, tooltip, grid, and axis labels all adapt to the selected theme.
