import XCTest
@testable import USPSARules
import USPSADomain

final class CalculatorTests: XCTestCase {
    func test_knownValue_2207_carryOptics_9_0749_is100GM() {
        let r = Calculator.classify(hitFactor: 9.0749, code: "22-07", division: .carryOptics)
        XCTAssertNotNil(r)
        XCTAssertEqual(r!.pct, 100, accuracy: 1e-3)
        XCTAssertEqual(r!.letter, .gm)
        XCTAssertEqual(r!.hhf, 9.0749, accuracy: 1e-6)
    }

    func test_capsAt110() {
        let r = Calculator.classify(hitFactor: 12.0, code: "22-07", division: .carryOptics)
        XCTAssertNotNil(r)
        XCTAssertEqual(r!.pct, 110, accuracy: 1e-9)
        XCTAssertEqual(r!.letter, .gm)
    }

    func test_lowPct_isU() {
        // 0.1 / 10.248 * 100 ≈ 0.97% → below 2% U cutoff
        let r = Calculator.classify(hitFactor: 0.1, code: "22-07", division: .open)
        XCTAssertNotNil(r)
        XCTAssertEqual(r!.letter, .u)
    }

    func test_subThirtyFive_isD() {
        // 1.0 / 10.248 * 100 ≈ 9.76% → still D (2..<40)
        let r = Calculator.classify(hitFactor: 1.0, code: "22-07", division: .open)
        XCTAssertNotNil(r)
        XCTAssertEqual(r!.letter, .d)
    }

    func test_boundarySweep() {
        // For each class boundary, an HF that lands just above / just below
        // resolves to the expected letter. Use 22-07 CarryOptics (hhf 9.0749).
        let hhf = 9.0749
        let cases: [(pct: Double, letter: ClassLetter)] = [
            (95.001, .gm), (94.999, .m),
            (85.001, .m), (84.999, .a),
            (75.001, .a), (74.999, .b),
            (60.001, .b), (59.999, .c),
            (40.001, .c), (39.999, .d),
            (2.001,  .d), (1.999,  .u),
        ]
        for c in cases {
            let hf = (c.pct / 100) * hhf
            let r = Calculator.classify(hitFactor: hf, code: "22-07", division: .carryOptics)
            XCTAssertNotNil(r, "Expected non-nil result for pct=\(c.pct)")
            XCTAssertEqual(
                r!.letter, c.letter,
                "pct=\(c.pct) expected \(c.letter.rawValue) got \(r!.letter.rawValue)"
            )
        }
    }

    func test_invalidHF_returnsNil() {
        XCTAssertNil(Calculator.classify(hitFactor: 0, code: "22-07", division: .carryOptics))
        XCTAssertNil(Calculator.classify(hitFactor: -1, code: "22-07", division: .carryOptics))
        XCTAssertNil(Calculator.classify(hitFactor: .nan, code: "22-07", division: .carryOptics))
        XCTAssertNil(Calculator.classify(hitFactor: .infinity, code: "22-07", division: .carryOptics))
    }

    func test_unknownCode_returnsNil() {
        XCTAssertNil(Calculator.classify(hitFactor: 9.0, code: "ZZ-99", division: .carryOptics))
    }

    func test_missingDivisionHHF_returnsNil() {
        // Pick a code we know has at least one division. Choose a division
        // that the code lacks. We'll iterate to find one defensively.
        let code = "22-07"
        for d in Division.allCases {
            if HHFTable.hhf(code: code, division: d) == nil {
                XCTAssertNil(Calculator.classify(hitFactor: 9.0, code: code, division: d))
                return
            }
        }
        // If 22-07 happens to have an HHF for every division, the
        // contract still holds; nothing to assert in that case.
    }
}
