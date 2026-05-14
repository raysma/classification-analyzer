# Changelog

## 2026-05-15

### Bug fixes

- **Sticky class letter**: the summary card now applies USPSA's "once classified, you don't drop" rule by using the maximum of your current rolling-window percent and your all-time high in the division to derive the displayed class letter.
- **Cross-division floor**: the one-letter-below cross-division rule is now applied. A division with ≥4 scores will never display lower than one letter below your highest classified division.
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
