import SwiftUI
import USPSADomain

struct ClassifierTableView: View {
    let classifiers: [Classifier]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Scores")
                .font(.headline)

            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                GridRow {
                    Text("Date").gridColumnAlignment(.leading)
                    Text("Code").gridColumnAlignment(.leading)
                    Text("%").gridColumnAlignment(.trailing)
                    Text("Flag").gridColumnAlignment(.center)
                }
                .font(.caption.bold())
                .foregroundStyle(.secondary)

                Divider().gridCellColumns(4)

                ForEach(Array(classifiers.enumerated()), id: \.offset) { _, c in
                    GridRow {
                        Text(c.date)
                            .font(.caption.monospaced())
                        Text(c.classifierCode)
                            .font(.caption.monospaced())
                        Text(String(format: "%.2f", c.percent))
                            .font(.caption.monospaced())
                            .gridColumnAlignment(.trailing)
                        Text(c.flag.rawValue.isEmpty ? "—" : c.flag.rawValue)
                            .font(.caption.monospaced())
                            .gridColumnAlignment(.center)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
