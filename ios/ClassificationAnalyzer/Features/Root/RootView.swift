import SwiftUI
import USPSADomain

struct RootView: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    LookupView()

                    if let record = appModel.effectiveRecord {
                        DivisionPicker()

                        if let division = appModel.selectedDivision {
                            SummaryCard(
                                division: division,
                                projectedPercent: appModel.projectedPercent,
                                windowSize: appModel.windowSize,
                                allTimeHighPercent: appModel.allTimeHighPercent,
                                officialClass: appModel.officialClass,
                                crossDivisionFloor: appModel.crossDivisionFloor
                            )

                            if !appModel.warnings.isEmpty {
                                WarningBanner(warnings: appModel.warnings)
                            }

                            ProgressChartView(
                                classifiers: appModel.activeClassifiers,
                                history: appModel.classificationHistory
                            )

                            ClassUpInsightsView(
                                classifiers: appModel.activeClassifiers,
                                division: division,
                                officialClass: appModel.officialClass
                            )

                            WhatIfPanel(
                                windowScores: appModel.activeClassifiers,
                                currentPercent: appModel.projectedPercent,
                                division: division
                            )

                            if !appModel.activeClassifiers.isEmpty {
                                ClassifierTableView(classifiers: appModel.activeClassifiers)
                            }
                        }

                        Text(recordFooter(record))
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    } else if !appModel.warnings.isEmpty {
                        WarningBanner(warnings: appModel.warnings)
                    }
                }
                .padding()
            }
            .navigationTitle("Classification Analyzer")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func recordFooter(_ record: ShooterRecord) -> String {
        if record.source == .paste {
            let divs = record.classifiers.keys
                .map { $0.displayName }
                .sorted()
                .joined(separator: ", ")
            return "Pasted record — \(divs.isEmpty ? "no divisions" : divs)"
        }
        return "\(record.name) (\(record.memberNumber)) — \(record.membershipType.rawValue)"
    }
}

private struct WarningBanner: View {
    let warnings: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Heads up", systemImage: "exclamationmark.triangle.fill")
                .font(.callout.bold())
                .foregroundStyle(.orange)
            ForEach(warnings, id: \.self) { w in
                Text(w)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
