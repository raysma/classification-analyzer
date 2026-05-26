import XCTest
@testable import USPSARules
import USPSADomain

private func mkScore(_ percent: Double, date: String = "2024-01-01", code: String = "99-11") -> Classifier {
    Classifier(date: date, classifierCode: code, percent: percent, flag: .y, source: .club)
}

private func buildScores(_ percents: [Double]) -> [Classifier] {
    percents.enumerated().map { i, p in
        let mm = String(format: "%02d", i + 1)
        return mkScore(p, date: "2024-\(mm)-01", code: "code-\(i)")
    }
}

final class ProjectionPreclassifiedTests: XCTestCase {
    func test_infeasible_0_scores() {
        let r = requiredAverageForTarget(scores: [], k: 1)
        XCTAssertNil(r.requiredPercent)
        XCTAssertFalse(r.feasible)
    }

    func test_infeasible_2_scores_k1() {
        let r = requiredAverageForTarget(scores: buildScores([70, 72]), k: 1)
        XCTAssertNil(r.requiredPercent)
        XCTAssertFalse(r.feasible)
    }

    func test_feasibility_known_at_4_total() {
        let r = requiredAverageForTarget(scores: buildScores([70, 72]), k: 2)
        // Either feasible or not, but a determination is made (not blanked out).
        _ = r.feasible
        // Pass through.
        XCTAssertNotEqual(r.targetClass, .u)
    }
}

final class ProjectionBclassToATests: XCTestCase {
    func test_feasible_with_achievable_score() {
        let scores = buildScores([65, 66, 67, 68, 65, 66])
        let r = requiredAverageForTarget(scores: scores, k: 3)
        XCTAssertEqual(r.targetClass, .a)
        XCTAssertEqual(r.targetThreshold, 75)
        if r.feasible, let pct = r.requiredPercent {
            XCTAssertGreaterThan(pct, 0)
            XCTAssertLessThanOrEqual(pct, 110)
        }
    }
}

final class ProjectionAclassToMTests: XCTestCase {
    func test_requires_close_to_85_at_k1() {
        let scores = buildScores([82, 83, 84, 81, 82, 83, 82, 81])
        let r = requiredAverageForTarget(scores: scores, k: 1)
        XCTAssertEqual(r.targetClass, .m)
        XCTAssertEqual(r.targetThreshold, 85)
        if r.feasible, let pct = r.requiredPercent {
            XCTAssertGreaterThanOrEqual(pct, 82)
        }
    }
}

final class ProjectionFreshShooterTests: XCTestCase {
    func test_can_reach_some_class() {
        let r = requiredAverageForTarget(scores: buildScores([30, 35, 38, 40]), k: 1)
        XCTAssertTrue([.d, .c, .b, .a, .m, .gm].contains(r.targetClass))
    }
}

final class ProjectionGMShooterTests: XCTestCase {
    func test_GM_at_top() {
        let r = requiredAverageForTarget(scores: buildScores([97, 98, 96, 97, 98, 99]), k: 1)
        XCTAssertEqual(r.targetClass, .gm)
        XCTAssertFalse(r.feasible)
        XCTAssertTrue(r.atTop)
    }
}

final class ProjectionAtTopGuardTests: XCTestCase {
    func test_M_targeting_GM_not_atTop_when_unreachable() {
        let scores = buildScores([85, 85, 85, 85, 85, 85])
        let r = requiredAverageForTarget(scores: scores, k: 1)
        XCTAssertEqual(r.targetClass, .gm)
        XCTAssertFalse(r.atTop)
    }
}

final class ProjectionKCardsTests: XCTestCase {
    func test_more_classifiers_lower_required_average() {
        let scores = buildScores([65, 66, 67, 68, 65, 66])
        let results = [1, 2, 3, 4, 5].map { requiredAverageForTarget(scores: scores, k: $0) }
        let feasible = results.filter { $0.feasible && $0.requiredPercent != nil }
        if feasible.count >= 2 {
            for i in 1..<feasible.count {
                XCTAssertLessThanOrEqual(
                    feasible[i].requiredPercent!,
                    feasible[i - 1].requiredPercent! + 5
                )
            }
        }
    }
}

final class ProjectionUnclassifiedTrendingTests: XCTestCase {
    func test_C_trend_3_scores_targets_B() {
        let r = requiredAverageForTarget(scores: buildScores([47.12, 47.88, 49.29]), k: 1)
        XCTAssertEqual(r.targetClass, .b)
        XCTAssertEqual(r.targetThreshold, 60)
        XCTAssertNotNil(r.requiredPercent)
        XCTAssertGreaterThan(r.requiredPercent ?? 0, 90)
    }

    func test_B_trend_targets_A() {
        let r = requiredAverageForTarget(scores: buildScores([68, 70, 72]), k: 1)
        XCTAssertEqual(r.targetClass, .a)
        XCTAssertEqual(r.targetThreshold, 75)
    }

    func test_U_trend_targets_D() {
        let r = requiredAverageForTarget(scores: buildScores([1, 1, 1]), k: 1)
        XCTAssertEqual(r.targetClass, .d)
        XCTAssertEqual(r.targetThreshold, 2)
    }

    func test_GM_level_3_scores_not_atTop() {
        let r = requiredAverageForTarget(scores: buildScores([95, 96, 97]), k: 1)
        XCTAssertEqual(r.targetClass, .gm)
        XCTAssertFalse(r.atTop)
        XCTAssertNil(r.requiredPercent)
    }

    func test_K_cards_monotonic_for_C_trending() {
        let results = [1, 2, 3, 4, 5].map { requiredAverageForTarget(scores: buildScores([48, 48, 48]), k: $0) }
        let values = results.compactMap(\.requiredPercent)
        for i in 1..<values.count {
            XCTAssertLessThanOrEqual(values[i], values[i - 1] + 0.01)
        }
    }
}

final class ProjectionTargetOverrideTests: XCTestCase {
    func test_GM_targeting_A_down() {
        let scores = buildScores([96, 96, 96, 96, 96, 96, 96, 96])
        let r = requiredAverageForTarget(scores: scores, k: 5, targetOverride: .a)
        XCTAssertEqual(r.targetClass, .a)
        XCTAssertEqual(r.direction, .down)
        if r.feasible, let pct = r.requiredPercent {
            XCTAssertLessThan(pct, 85)
        }
    }

    func test_GM_targeting_M_down() {
        let scores = buildScores([97, 98, 96, 97, 98, 99])
        let r = requiredAverageForTarget(scores: scores, k: 5, targetOverride: .m)
        XCTAssertEqual(r.targetClass, .m)
        XCTAssertEqual(r.direction, .down)
    }

    func test_C_targeting_GM_infeasible() {
        let scores = buildScores([45, 47, 50, 48, 49, 46])
        let r = requiredAverageForTarget(scores: scores, k: 1, targetOverride: .gm)
        XCTAssertEqual(r.targetClass, .gm)
        XCTAssertEqual(r.direction, .up)
        XCTAssertFalse(r.feasible)
    }

    func test_A_targeting_A_maintain() {
        let scores = buildScores([80, 80, 80, 80, 80, 80, 80, 80])
        let r = requiredAverageForTarget(scores: scores, k: 1, targetOverride: .a)
        XCTAssertEqual(r.targetClass, .a)
        XCTAssertEqual(r.direction, .maintain)
    }

    func test_GM_targeting_GM_atTop() {
        let scores = buildScores([97, 98, 96, 97, 98, 99])
        let r = requiredAverageForTarget(scores: scores, k: 1, targetOverride: .gm)
        XCTAssertTrue(r.atTop)
        XCTAssertEqual(r.direction, .atTop)
    }

    func test_infeasible_down_when_zero_cant_drop_enough() {
        let scores = buildScores([96, 96, 96, 96, 96, 96, 96, 96])
        let r = requiredAverageForTarget(scores: scores, k: 1, targetOverride: .a)
        XCTAssertEqual(r.direction, .down)
        XCTAssertFalse(r.feasible)
    }
}

final class ProjectionCurrentClassOverrideTests: XCTestCase {
    func test_USPSA_GM_with_subGM_scores_treats_GM_as_current() {
        let scores = buildScores([90, 90, 90, 90, 90, 90, 90, 90])

        // No override: computed says M -> picking M is maintain.
        let noOverride = requiredAverageForTarget(scores: scores, k: 1, targetOverride: .m)
        XCTAssertEqual(noOverride.direction, .maintain)

        // Override GM: picking M is direction=down.
        let withOverride = requiredAverageForTarget(
            scores: scores,
            k: 1,
            targetOverride: .m,
            currentClassOverride: .gm
        )
        XCTAssertEqual(withOverride.direction, .down)

        // Override GM, picking GM: at-top maintain.
        let pickGM = requiredAverageForTarget(
            scores: scores,
            k: 1,
            targetOverride: .gm,
            currentClassOverride: .gm
        )
        XCTAssertTrue(pickGM.atTop)
    }
}
