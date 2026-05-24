import SwiftUI
import USPSADomain

struct WhatIfTab: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                DivisionHeader()

                ScrollView {
                    if let division = appModel.selectedDivision, appModel.effectiveRecord != nil {
                        WhatIfPanel(
                            windowScores: appModel.activeClassifiers,
                            currentPercent: appModel.projectedPercent,
                            division: division
                        )
                        .padding()
                    } else {
                        EmptyStateView(
                            systemImage: "wand.and.stars",
                            message: "Look up a member on the Overview tab to use the what-if simulator."
                        )
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("What-If")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
