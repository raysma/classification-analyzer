import SwiftUI
import USPSADomain

// Nav-bar Menu used as the principal toolbar item on every tab that
// depends on a division. Falls back to a plain title when no record
// is loaded so the nav bar still reads correctly.
struct DivisionMenuButton: View {
    @Environment(AppModel.self) private var appModel
    let fallbackTitle: String

    var body: some View {
        if let selected = appModel.selectedDivision, !appModel.availableDivisions.isEmpty {
            Menu {
                ForEach(appModel.availableDivisions, id: \.self) { div in
                    Button {
                        appModel.selectedDivision = div
                    } label: {
                        if div == selected {
                            Label(div.displayName, systemImage: "checkmark")
                        } else {
                            Text(div.displayName)
                        }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(selected.displayName)
                        .font(.headline)
                        .lineLimit(1)
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.semibold))
                }
                // Toolbar .principal slot interpolates the label width when
                // the selected value changes, clipping the new (wider) text
                // mid-animation. fixedSize grants the natural width and
                // skips that intermediate clipped state.
                .fixedSize(horizontal: true, vertical: false)
                .foregroundStyle(.primary)
                .accessibilityLabel("Division: \(selected.displayName). Double-tap to change.")
            }
        } else {
            Text(fallbackTitle)
                .font(.headline)
        }
    }
}
