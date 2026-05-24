import SwiftUI
import USPSADomain

struct ScoresTab: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                DivisionHeader()

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
                            message: "Look up a member on the Overview tab to see classifier scores."
                        )
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Scores")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
