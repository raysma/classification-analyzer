// Binary-search projection. Ported from src/lib/projection.ts.
import Foundation
import USPSADomain

public enum ProjectionDirection: String, Sendable, Hashable {
    case up
    case down
    case maintain
    case atTop = "at-top"
}

public struct RequiredAverageResult: Sendable, Hashable {
    // For up/maintain: minimum average per classifier to reach/keep target.
    // For down: maximum average per classifier to drop into target.
    public let requiredPercent: Double?
    public let direction: ProjectionDirection
    public let feasible: Bool
    public let targetClass: ClassLetter
    public let targetThreshold: Double
    public let scoresInWindow: Int
    public let atTop: Bool
}

private let classThresholdLowerBound: [ClassLetter: Double] = [
    .gm: 95, .m: 85, .a: 75, .b: 60, .c: 40, .d: 2, .u: 0,
]

// Lowest-to-highest; U is below D for "unclassified" ordering.
private let classOrder: [ClassLetter] = [.u, .d, .c, .b, .a, .m, .gm]

private func classRank(_ c: ClassLetter) -> Int {
    classOrder.firstIndex(of: c) ?? -1
}

private func classAbove(_ c: ClassLetter) -> ClassLetter? {
    guard let idx = classOrder.firstIndex(of: c) else { return nil }
    if idx >= classOrder.count - 1 { return nil }
    return classOrder[idx + 1]
}

private func simulateAppends(window: RollingWindow, k: Int, uniformPercent: Double) -> Double? {
    var clone = window
    for i in 0..<k {
        let synthetic = Classifier(
            date: "9999-01-01",
            classifierCode: "synthetic-\(i)",
            percent: uniformPercent,
            flag: .y,
            source: .club
        )
        clone.append(synthetic)
    }
    return clone.classificationScore()
}

// The class the shooter is effectively at — their official sticky class if
// known, or a best-guess trending class from the simple mean for unclassified
// shooters.
private func effectiveCurrentClass(_ scores: [Classifier]) -> ClassLetter {
    let history = getClassificationHistory(scores)
    let best = allTimeBestClass(history)
    if best != .u { return best }
    if scores.isEmpty { return .u }
    let avg = scores.map(\.percent).reduce(0, +) / Double(scores.count)
    return classFor(avg)
}

public func requiredAverageForTarget(
    scores: [Classifier],
    k: Int,
    targetOverride: ClassLetter? = nil,
    currentClassOverride: ClassLetter? = nil
) -> RequiredAverageResult {
    // Use the explicit current-class override when provided (typically USPSA's
    // authoritative letter from the parsed Classifications table).
    let current: ClassLetter = {
        if let override = currentClassOverride, override != .u { return override }
        return effectiveCurrentClass(scores)
    }()

    let history = getClassificationHistory(scores)
    // "Officially classified GM" requires either an explicit override OR a
    // real GM-level snapshot in computed history — NOT just trending GM with
    // fewer than 4 scores.
    let officiallyClassifiedGM = (currentClassOverride == .gm) || (allTimeBestClass(history) == .gm)

    // Resolve target: explicit override wins, otherwise default to "next class up".
    let target: ClassLetter
    if let override = targetOverride, override != .u {
        target = override
    } else if let above = classAbove(current) {
        target = above
    } else {
        // current is GM with no override — celebrate or stall depending on whether
        // they're actually classified GM.
        return RequiredAverageResult(
            requiredPercent: nil,
            direction: .atTop,
            feasible: false,
            targetClass: .gm,
            targetThreshold: 95,
            scoresInWindow: 0,
            atTop: officiallyClassifiedGM
        )
    }

    let currentRank = classRank(current)
    let targetRank = classRank(target)
    let direction: ProjectionDirection
    if currentRank < targetRank { direction = .up }
    else if currentRank > targetRank { direction = .down }
    else { direction = .maintain }

    // At-top special case: target GM, currently GM (only when actually classified).
    if target == .gm, direction == .maintain, officiallyClassifiedGM {
        return RequiredAverageResult(
            requiredPercent: nil,
            direction: .atTop,
            feasible: false,
            targetClass: .gm,
            targetThreshold: 95,
            scoresInWindow: 0,
            atTop: true
        )
    }

    let targetLowerBound = classThresholdLowerBound[target] ?? 0
    let targetUpperBound: Double = {
        if let above = classAbove(target), let upper = classThresholdLowerBound[above] {
            return upper
        }
        return 110
    }()

    let window = getCurrentWindow(scores)
    let windowScores = window.scores
    let included = bestSixOfRecentEight(windowScores).included

    // Need at least 4 scores total after K appends.
    let totalAfterK = windowScores.count + k
    if totalAfterK < 4 {
        return RequiredAverageResult(
            requiredPercent: nil,
            direction: direction,
            feasible: false,
            targetClass: target,
            targetThreshold: direction == .down ? targetUpperBound : targetLowerBound,
            scoresInWindow: windowScores.count,
            atTop: false
        )
    }

    let MIN_SCORE: Double = 0
    let MAX_SCORE: Double = 110

    if direction == .up || direction == .maintain {
        // Minimum X such that the resulting average is >= targetLowerBound.
        let atMax = simulateAppends(window: window, k: k, uniformPercent: MAX_SCORE)
        if atMax == nil || atMax! < targetLowerBound {
            return RequiredAverageResult(
                requiredPercent: MAX_SCORE,
                direction: direction,
                feasible: false,
                targetClass: target,
                targetThreshold: targetLowerBound,
                scoresInWindow: included.count,
                atTop: false
            )
        }

        var lo: Double = 0
        var hi: Double = MAX_SCORE
        for _ in 0..<60 {
            let mid = (lo + hi) / 2
            let pct = simulateAppends(window: window, k: k, uniformPercent: mid)
            if let pct, pct >= targetLowerBound {
                hi = mid
            } else {
                lo = mid
            }
            if hi - lo < 0.01 { break }
        }

        return RequiredAverageResult(
            requiredPercent: (hi * 100).rounded(.up) / 100,
            direction: direction,
            feasible: true,
            targetClass: target,
            targetThreshold: targetLowerBound,
            scoresInWindow: included.count,
            atTop: false
        )
    }

    // direction == .down — find max X such that resulting avg < targetUpperBound.
    let atMin = simulateAppends(window: window, k: k, uniformPercent: MIN_SCORE)
    if atMin == nil || atMin! >= targetUpperBound {
        return RequiredAverageResult(
            requiredPercent: MIN_SCORE,
            direction: .down,
            feasible: false,
            targetClass: target,
            targetThreshold: targetUpperBound,
            scoresInWindow: included.count,
            atTop: false
        )
    }

    var lo: Double = MIN_SCORE
    var hi: Double = MAX_SCORE
    for _ in 0..<60 {
        let mid = (lo + hi) / 2
        let pct = simulateAppends(window: window, k: k, uniformPercent: mid)
        if let pct, pct < targetUpperBound {
            lo = mid
        } else {
            hi = mid
        }
        if hi - lo < 0.01 { break }
    }

    return RequiredAverageResult(
        requiredPercent: (lo * 100).rounded(.down) / 100,
        direction: .down,
        feasible: true,
        targetClass: target,
        targetThreshold: targetUpperBound,
        scoresInWindow: included.count,
        atTop: false
    )
}
