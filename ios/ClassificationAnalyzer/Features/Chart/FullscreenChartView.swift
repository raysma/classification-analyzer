import SwiftUI
import USPSADomain

struct FullscreenChartView: View {
    let classifiers: [Classifier]
    let history: [ClassificationSnapshot]

    // Independent of the inline chart's selection — entering fullscreen
    // shouldn't inherit (or stomp on) the inline state.
    @State private var selectedDate: Date?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.verticalSizeClass) private var verticalSizeClass

    // Landscape iPhone reports .compact vertical; portrait phone + iPad
    // typically report .regular. Tune the chart tightness per the
    // available horizontal real estate.
    private var trailingPadding: CGFloat {
        verticalSizeClass == .compact ? 32 : 20
    }

    private var xTickCount: Int {
        verticalSizeClass == .compact ? 8 : 5
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ChartCanvas(
                classifiers: classifiers,
                history: history,
                selectedDate: $selectedDate,
                trailingPadding: trailingPadding,
                xTickCount: xTickCount
            )
            .padding()

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 44, height: 44)
                    // Glass on iOS 26, .thinMaterial on iOS 18. The chart
                    // marks underneath are abstract data (not a glass
                    // surface), so this is a single-layer glass placement —
                    // safe per Apple's "never stack glass on glass" rule.
                    .refinedSurface(in: Circle())
            }
            .accessibilityLabel("Close")
            .padding()
        }
    }
}
