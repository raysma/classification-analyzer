import XCTest
@testable import USPSADomain

final class MemberNumberTests: XCTestCase {
    func testValidNumbers() {
        for s in ["A12345", "TY1", "L4898", "FY42", "a154528", "  L6332  "] {
            XCTAssertTrue(MemberNumber.isValid(s), "\(s) should be valid")
        }
    }

    func testInvalidNumbers() {
        for s in ["", "12345", "ABCD12", "A", "A12B", "A12 34", "../etc", "A1;DROP", "A1\nB2"] {
            XCTAssertFalse(MemberNumber.isValid(s), "\(s) should be invalid")
        }
    }

    func testCanonicalUppercasesAndTrims() {
        XCTAssertEqual(MemberNumber.canonical("  a154528 "), "A154528")
    }
}
