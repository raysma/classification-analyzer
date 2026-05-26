import XCTest
@testable import USPSARules
import USPSADomain

final class HHFTableTests: XCTestCase {
    func test_knownHHFs_carryOptics_2207() {
        XCTAssertEqual(HHFTable.hhf(code: "22-07", division: .carryOptics)!, 9.0749, accuracy: 1e-6)
    }

    func test_knownHHFs_carryOptics_0303() {
        XCTAssertEqual(HHFTable.hhf(code: "03-03", division: .carryOptics)!, 8.2443, accuracy: 1e-6)
    }

    func test_knownHHFs_pcc_2501() {
        XCTAssertEqual(HHFTable.hhf(code: "25-01", division: .pcc)!, 8.9521, accuracy: 1e-6)
    }

    func test_limited10_lookupSucceedsForLegacyAnd25Series() {
        XCTAssertNotNil(HHFTable.hhf(code: "22-07", division: .limited10))
        // 25-series picked because the brief calls out both. Pick whichever
        // 25-XX has an L10 row in the source data.
        let any25 = HHFTable.activeClassifiers()
            .map(\.code)
            .first(where: { $0.hasPrefix("25-") && HHFTable.hhf(code: $0, division: .limited10) != nil })
        XCTAssertNotNil(any25, "Expected at least one 25-series code with a Limited10 HHF")
    }

    func test_whitespace_isTrimmed() {
        XCTAssertEqual(
            HHFTable.hhf(code: " 22-07 ", division: .carryOptics)!,
            HHFTable.hhf(code: "22-07", division: .carryOptics)!,
            accuracy: 1e-9
        )
    }

    func test_unknownCode_returnsNil() {
        XCTAssertNil(HHFTable.hhf(code: "ZZ-99", division: .open))
    }

    func test_emptyCode_returnsNil() {
        XCTAssertNil(HHFTable.hhf(code: "", division: .open))
        XCTAssertNil(HHFTable.hhf(code: "   ", division: .open))
    }

    func test_activeClassifiers_countIs63_andSortedAscending() {
        let list = HHFTable.activeClassifiers()
        XCTAssertEqual(list.count, 63)
        let codes = list.map(\.code)
        XCTAssertEqual(codes, codes.sorted(), "activeClassifiers must be sorted ascending by code")
    }

    func test_activeClassifiers_allHaveNonEmptyNames() {
        for c in HHFTable.activeClassifiers() {
            XCTAssertFalse(c.name.isEmpty, "Classifier \(c.code) has empty name")
        }
    }
}
