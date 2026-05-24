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

    private var hypoCodeToId: [String: UUID] {
        Dictionary(uniqueKeysWithValues: appModel.hypotheticalScores.map { h in
            ("hypo-\(h.id.uuidString)", h.id)
        })
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
            header
            projectedCard
            scoresList
            HypotheticalScoreForm()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
    }

    private var header: some View {
        HStack {
            Text("What-if simulator — \(division.displayName)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer()
            if hasChanges {
                Button("Reset") { appModel.resetScenario() }
                    .font(.caption)
                    .buttonStyle(.plain)
                    .underline()
                    .foregroundStyle(.secondary)
            }
        }
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
        let isHypo = hypoCodeToId.keys.contains(s.classifierCode)
        let isIncluded = scenarioBest.included.contains(where: { classifierKey($0) == id })
        let isDropped = scenarioBest.dropped.contains(where: { classifierKey($0) == id })
        let hypoId = hypoCodeToId[s.classifierCode]

        return HStack(spacing: 8) {
            badge(isIncluded: isIncluded, isDropped: isDropped)

            Text(rowText(s: s, isHypo: isHypo))
                .font(.caption.monospaced())
                .foregroundStyle(rowColor(isHypo: isHypo, isDropped: isDropped))
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer(minLength: 4)

            if isHypo, let hypoId {
                Button {
                    appModel.removeHypothetical(id: hypoId)
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
        if isHypo {
            return "Hypothetical · \(String(format: "%.4f%%", s.percent))"
        }
        return "\(s.date) · \(s.classifierCode) · \(String(format: "%.4f%%", s.percent))"
    }

    private func rowColor(isHypo: Bool, isDropped: Bool) -> Color {
        if isHypo { return .indigo }
        if isDropped { return .secondary }
        return .primary
    }
}
