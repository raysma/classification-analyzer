import SwiftUI
import USPSADomain
import USPSARules

struct ClassUpInsightsView: View {
    let classifiers: [Classifier]
    let division: Division
    let officialClass: ClassInfo?

    @State private var selectedTarget: ClassLetter?

    private static let targetOptions: [ClassLetter] = [.gm, .m, .a, .b, .c, .d]

    private var results: [(k: Int, result: RequiredAverageResult)] {
        (1...5).map { k in
            (
                k,
                requiredAverageForTarget(
                    scores: classifiers,
                    k: k,
                    targetOverride: selectedTarget,
                    currentClassOverride: officialClass?.letter
                )
            )
        }
    }

    var body: some View {
        let first = results[0].result

        Group {
            if first.atTop && selectedTarget == nil {
                atTopCard
            } else if first.requiredPercent == nil && first.direction != .atTop {
                insufficientCard(first: first)
            } else {
                mainGrid(first: first)
            }
        }
    }

    private var atTopCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Congratulations — you're Grand Master in \(division.displayName)! That's the top class.")
                .font(.subheadline)
                .foregroundStyle(.yellow)
            HStack(spacing: 4) {
                Text("Curious how poorly you'd have to shoot to drop down?")
                Button("Pick a class") {
                    selectedTarget = .m
                }
                .buttonStyle(.plain)
                .underline()
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.yellow.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(.yellow.opacity(0.4), lineWidth: 1)
        )
    }

    private func insufficientCard(first: RequiredAverageResult) -> some View {
        let needed = max(0, 4 - first.scoresInWindow)
        let message = needed > 0
            ? "Need \(needed) more classifier\(needed == 1 ? "" : "s") in \(division.displayName) before class-up math applies."
            : "Not enough scores to project class-up yet."
        return Text(message)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func mainGrid(first: RequiredAverageResult) -> some View {
        let isDown = first.direction == .down
        let effectiveTarget = first.targetClass

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("Journey to")
                Picker("Target", selection: targetBinding(default: effectiveTarget)) {
                    ForEach(Self.targetOptions, id: \.self) { cls in
                        Text(cls.rawValue).tag(cls)
                    }
                }
                .pickerStyle(.menu)
                .labelsHidden()
                .tint(.primary)
                Text("class — \(isDown ? "maximum allowed" : "required") average")
            }
            .font(.subheadline.weight(.medium))

            HStack(spacing: 6) {
                ForEach(results, id: \.k) { entry in
                    cardView(k: entry.k, result: entry.result, isDown: isDown)
                }
            }

            Text(
                isDown
                    ? "Maximum average per classifier across the next N to drop into \(effectiveTarget.rawValue) class."
                    : "Assumes uniform average on each of the next N classifiers. Green ≤100%, amber ≤110%, red >110% (not feasible)."
            )
            .font(.caption)
            .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func cardView(k: Int, result: RequiredAverageResult, isDown: Bool) -> some View {
        let tint = tintFor(result: result, isDown: isDown)
        return VStack(spacing: 4) {
            Text(isDown ? "+\(k) ↓" : "+\(k)")
                .font(.caption.weight(.medium))
            if result.feasible, let pct = result.requiredPercent {
                Text(String(format: "%.1f%%", pct))
                    .font(.headline.monospacedDigit())
            } else {
                Text("—")
                    .font(.headline)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(tint.opacity(0.18), in: RoundedRectangle(cornerRadius: 10))
        .foregroundStyle(tint)
    }

    private func tintFor(result: RequiredAverageResult, isDown: Bool) -> Color {
        if !result.feasible || result.requiredPercent == nil { return .red }
        if isDown { return .indigo }
        let pct = result.requiredPercent!
        if pct <= 100 { return .green }
        if pct <= 110 { return .orange }
        return .red
    }

    private func targetBinding(default value: ClassLetter) -> Binding<ClassLetter> {
        Binding(
            get: { selectedTarget ?? value },
            set: { selectedTarget = $0 }
        )
    }
}
