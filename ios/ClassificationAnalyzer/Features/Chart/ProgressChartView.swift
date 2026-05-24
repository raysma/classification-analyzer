import SwiftUI
import Charts
import USPSADomain
import USPSARules

struct ProgressChartView: View {
    let classifiers: [Classifier]
    let history: [ClassificationSnapshot]

    @State private var selectedDate: Date?

    private struct PointEntry: Hashable, Identifiable {
        let date: Date
        let percent: Double
        let code: String
        let name: String?
        var id: String { "\(Int(date.timeIntervalSince1970))-\(code)" }
    }

    private struct LineEntry: Hashable, Identifiable {
        let date: Date
        let percent: Double
        var id: TimeInterval { date.timeIntervalSince1970 }
    }

    private static let bands: [(letter: ClassLetter, threshold: Double)] = [
        (.gm, 95), (.m, 85), (.a, 75), (.b, 60), (.c, 40), (.d, 2),
    ]

    private var pointData: [PointEntry] {
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

    private var lineData: [LineEntry] {
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
        return lineData.last(where: { cal.isDate($0.date, inSameDayAs: selectedDate) || $0.date < selectedDate })?.percent
    }

    var body: some View {
        if pointData.isEmpty {
            EmptyView()
        } else {
            content
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Score history")
                .font(.headline)

            Chart {
                ForEach(Self.bands, id: \.letter) { band in
                    RuleMark(y: .value("Threshold", band.threshold))
                        .foregroundStyle(color(for: band.letter).opacity(0.55))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 2]))
                        .annotation(position: .trailing, alignment: .leading) {
                            Text(band.letter.rawValue)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(color(for: band.letter))
                                .padding(.leading, 4)
                        }
                }

                ForEach(pointData) { point in
                    PointMark(
                        x: .value("Date", point.date),
                        y: .value("Percent", point.percent)
                    )
                    .foregroundStyle(color(for: classFor(point.percent)))
                    .symbolSize(isSelected(point) ? 110 : 50)
                    .opacity(selectedDate == nil || isSelected(point) ? 1.0 : 0.55)
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
                }
            }
            .chartYScale(domain: 0...110)
            .chartYAxis {
                AxisMarks { value in
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
                AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                    AxisGridLine().foregroundStyle(.tertiary.opacity(0.4))
                    AxisValueLabel(format: .dateTime.month(.abbreviated).year(.twoDigits))
                        .font(.caption2)
                }
            }
            .chartXSelection(value: $selectedDate)
            .frame(height: 240)
            .padding(.trailing, 20)

            if !selectedPoints.isEmpty {
                hoverCard
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
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
