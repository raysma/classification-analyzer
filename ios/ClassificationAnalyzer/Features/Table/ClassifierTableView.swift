import SwiftUI
import USPSADomain
import USPSARules

struct ClassifierTableView: View {
    let classifiers: [Classifier]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
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
                            .font(.caption.monospaced().weight(.medium))
                            .foregroundStyle(percentColor(for: classFor(c.percent)))
                            .gridColumnAlignment(.trailing)
                        Text(c.flag.rawValue.isEmpty ? "—" : c.flag.rawValue)
                            .font(.caption.monospaced())
                            .foregroundStyle(flagColor(for: c.flag))
                            .gridColumnAlignment(.center)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
    }

    private func percentColor(for letter: ClassLetter) -> Color {
        switch letter {
        case .gm: return .yellow
        case .m: return .purple
        case .a: return .blue
        case .b: return .green
        case .c: return .orange
        case .d: return .red
        case .u: return .gray
        }
    }

    private func flagColor(for flag: Flag) -> Color {
        switch flag {
        case .y: return .green
        case .f: return .orange
        case .m, .s: return .blue
        case .p: return .purple
        case .a, .i, .x, .q, .n: return .red
        case .e, .b, .c, .d, .g, .none: return .secondary
        }
    }
}
