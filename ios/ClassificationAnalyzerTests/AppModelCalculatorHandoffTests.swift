import XCTest
@testable import ClassificationAnalyzer
import USPSADomain
import USPSARules

@MainActor
final class AppModelCalculatorHandoffTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUp() async throws {
        try await super.setUp()
        suiteName = "AppModelCalculatorHandoffTests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() async throws {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        try await super.tearDown()
    }

    // MARK: helpers

    private func mkScore(
        _ percent: Double, date: String, code: String
    ) -> Classifier {
        Classifier(
            date: date,
            classifierCode: code,
            percent: percent,
            flag: .y,
            source: .club
        )
    }

    // 8 distinct scores spanning a year. Each has a unique classifier code.
    private func eightDistinctScores() -> [Classifier] {
        (1...8).map { i in
            let mm = String(format: "%02d", i)
            return mkScore(60.0 + Double(i), date: "2024-\(mm)-15", code: "99-\(mm)")
        }
    }

    // MARK: tests

    func testCalculatorHypothetical_keepsWindowAtEight_andEvictsOldest() {
        let model = AppModel(defaults: defaults)
        let scores = eightDistinctScores()

        model.addHypothetical(
            percent: 90,
            date: "2025-06-01",          // newer than all 8 window dates
            classifierCode: "22-07"
        )
        let scenario = model.buildScenarioScores(windowScores: scores)
        let window = getCurrentWindow(scenario)

        XCTAssertEqual(window.scores.count, 8, "Rolling window must stay at 8")
        // The oldest (Jan) score should have been evicted.
        XCTAssertFalse(
            window.scores.contains(where: { $0.classifierCode == "99-01" }),
            "Oldest score should have been evicted"
        )
        // The hypothetical, carrying real date and code, must be present.
        XCTAssertTrue(
            window.scores.contains(where: { $0.classifierCode == "22-07" && $0.date == "2025-06-01" }),
            "Calculator hypothetical must be in the resulting window"
        )
    }

    func testCalculatorHypothetical_MROEvictsPriorMatchingCode() {
        let model = AppModel(defaults: defaults)
        // Eight scores. Plant code "22-07" early so the calc-sent newer
        // 22-07 row must MRO-evict it.
        let base = eightDistinctScores().enumerated().map { i, c -> Classifier in
            if i == 2 {
                return mkScore(50.0, date: "2024-03-15", code: "22-07")
            }
            return c
        }

        model.addHypothetical(
            percent: 92,
            date: "2025-06-01",
            classifierCode: "22-07"
        )
        let scenario = model.buildScenarioScores(windowScores: base)
        let window = getCurrentWindow(scenario)

        // Only one 22-07 should remain — the calc-sent one. MRO collapses
        // the earlier 22-07 by code, regardless of the window's 8-cap.
        let twoSevens = window.scores.filter { $0.classifierCode == "22-07" }
        XCTAssertEqual(twoSevens.count, 1)
        XCTAssertEqual(twoSevens.first?.percent, 92, accuracy: 1e-9)
        XCTAssertEqual(twoSevens.first?.date, "2025-06-01")
    }

    func testLegacyHypothetical_stillUsesSyntheticSentinels_andGrowsSubEightWindow() {
        let model = AppModel(defaults: defaults)
        let base = Array(eightDistinctScores().prefix(4))   // window has 4

        model.addHypothetical(percent: 80)                  // no date/code

        let scenario = model.buildScenarioScores(windowScores: base)
        XCTAssertEqual(scenario.count, 5, "Sub-8 window must just grow")

        // The synthesized Classifier must use the 9999-MM-01 sentinel.
        let synth = scenario.first { $0.classifierCode.hasPrefix("hypo-") }
        XCTAssertNotNil(synth)
        XCTAssertTrue(synth!.date.hasPrefix("9999-"))
        XCTAssertEqual(synth!.percent, 80, accuracy: 1e-9)
    }
}
