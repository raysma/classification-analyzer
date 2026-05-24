import SwiftUI
import USPSADomain

struct WhatIfTab: View {
    @Environment(AppModel.self) private var appModel
    @Binding var selectedTab: Int

    var body: some View {
        NavigationStack {
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
                        message: "Look up a member to use the what-if simulator.",
                        actionTitle: "Go to Lookup",
                        action: { selectedTab = 0 }
                    )
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("What-If")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    DivisionMenuButton(fallbackTitle: "What-If")
                }
            }
        }
    }
}
