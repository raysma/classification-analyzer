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
    // typically report .regular. Drives both the chart tuning and the
    // detail-card layout (trailing column vs bottom strip).
    private var isLandscape: Bool { verticalSizeClass == .compact }
    private var trailingPadding: CGFloat { isLandscape ? 32 : 20 }
    private var xTickCount: Int { isLandscape ? 8 : 5 }

    // Fixed footprint for the detail card so the chart never resizes as
    // the user scrubs across dates with different score counts (the
    // "jumping" the user reported). Tall multi-classifier days scroll
    // inside the reserved area instead of pushing the chart around.
    private var cardLandscapeWidth: CGFloat { 240 }
    private var cardPortraitHeight: CGFloat { 200 }

    var body: some View {
        let canvas = ChartCanvas(
            classifiers: classifiers,
            history: history,
            selectedDate: $selectedDate,
            trailingPadding: trailingPadding,
            xTickCount: xTickCount
        )

        ZStack(alignment: .topTrailing) {
            Group {
                if isLandscape {
                    landscapeLayout(canvas: canvas)
                } else {
                    portraitLayout(canvas: canvas)
                }
            }
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

    private func landscapeLayout(canvas: ChartCanvas) -> some View {
        HStack(alignment: .top, spacing: 16) {
            canvas
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            ScrollView {
                canvas.selectionDetailCard
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.trailing, 4)
            }
            .frame(width: cardLandscapeWidth)
            // Clear the dismiss button at the top-trailing of the screen
            // so the card doesn't slide underneath it.
            .padding(.top, 56)
        }
    }

    private func portraitLayout(canvas: ChartCanvas) -> some View {
        VStack(spacing: 16) {
            canvas
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            Divider()

            ScrollView {
                canvas.selectionDetailCard
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(height: cardPortraitHeight)
        }
    }
}
