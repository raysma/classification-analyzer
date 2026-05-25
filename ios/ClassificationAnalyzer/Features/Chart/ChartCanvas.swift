import SwiftUI
import Charts
import USPSADomain
import USPSARules

// Shared Swift Charts composition used by both the inline ProgressChartView
// and the full-screen FullscreenChartView. Owns the Marks, axes, gesture
// handling, and hover-card annotation. Parents own the @State for
// selectedDate and pass it in as a Binding.
struct ChartCanvas: View {
    let classifiers: [Classifier]
    let history: [ClassificationSnapshot]
    @Binding var selectedDate: Date?

    // Tuning knobs per surface. Inline portrait gets a tighter trailing
    // gutter and fewer X ticks; landscape fullscreen gets more of both.
    var trailingPadding: CGFloat = 20
    var xTickCount: Int = 5

    struct PointEntry: Hashable, Identifiable {
        let date: Date
        let percent: Double
        let code: String
        let name: String?
        var id: String { "\(Int(date.timeIntervalSince1970))-\(code)" }
    }

    struct LineEntry: Hashable, Identifiable {
        let date: Date
        let percent: Double
        var id: TimeInterval { date.timeIntervalSince1970 }
    }

    private static let bands: [(letter: ClassLetter, threshold: Double)] = [
        (.gm, 95), (.m, 85), (.a, 75), (.b, 60), (.c, 40), (.d, 2),
    ]

    var pointData: [PointEntry] {
        let sorted = classifiers.sorted { $0.date < $1.date }
        var seen = Set<String>()
        return sorted.compactMap { c in
            let key = "\(c.date):\(c.classifierCode)"
            if seen.contains(key) { return nil }
            seen.insert(key)
            guard let date = parseIsoDate(c.date) else { return nil }
            return PointEntry(date: date, percent: c.percent, code: c.classifierCode, name: c.classifierName)
        }
    }

    var lineData: [LineEntry] {
        history.compactMap { h in
            guard let date = parseIsoDate(h.date) else { return nil }
            return LineEntry(date: date, percent: h.percent)
        }
    }

    private var selectedPoints: [PointEntry] {
        guard let selectedDate else { return [] }
        let cal = Calendar(identifier: .gregorian)
        return pointData.filter { cal.isDate($0.date, inSameDayAs: selectedDate) }
    }

    private var selectedAverage: Double? {
        guard let selectedDate else { return nil }
        let cal = Calendar(identifier: .gregorian)
        return lineData.last { cal.isDate($0.date, inSameDayAs: selectedDate) || $0.date < selectedDate }?.percent
    }

    var body: some View {
        Chart {
            ForEach(Self.bands, id: \.letter) { band in
                RuleMark(y: .value("Threshold", band.threshold))
                    .foregroundStyle(color(for: band.letter).opacity(0.55))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 2]))
                    .annotation(position: .trailing, alignment: .leading, spacing: 4) {
                        Text(band.letter.rawValue)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(color(for: band.letter))
                    }
                    .accessibilityLabel("\(band.letter.rawValue) class threshold")
                    .accessibilityValue("\(Int(band.threshold)) percent")
            }

            ForEach(pointData) { point in
                PointMark(
                    x: .value("Date", point.date),
                    y: .value("Percent", point.percent)
                )
                .foregroundStyle(color(for: classFor(point.percent)))
                .symbolSize(isSelected(point) ? 110 : 50)
                .opacity(selectedDate == nil || isSelected(point) ? 1.0 : 0.55)
                // Annotation tracks the selected point and stays inside the
                // chart bounds via overflowResolution. Only the first sorted
                // point on the selected date renders the card so we get one
                // card per selection, not one per matching dot.
                .annotation(
                    position: .automatic,
                    alignment: .center,
                    overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                ) {
                    if isHoverAnchor(point) {
                        hoverCard
                    }
                }
                .accessibilityLabel(accessibilityLabel(for: point))
                .accessibilityValue(String(format: "%.2f percent", point.percent))
            }

            ForEach(lineData) { entry in
                LineMark(
                    x: .value("Date", entry.date),
                    y: .value("Classification %", entry.percent),
                    series: .value("Series", "Avg")
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(Color.cyan)
                .lineStyle(StrokeStyle(lineWidth: 2))
                .accessibilityLabel("Classification rolling average")
                .accessibilityValue(
                    "\(String(format: "%.2f", entry.percent)) percent on \(entry.date.formatted(date: .abbreviated, time: .omitted))"
                )
            }
        }
        .chartYScale(domain: 0...110)
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine().foregroundStyle(.tertiary.opacity(0.4))
                AxisValueLabel {
                    if let pct = value.as(Double.self) {
                        Text("\(Int(pct))%")
                            .font(.caption2)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: xTickCount)) { _ in
                AxisGridLine().foregroundStyle(.tertiary.opacity(0.4))
                AxisValueLabel(format: .dateTime.month(.abbreviated).year(.twoDigits))
                    .font(.caption2)
            }
        }
        .chartXSelection(value: $selectedDate)
        .chartPlotStyle { plot in
            plot.padding(.trailing, trailingPadding)
        }
        // Use chartGesture (iOS 17+) instead of chartOverlay.onTapGesture —
        // chartOverlay's tap gesture fights ScrollView gestures on iOS 18+
        // and the tap gets swallowed by the scroll. Tap snaps to the nearest
        // point if it's within 30pt; otherwise the selection is cleared so
        // the hover card disappears without leaving the view.
        .chartGesture { proxy in
            SpatialTapGesture()
                .onEnded { value in
                    guard let (touchedDate, _): (Date, Double) = proxy.value(at: value.location)
                    else { return }
                    let nearest = pointData.min { a, b in
                        abs(a.date.timeIntervalSince(touchedDate)) < abs(b.date.timeIntervalSince(touchedDate))
                    }
                    if let nearest,
                       let nearestX: CGFloat = proxy.position(forX: nearest.date),
                       abs(nearestX - value.location.x) <= 30 {
                        selectedDate = nearest.date
                    } else {
                        selectedDate = nil
                    }
                }
        }
        // Apple Health / Stocks emit a selection haptic when scrubbing
        // across data points; match that.
        .sensoryFeedback(.selection, trigger: selectedDate)
    }

    private var hoverCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let selectedDate {
                Text(selectedDate, format: .dateTime.month().day().year())
                    .font(.caption.weight(.semibold))
            }
            ForEach(selectedPoints) { p in
                HStack(spacing: 6) {
                    Circle()
                        .fill(color(for: classFor(p.percent)))
                        .frame(width: 8, height: 8)
                    Text(p.code)
                        .font(.caption.monospaced())
                    Text(String(format: "%.4f%%", p.percent))
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
            if let avg = selectedAverage {
                HStack(spacing: 6) {
                    Circle().fill(Color.cyan).frame(width: 8, height: 8)
                    Text("Classification")
                        .font(.caption)
                    Text(String(format: "%.4f%%", avg))
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(8)
        .refinedSurface(corner: 8)
    }

    private func isSelected(_ point: PointEntry) -> Bool {
        guard let selectedDate else { return false }
        let cal = Calendar(identifier: .gregorian)
        return cal.isDate(point.date, inSameDayAs: selectedDate)
    }

    private func isHoverAnchor(_ point: PointEntry) -> Bool {
        guard let selectedDate else { return false }
        let cal = Calendar(identifier: .gregorian)
        let onSelectedDate = pointData.first { cal.isDate($0.date, inSameDayAs: selectedDate) }
        return onSelectedDate?.id == point.id
    }

    private func color(for letter: ClassLetter) -> Color {
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

    private func accessibilityLabel(for point: PointEntry) -> String {
        let dateText = point.date.formatted(date: .abbreviated, time: .omitted)
        let nameSuffix = point.name.map { ", \($0)" } ?? ""
        return "Classifier \(point.code) on \(dateText)\(nameSuffix)"
    }
}

private func parseIsoDate(_ iso: String) -> Date? {
    let parts = iso.split(separator: "-")
    guard parts.count == 3,
          let y = Int(parts[0]),
          let m = Int(parts[1]),
          let d = Int(parts[2])
    else { return nil }
    var components = DateComponents()
    components.year = y
    components.month = m
    components.day = d
    components.timeZone = TimeZone(secondsFromGMT: 0)
    return Calendar(identifier: .gregorian).date(from: components)
}
