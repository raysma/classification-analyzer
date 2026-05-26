import SwiftUI
import USPSADomain
import USPSARules

struct WhatIfPanel: View {
    let windowScores: [Classifier]
    let currentPercent: Double?
    let division: Division

    @Environment(AppModel.self) private var appModel

    private var scenarioWindow: RollingWindow {
        getCurrentWindow(appModel.buildScenarioScores(windowScores: windowScores))
    }

    private var scenarioWindowScores: [Classifier] {
        scenarioWindow.scores
    }

    private var scenarioBest: BestSixResult {
        bestSixOfRecentEight(scenarioWindowScores)
    }

    private var scenarioPercent: Double? {
        scenarioWindow.classificationScore()
    }

    private var scenarioClass: ClassLetter? {
        scenarioPercent.map(classFor)
    }

    private var delta: Double? {
        guard let current = currentPercent, let scenario = scenarioPercent else { return nil }
        return scenario - current
    }

    // Resolve a scenario Classifier row back to its source hypothetical
    // UUID, if any. Form-entered hypotheticals match on the synthetic
    // "hypo-<uuid>" classifierCode; Calculator-sent hypotheticals match
    // on (date, classifierCode) — the real values that buildScenarioScores
    // now stamps onto the synthetic Classifier.
    private func hypoId(for s: Classifier) -> UUID? {
        for h in appModel.hypotheticalScores {
            if let date = h.date, let code = h.classifierCode {
                if date == s.date && code == s.classifierCode { return h.id }
            } else if s.classifierCode == "hypo-\(h.id.uuidString)" {
                return h.id
            }
        }
        return nil
    }

    private var displayScores: [Classifier] {
        scenarioWindowScores.sorted { a, b in
            if a.date != b.date { return a.date > b.date }
            return a.percent > b.percent
        }
    }

    private var hasChanges: Bool {
        !appModel.hypotheticalScores.isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            projectedCard
            scoresList
            HypotheticalScoreForm()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
    }

    private var projectedCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Projected")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if let pct = scenarioPercent {
                    Text(String(format: "%.4f%%", pct))
                        .font(.title3.bold())
                        .monospacedDigit()
                        .contentTransition(.numericText())
                    if let cls = scenarioClass {
                        Text("(\(cls.rawValue))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("Not enough scores")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let d = delta {
                    let sign = d >= 0 ? "+" : ""
                    Text("\(sign)\(String(format: "%.4f%%", d))")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(d >= 0 ? Color.green : Color.red)
                        .monospacedDigit()
                }
                Spacer()
            }

            if let current = currentPercent {
                Text("vs actual \(String(format: "%.4f%%", current))")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .monospacedDigit()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 8))
        .animation(.snappy, value: scenarioPercent)
    }

    private var scoresList: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(hasChanges ? "Projected" : "Current") window — 8 most recent, best 6 used")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)

            if displayScores.isEmpty {
                Text("No scores in window.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            ForEach(displayScores, id: \.self) { s in
                row(for: s)
            }
        }
    }

    private func row(for s: Classifier) -> some View {
        let id = classifierKey(s)
        let resolvedHypoId = hypoId(for: s)
        let isHypo = resolvedHypoId != nil
        let isIncluded = scenarioBest.included.contains(where: { classifierKey($0) == id })
        let isDropped = scenarioBest.dropped.contains(where: { classifierKey($0) == id })

        return HStack(spacing: 8) {
            badge(isIncluded: isIncluded, isDropped: isDropped)

            Text(rowText(s: s, isHypo: isHypo))
                .font(.caption.monospaced())
                .foregroundStyle(rowColor(isHypo: isHypo, isDropped: isDropped))
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer(minLength: 4)

            if let resolvedHypoId {
                Button {
                    appModel.removeHypothetical(id: resolvedHypoId)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove hypothetical \(String(format: "%.4f%%", s.percent))")
            }
        }
    }

    private func badge(isIncluded: Bool, isDropped: Bool) -> some View {
        Text(isIncluded ? "Y" : (isDropped ? "F" : ""))
            .font(.caption.bold())
            .foregroundStyle(isIncluded ? Color.green : (isDropped ? Color.orange : Color.secondary))
            .frame(width: 14, alignment: .center)
    }

    private func rowText(s: Classifier, isHypo: Bool) -> String {
        // Calculator-sent hypotheticals carry a real date + classifier code
        // (date != "9999-…"). Render them like a real score row but keep
        // the indigo rowColor so the hypothetical origin stays visible.
        let isSynthetic = s.date.hasPrefix("9999-")
        if isHypo, isSynthetic {
            return "Hypothetical · \(String(format: "%.4f%%", s.percent))"
        }
        return "\(s.date) · \(s.classifierCode) · \(String(format: "%.4f%%", s.percent))"
    }

    private func rowColor(isHypo: Bool, isDropped: Bool) -> Color {
        if isHypo { return .purple }
        if isDropped { return .secondary }
        return .primary
    }
}
