import SwiftUI
import USPSADomain

struct ScoresTab: View {
    @Environment(AppModel.self) private var appModel
    @Binding var selectedTab: Int

    var body: some View {
        NavigationStack {
            ScrollView {
                if appModel.effectiveRecord != nil, !appModel.activeClassifiers.isEmpty {
                    ClassifierTableView(classifiers: appModel.activeClassifiers)
                        .padding()
                } else if appModel.effectiveRecord != nil {
                    EmptyStateView(
                        systemImage: "list.bullet",
                        message: "No scores in the selected division."
                    )
                } else {
                    EmptyStateView(
                        systemImage: "list.bullet",
                        message: "Look up a member to see classifier scores.",
                        actionTitle: "Go to Lookup",
                        action: { selectedTab = 0 }
                    )
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(appModel.selectedDivision?.displayName ?? "Scores")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarTitleMenu {
                DivisionMenuItems()
            }
        }
    }
}
