import SwiftUI
import USPSADomain

struct SummaryCard: View {
    let record: ShooterRecord
    let division: Division?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(record.name)
                    .font(.title2.bold())
                Text("Member \(record.memberNumber) · \(record.membershipType.rawValue)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if let division, let info = record.currentClasses[division] {
                HStack(alignment: .firstTextBaseline, spacing: 16) {
                    Text(info.letter.rawValue)
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .frame(minWidth: 80, alignment: .leading)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(division.displayName)
                            .font(.headline)
                        Text(String(format: "%.2f%%", info.percent))
                            .font(.title3)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                        Text("All-time high \(String(format: "%.2f%%", info.highPercent))")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .monospacedDigit()
                    }
                }
            } else if division != nil {
                Text("No current class in this division.")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
