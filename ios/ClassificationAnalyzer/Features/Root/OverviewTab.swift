import SwiftUI
import USPSADomain

struct OverviewTab: View {
    @Environment(AppModel.self) private var appModel
    @Binding var selectedTab: Int

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                DivisionHeader()

                ScrollView {
                    if let record = appModel.effectiveRecord {
                        VStack(spacing: 16) {
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
                            }

                            Text(recordFooter(record))
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        .padding()
                    } else {
                        EmptyStateView(
                            systemImage: "person.crop.circle.badge.questionmark",
                            message: "No record loaded yet.",
                            actionTitle: "Go to Lookup",
                            action: { selectedTab = 0 }
                        )
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Overview")
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
