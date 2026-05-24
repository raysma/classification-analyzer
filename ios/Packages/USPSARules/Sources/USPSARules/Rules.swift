// Rolling-window classification math.
// Ported from src/lib/rules.ts (originally from uspsaprogress/progress, ISC).
import Foundation
import USPSADomain

// Flags excluded from the rolling-window computation.
// I/Q/N: admin / DQ / DNF (always excluded).
// B/C/D/G: retired April 2025; historical scores still carry them but they
// are not part of any current calculation.
private let excludedFlags: Set<Flag> = [.i, .q, .n, .b, .c, .d, .g]

public func isInvalidFlag(_ flag: Flag) -> Bool {
    excludedFlags.contains(flag)
}

private struct ClassThreshold {
    let min: Double
    let letter: ClassLetter
}

private let classThresholds: [ClassThreshold] = [
    .init(min: 95, letter: .gm),
    .init(min: 85, letter: .m),
    .init(min: 75, letter: .a),
    .init(min: 60, letter: .b),
    .init(min: 40, letter: .c),
    .init(min: 2, letter: .d),
]

public func classFor(_ percent: Double) -> ClassLetter {
    for t in classThresholds where percent >= t.min {
        return t.letter
    }
    return .u
}

public func nextClassThreshold(_ current: ClassLetter) -> Double? {
    guard let idx = classThresholds.firstIndex(where: { $0.letter == current }) else {
        return nil
    }
    if idx <= 0 { return nil } // GM has no next
    return classThresholds[idx - 1].min
}

public func sortClassifiers(_ scores: [Classifier]) -> [Classifier] {
    scores.sorted { a, b in
        if a.date != b.date { return a.date < b.date }
        return a.percent < b.percent
    }
}

public struct BestSixResult: Sendable, Hashable {
    public let included: [Classifier]
    public let dropped: [Classifier]
}

// Per USPSA rules (April 2025):
// n=4 → mean of all 4; n=5 → mean of all 5; n=6 → mean of 6;
// n=7 → best 6 of 7; n≥8 → best 6 of the most recent 8.
// n<4 → no classification yet, but scores are still in-window (not dropped).
public func bestSixOfRecentEight(_ scores: [Classifier]) -> BestSixResult {
    let n = scores.count
    if n == 0 { return BestSixResult(included: [], dropped: []) }
    if n <= 6 { return BestSixResult(included: scores, dropped: []) }

    let pool = n >= 8 ? Array(scores.suffix(8)) : scores
    let sorted = pool.sorted { $0.percent > $1.percent }
    let included = Array(sorted.prefix(6))
    let includedSet = Set(included)
    let dropped = pool.filter { !includedSet.contains($0) }
    return BestSixResult(included: included, dropped: dropped)
}

public struct RollingWindow: Sendable, Hashable {
    public private(set) var scores: [Classifier] = []

    public init() {}

    public mutating func append(_ c: Classifier) {
        if isInvalidFlag(c.flag) { return }
        // MRO: drop any prior score with the same classifierCode.
        scores.removeAll { $0.classifierCode == c.classifierCode }
        scores.append(c)
        if scores.count > 8 {
            scores = Array(scores.suffix(8))
        }
    }

    public func classificationScore() -> Double? {
        let result = bestSixOfRecentEight(scores)
        if result.included.count < 4 { return nil }
        let sum = result.included.reduce(0.0) { $0 + $1.percent }
        return sum / Double(result.included.count)
    }
}

public func getCurrentWindow(_ scores: [Classifier]) -> RollingWindow {
    let sorted = sortClassifiers(scores)
    var window = RollingWindow()
    for s in sorted {
        window.append(s)
    }
    return window
}

public func getClassificationHistory(_ scores: [Classifier]) -> [ClassificationSnapshot] {
    let sorted = sortClassifiers(scores)
    var window = RollingWindow()
    var history: [ClassificationSnapshot] = []
    for s in sorted {
        window.append(s)
        if let pct = window.classificationScore() {
            let rounded = (pct * 100).rounded() / 100
            history.append(ClassificationSnapshot(
                date: s.date,
                percent: rounded,
                classLetter: classFor(pct)
            ))
        }
    }
    return history
}

private let classOrder: [ClassLetter] = [.u, .d, .c, .b, .a, .m, .gm]

public func rankOf(_ letter: ClassLetter) -> Int {
    classOrder.firstIndex(of: letter) ?? -1
}

public func maxClass(_ a: ClassLetter, _ b: ClassLetter) -> ClassLetter {
    rankOf(a) >= rankOf(b) ? a : b
}

public func allTimeBestClass(_ history: [ClassificationSnapshot]) -> ClassLetter {
    if history.isEmpty { return .u }
    var best: ClassLetter = .u
    for snap in history {
        if rankOf(snap.classLetter) > rankOf(best) {
            best = snap.classLetter
        }
    }
    return best
}

// Sticky-class rule: once you achieve a class in a division, you don't drop
// below it even if the rolling-window percent slips. Displayed letter
// reflects the all-time high % achieved, not the current %.
public func stickyClassFor(currentPercent: Double?, allTimeHighPercent: Double?) -> ClassLetter {
    let high = max(currentPercent ?? 0, allTimeHighPercent ?? 0)
    if high <= 0 { return .u }
    return classFor(high)
}

// USPSA cross-division rule: a classified division (≥4 in-window scores) can
// be no more than one letter below the highest classified division. Returns
// the floor for `scopedDivision` based on every OTHER division's all-time
// best. Returns nil when no other division qualifies (no floor applies).
public func crossDivisionFloorClass(
    classifiersByDivision: [Division: [Classifier]],
    scopedDivision: Division
) -> ClassLetter? {
    var highestRank = -1

    for (div, scores) in classifiersByDivision {
        if div == scopedDivision { continue }
        if scores.count < 4 { continue }

        let window = getCurrentWindow(scores)
        if window.scores.count < 4 { continue }

        let history = getClassificationHistory(scores)
        if history.isEmpty { continue }

        let high = history.map(\.percent).max() ?? 0
        let rank = rankOf(classFor(high))
        if rank > highestRank { highestRank = rank }
    }

    if highestRank < 1 { return nil }
    return classOrder.indices.contains(highestRank - 1) ? classOrder[highestRank - 1] : nil
}
