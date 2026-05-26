import SwiftUI
import Charts
import USPSADomain
import USPSARules

// Shared Swift Charts composition used by the inline ProgressChartView
// and the full-screen FullscreenChartView. Owns the Marks, axes, gesture
// handling, and the selection-detail card. Parents own the @State for
// selectedDate and pass it in as a Binding.
//
// The detail card lives OUTSIDE the Chart deliberately: in-chart annotations
// render BEHIND data marks (lines/dots cut through the card content), and
// clamping annotation overflow to chart bounds still leaves no room for
// 7-8 score major-match days. A sibling card sidesteps both — no z-order
// fight with marks, no overflow into neighboring cards.
//
// The chart and the card are exposed as separate views (body + the public
// selectionDetailCard property) so each consumer can lay them out per its
// own space budget: inline stacks vertically and lets the card flow,
// portrait fullscreen reserves fixed card height with internal scrolling,
// landscape fullscreen puts the card on the trailing side using the
// horizontal real estate instead of fighting for vertical space.
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
        chartView
    }

    // Public so parents can place the detail card anywhere they want
    // relative to the chart — VStack below for inline + portrait fullscreen,
    // HStack trailing for landscape fullscreen. The card reads selectedDate
    // through the same Binding the chart writes to, so they stay in sync
    // even rendered in separate locations.
    @ViewBuilder
    var selectionDetailCard: some View {
        if let selectedDate {
            populatedCard(for: selectedDate)
        } else {
            emptyStateCard
        }
    }

    private var chartView: some View {
        Chart {
            ForEach(Self.bands, id: \.letter) { band in
                RuleMark(y: .value("Threshold", band.threshold))
                    .foregroundStyle(band.letter.fillColor.opacity(0.55))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 2]))
                    .annotation(position: .trailing, alignment: .leading, spacing: 4) {
                        Text(band.letter.rawValue)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(band.letter.fillColor)
                    }
                    .accessibilityLabel("\(band.letter.rawValue) class threshold")
                    .accessibilityValue("\(Int(band.threshold)) percent")
            }

            // Vertical scrub guide. No annotation — the detail card lives
            // outside the Chart now, so this rule only has to communicate
            // "this is the X position you're inspecting".
            if let selectedDate {
                RuleMark(x: .value("Selected", selectedDate))
                    .foregroundStyle(.secondary.opacity(0.45))
                    .lineStyle(StrokeStyle(lineWidth: 1))
            }

            ForEach(pointData) { point in
                PointMark(
                    x: .value("Date", point.date),
                    y: .value("Percent", point.percent)
                )
                .foregroundStyle(classFor(point.percent).fillColor)
                .symbolSize(isSelected(point) ? 110 : 50)
                .opacity(selectedDate == nil || isSelected(point) ? 1.0 : 0.55)
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
        .chartPlotStyle { plot in
            plot.padding(.trailing, trailingPadding)
        }
        // Combined gesture: tap snaps to the nearest point (or clears if the
        // tap lands >30pt from any), long-press-and-drag scrubs Health/Stocks
        // style. We drive selectedDate ourselves rather than relying on
        // .chartXSelection(value:) because chartGesture overrides the
        // built-in scrub gesture — having chartGesture with only a tap
        // recognizer silently disabled press-and-drag entirely. The
        // sequenced LongPress→Drag coexists with the surrounding ScrollView
        // in inline mode because the long-press defers gesture ownership
        // until after its activation threshold.
        .chartGesture { proxy in
            SimultaneousGesture(
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
                    },
                LongPressGesture(minimumDuration: 0.15)
                    .sequenced(before: DragGesture(minimumDistance: 0))
                    .onChanged { value in
                        guard case .second(true, let drag?) = value else { return }
                        guard let (touchedDate, _): (Date, Double) = proxy.value(at: drag.location)
                        else { return }
                        let nearest = pointData.min { a, b in
                            abs(a.date.timeIntervalSince(touchedDate)) < abs(b.date.timeIntervalSince(touchedDate))
                        }
                        if let nearest {
                            selectedDate = nearest.date
                        }
                    }
            )
        }
        // Apple Health / Stocks emit a selection haptic when scrubbing
        // across data points; match that.
        .sensoryFeedback(.selection, trigger: selectedDate)
    }

    private var emptyStateCard: some View {
        HStack(spacing: 8) {
            Image(systemName: "hand.point.up.left")
                .font(.footnote)
                .foregroundStyle(.tertiary)
            Text("Tap or press a point for details")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private func populatedCard(for date: Date) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(date, format: .dateTime.month().day().year())
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
            ForEach(selectedPoints) { p in
                HStack(spacing: 10) {
                    Circle()
                        .fill(classFor(p.percent).fillColor)
                        .frame(width: 8, height: 8)
                    Text(p.code)
                        .font(.footnote.monospaced())
                        .foregroundStyle(.primary)
                    Spacer(minLength: 8)
                    Text(String(format: "%.4f%%", p.percent))
                        .font(.footnote.monospaced())
                        .foregroundStyle(.primary)
                }
            }
            if let avg = selectedAverage {
                Divider()
                HStack(spacing: 10) {
                    Circle().fill(Color.cyan).frame(width: 8, height: 8)
                    Text("Classification")
                        .font(.footnote)
                        .foregroundStyle(.primary)
                    Spacer(minLength: 8)
                    Text(String(format: "%.4f%%", avg))
                        .font(.footnote.monospaced())
                        .foregroundStyle(.primary)
                }
            }
        }
    }

    private func isSelected(_ point: PointEntry) -> Bool {
        guard let selectedDate else { return false }
        let cal = Calendar(identifier: .gregorian)
        return cal.isDate(point.date, inSameDayAs: selectedDate)
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
