import SwiftUI
import USPSADomain

struct RootView: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    LookupView()

                    if let record = appModel.fetchedRecord {
                        SummaryCard(record: record, division: appModel.selectedDivision)

                        if !appModel.warnings.isEmpty {
                            WarningBanner(warnings: appModel.warnings)
                        }

                        if let division = appModel.selectedDivision,
                           let scores = record.classifiers[division] {
                            ClassifierTableView(classifiers: scores)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Classification Analyzer")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct WarningBanner: View {
    let warnings: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Partial parse", systemImage: "exclamationmark.triangle.fill")
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
