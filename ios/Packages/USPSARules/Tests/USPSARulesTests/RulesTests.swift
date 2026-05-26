import XCTest
@testable import USPSARules
import USPSADomain

private func mkScore(
    _ percent: Double,
    date: String = "2024-01-01",
    code: String = "99-11",
    flag: Flag = .y
) -> Classifier {
    Classifier(date: date, classifierCode: code, percent: percent, flag: flag, source: .club)
}

final class ClassForTests: XCTestCase {
    func testGM_at_95() { XCTAssertEqual(classFor(95), .gm) }
    func testGM_at_110() { XCTAssertEqual(classFor(110), .gm) }
    func testM_at_85() { XCTAssertEqual(classFor(85), .m) }
    func testA_at_75() { XCTAssertEqual(classFor(75), .a) }
    func testB_at_60() { XCTAssertEqual(classFor(60), .b) }
    func testC_at_40() { XCTAssertEqual(classFor(40), .c) }
    func testD_at_2() { XCTAssertEqual(classFor(2), .d) }
    func testU_below_2() { XCTAssertEqual(classFor(1.9), .u) }
    func testBoundaryMA() { XCTAssertEqual(classFor(84.9), .a) }
}

final class InvalidFlagTests: XCTestCase {
    func testExcludesIQN() {
        XCTAssertTrue(isInvalidFlag(.i))
        XCTAssertTrue(isInvalidFlag(.q))
        XCTAssertTrue(isInvalidFlag(.n))
    }

    func testExcludesRetiredBCDG() {
        XCTAssertTrue(isInvalidFlag(.b))
        XCTAssertTrue(isInvalidFlag(.c))
        XCTAssertTrue(isInvalidFlag(.d))
        XCTAssertTrue(isInvalidFlag(.g))
    }

    func testIncludesValid() {
        for f: Flag in [.y, .f, .e, .m, .s, .a, .x, .p, .none] {
            XCTAssertFalse(isInvalidFlag(f), "expected \(f) to be valid")
        }
    }
}

final class BestSixOfRecentEightTests: XCTestCase {
    func test_n4_all_included() {
        let scores = [mkScore(70), mkScore(72), mkScore(74), mkScore(76)]
        let r = bestSixOfRecentEight(scores)
        XCTAssertEqual(r.included.count, 4)
        XCTAssertEqual(r.dropped.count, 0)
    }

    func test_n5_all_included() {
        let scores = [70.0, 72, 74, 76, 78].map { mkScore($0) }
        let r = bestSixOfRecentEight(scores)
        XCTAssertEqual(r.included.count, 5)
        XCTAssertEqual(r.dropped.count, 0)
    }

    func test_n6_all_included() {
        let scores = [70.0, 72, 74, 76, 78, 80].map { mkScore($0) }
        let r = bestSixOfRecentEight(scores)
        XCTAssertEqual(r.included.count, 6)
    }

    func test_n7_best6of7_drops_lowest() {
        let scores = [50.0, 70, 72, 74, 76, 78, 80].map { mkScore($0) }
        let r = bestSixOfRecentEight(scores)
        XCTAssertEqual(r.included.count, 6)
        XCTAssertEqual(r.dropped.count, 1)
        XCTAssertEqual(r.dropped.first?.percent, 50)
    }

    func test_n8_best6of8_drops_two_lowest() {
        let scores = [50.0, 55, 70, 72, 74, 76, 78, 80].map { mkScore($0) }
        let r = bestSixOfRecentEight(scores)
        XCTAssertEqual(r.included.count, 6)
        XCTAssertEqual(r.dropped.count, 2)
        XCTAssertEqual(r.dropped.map(\.percent).sorted(), [50, 55])
    }

    func test_n9_only_most_recent_8() {
        let scores = [10.0, 55, 70, 72, 74, 76, 78, 80, 82].enumerated().map { i, p in
            mkScore(p, date: "2024-0\(i + 1)-01")
        }
        let r = bestSixOfRecentEight(scores)
        XCTAssertEqual(r.included.count, 6)
        XCTAssertEqual(r.dropped.map(\.percent).sorted(), [55, 70])
    }

    func test_n_lt_4_all_included() {
        let r = bestSixOfRecentEight([mkScore(80), mkScore(82), mkScore(75)])
        XCTAssertEqual(r.included.count, 3)
        XCTAssertEqual(r.dropped.count, 0)
    }

    func test_n_0_empty() {
        let r = bestSixOfRecentEight([])
        XCTAssertEqual(r.included.count, 0)
        XCTAssertEqual(r.dropped.count, 0)
    }
}

final class RollingWindowTests: XCTestCase {
    func testMRO_replaces_earlier_same_code() {
        var w = RollingWindow()
        w.append(mkScore(60, date: "2024-01-01", code: "99-11"))
        w.append(mkScore(80, date: "2024-06-01", code: "99-11"))
        XCTAssertEqual(w.scores.count, 1)
        XCTAssertEqual(w.scores.first?.percent, 80)
    }

    func testTruncates_to_8() {
        var w = RollingWindow()
        for i in 1...10 {
            let mm = String(format: "%02d", i)
            w.append(mkScore(60 + Double(i), date: "2024-\(mm)-01", code: "code-\(i)"))
        }
        XCTAssertEqual(w.scores.count, 8)
    }

    func testExcludes_invalid_flags() {
        var w = RollingWindow()
        w.append(mkScore(80, date: "2024-01-01", code: "99-11", flag: .i))
        XCTAssertEqual(w.scores.count, 0)
    }

    func testClassificationScore_nil_below_4() {
        var w = RollingWindow()
        w.append(mkScore(80, date: "2024-01-01", code: "99-11"))
        w.append(mkScore(82, date: "2024-02-01", code: "99-12"))
        XCTAssertNil(w.classificationScore())
    }

    func testClassificationScore_averages_4() {
        var w = RollingWindow()
        w.append(mkScore(80, date: "2024-01-01", code: "a"))
        w.append(mkScore(80, date: "2024-02-01", code: "b"))
        w.append(mkScore(80, date: "2024-03-01", code: "c"))
        w.append(mkScore(80, date: "2024-04-01", code: "d"))
        XCTAssertEqual(w.classificationScore(), 80)
    }
}

final class ClassificationHistoryTests: XCTestCase {
    func test_snapshots_start_at_4th_score() {
        let codes = ["a", "b", "c", "d", "e"]
        let scores = codes.enumerated().map { i, c in
            mkScore(70 + Double(i) * 2, date: "2024-0\(i + 1)-01", code: c)
        }
        let history = getClassificationHistory(scores)
        XCTAssertGreaterThanOrEqual(history.count, 2)
        XCTAssertNotNil(history.first?.date)
    }

    // Two scores share a date: there must be exactly one snapshot for that
    // date, and its percent must reflect both scores in the rolling window.
    // Without this, the chart's classification line gets duplicate X values
    // and a vertical jump within a single day.
    func test_emits_one_snapshot_per_unique_date() {
        let scores: [Classifier] = [
            mkScore(60, date: "2024-01-01", code: "a"),
            mkScore(70, date: "2024-02-01", code: "b"),
            mkScore(80, date: "2024-03-01", code: "c"),
            mkScore(50, date: "2024-04-01", code: "d"),
            mkScore(90, date: "2024-04-01", code: "e"), // same date as previous
        ]
        let history = getClassificationHistory(scores)
        let aprilEntries = history.filter { $0.date == "2024-04-01" }
        XCTAssertEqual(aprilEntries.count, 1)
        // End-of-day mean of all 5 scores: (60+70+80+50+90)/5 = 70.
        XCTAssertEqual(aprilEntries.first?.percent, 70)
        // Dates strictly distinct — no duplicates anywhere.
        let dates = history.map(\.date)
        XCTAssertEqual(Set(dates).count, dates.count)
    }
}

final class AllTimeBestClassTests: XCTestCase {
    func testReturnsGM_when_history_contains_it() {
        let history: [ClassificationSnapshot] = [
            ClassificationSnapshot(date: "2024-01-01", percent: 96, classLetter: .gm),
            ClassificationSnapshot(date: "2024-06-01", percent: 80, classLetter: .a),
        ]
        XCTAssertEqual(allTimeBestClass(history), .gm)
    }

    func testReturnsU_for_empty() {
        XCTAssertEqual(allTimeBestClass([]), .u)
    }
}

final class NextClassThresholdTests: XCTestCase {
    func test_GM_nil() { XCTAssertNil(nextClassThreshold(.gm)) }
    func test_M_returns_95() { XCTAssertEqual(nextClassThreshold(.m), 95) }
    func test_A_returns_85() { XCTAssertEqual(nextClassThreshold(.a), 85) }
}

final class StickyClassForTests: XCTestCase {
    func test_U_when_no_scores() {
        XCTAssertEqual(stickyClassFor(currentPercent: nil, allTimeHighPercent: nil), .u)
    }

    func test_falls_back_to_current_when_no_high() {
        XCTAssertEqual(stickyClassFor(currentPercent: 78, allTimeHighPercent: nil), .a)
    }

    func test_uses_high_when_current_lower_sticky() {
        XCTAssertEqual(stickyClassFor(currentPercent: 88, allTimeHighPercent: 95), .gm)
    }

    func test_uses_current_when_higher() {
        XCTAssertEqual(stickyClassFor(currentPercent: 86, allTimeHighPercent: 70), .m)
    }

    func test_GM_at_boundary() {
        XCTAssertEqual(stickyClassFor(currentPercent: 80, allTimeHighPercent: 95), .gm)
        XCTAssertEqual(stickyClassFor(currentPercent: 80, allTimeHighPercent: 94.99), .m)
    }
}

final class CrossDivisionFloorClassTests: XCTestCase {
    private func buildScores(_ percents: [Double], codePrefix: String = "99-11") -> [Classifier] {
        percents.enumerated().map { i, p in
            let mm = String(format: "%02d", i + 1)
            return mkScore(p, date: "2024-\(mm)-01", code: "\(codePrefix)-\(i)")
        }
    }

    func test_nil_when_no_other_division_has_4plus() {
        let record: [Division: [Classifier]] = [
            .carryOptics: buildScores([60, 65, 70, 75])
        ]
        XCTAssertNil(crossDivisionFloorClass(classifiersByDivision: record, scopedDivision: .carryOptics))
    }

    func test_floor_M_when_other_reached_GM() {
        let record: [Division: [Classifier]] = [
            .carryOptics: buildScores([95, 96, 97, 98, 99, 96], codePrefix: "co"),
            .limited: buildScores([60, 65, 70, 75], codePrefix: "lim"),
        ]
        XCTAssertEqual(crossDivisionFloorClass(classifiersByDivision: record, scopedDivision: .limited), .m)
    }

    func test_floor_A_when_other_reached_M() {
        let record: [Division: [Classifier]] = [
            .carryOptics: buildScores([85, 86, 87, 88, 87, 86], codePrefix: "co"),
            .limited: buildScores([60, 60, 60, 60], codePrefix: "lim"),
        ]
        XCTAssertEqual(crossDivisionFloorClass(classifiersByDivision: record, scopedDivision: .limited), .a)
    }

    func test_only_considers_other_divisions() {
        let record: [Division: [Classifier]] = [
            .carryOptics: buildScores([95, 96, 97, 98, 99, 96], codePrefix: "co"),
            .limited: buildScores([60, 65, 70, 75], codePrefix: "lim"),
        ]
        XCTAssertEqual(crossDivisionFloorClass(classifiersByDivision: record, scopedDivision: .carryOptics), .c)
    }

    func test_takes_highest_across_multiple_others() {
        let record: [Division: [Classifier]] = [
            .open: buildScores([60, 60, 60, 60], codePrefix: "open"),
            .carryOptics: buildScores([85, 86, 87, 88, 87, 86], codePrefix: "co"),
            .limited: buildScores([70, 70, 70, 70], codePrefix: "lim"),
        ]
        XCTAssertEqual(crossDivisionFloorClass(classifiersByDivision: record, scopedDivision: .limited), .a)
    }
}

final class FormatDivisionTests: XCTestCase {
    func test_camelCase_split() {
        XCTAssertEqual(formatDivision("CarryOptics"), "Carry Optics")
        XCTAssertEqual(formatDivision("LimitedOptics"), "Limited Optics")
        XCTAssertEqual(formatDivision("SingleStack"), "Single Stack")
    }

    func test_letter_digit_split() {
        XCTAssertEqual(formatDivision("Limited10"), "Limited 10")
    }

    func test_no_change_when_already_split() {
        XCTAssertEqual(formatDivision("Open"), "Open")
        XCTAssertEqual(formatDivision("PCC"), "PCC")
    }
}
