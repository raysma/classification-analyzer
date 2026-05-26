import SwiftUI
import USPSADomain
import USPSARules

struct SummaryCard: View {
    let division: Division
    let projectedPercent: Double?
    let windowSize: Int
    let allTimeHighPercent: Double?
    let officialClass: ClassInfo?
    let crossDivisionFloor: ClassLetter?

    @ScaledMetric(relativeTo: .title) private var percentFontSize: CGFloat = 30

    private var stickyLetter: ClassLetter {
        stickyClassFor(currentPercent: projectedPercent, allTimeHighPercent: allTimeHighPercent)
    }

    private var computedLetter: ClassLetter {
        if let floor = crossDivisionFloor {
            return maxClass(stickyLetter, floor)
        }
        return stickyLetter
    }

    private var displayLetter: ClassLetter {
        officialClass?.letter ?? computedLetter
    }

    private var displayPercent: Double? {
        officialClass?.percent ?? projectedPercent
    }

    private var displayHighPercent: Double? {
        officialClass?.highPercent ?? allTimeHighPercent
    }

    private var isEstimatedHigh: Bool {
        officialClass == nil
    }

    private var showProjected: Bool {
        guard let official = officialClass?.percent, let projected = projectedPercent else {
            return false
        }
        return abs(official - projected) >= 0.01
    }

    private var gap: Double? {
        guard let threshold = nextClassThreshold(displayLetter),
              let percent = displayPercent
        else { return nil }
        let diff = threshold - percent
        return diff > 0 ? diff : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(division.displayName) — Current classification")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            if let percent = displayPercent {
                HStack(alignment: .top, spacing: 16) {
                    classBadge

                    VStack(alignment: .leading, spacing: 4) {
                        Text(String(format: "%.4f%%", percent))
                            .font(.system(size: percentFontSize, weight: .bold))
                            .monospacedDigit()
                            .minimumScaleFactor(0.7)

                        if let gap, let threshold = nextClassThreshold(displayLetter) {
                            Text(String(format: "%.4f%% to %g%%", gap, threshold))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        if showProjected, let projected = projectedPercent {
                            HStack(spacing: 4) {
                                Text("Projected:")
                                Text(String(format: "%.4f%%", projected))
                                    .monospacedDigit()
                                    .fontWeight(.medium)
                                Text("(next stats run)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        }

                        if let high = displayHighPercent {
                            HStack(spacing: 4) {
                                Text("All-time high:")
                                Text(String(format: "%.4f%%", high))
                                    .monospacedDigit()
                                    .fontWeight(.medium)
                                if isEstimatedHigh {
                                    Text("(estimated)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        }

                        if displayLetter == .gm {
                            Text("Grand Master — top class!")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.yellow)
                        }
                    }
                }
            } else {
                Text(
                    windowSize < 4
                        ? "\(windowSize) of 4 scores needed — add \(4 - windowSize) more to get an initial classification."
                        : "No classification yet."
                )
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }

            Text("\(windowSize) score\(windowSize == 1 ? "" : "s") in window")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .refinedSurface()
    }

    private var classBadge: some View {
        Text(displayLetter.rawValue)
            .font(.system(size: 22, weight: .bold))
            .frame(width: 64, height: 64)
            .background(displayLetter.fillColor, in: Circle())
            .foregroundStyle(displayLetter.foregroundColor)
    }
}
