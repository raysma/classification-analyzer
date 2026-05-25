import SwiftUI
import USPSADomain
import USPSARules

struct ProgressChartView: View {
    let classifiers: [Classifier]
    let history: [ClassificationSnapshot]

    @State private var selectedDate: Date?
    @State private var isFullscreen: Bool = false

    var body: some View {
        if classifiers.isEmpty {
            EmptyView()
        } else {
            content
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Score history")
                    .font(.headline)
                Spacer()
                Button {
                    isFullscreen = true
                } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Expand chart")
            }

            ChartCanvas(
                classifiers: classifiers,
                history: history,
                selectedDate: $selectedDate,
                trailingPadding: 20,
                xTickCount: 5
            )
            .frame(height: 240)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
        .fullScreenCover(isPresented: $isFullscreen) {
            FullscreenChartView(classifiers: classifiers, history: history)
        }
    }
}
