import XCTest
@testable import USPSAPasteParser
import USPSADomain

final class TextParserTests: XCTestCase {
    private func fixture(_ name: String) throws -> String {
        guard let url = Bundle.module.url(forResource: name, withExtension: "txt", subdirectory: "Fixtures") else {
            XCTFail("missing fixture \(name).txt")
            return ""
        }
        return try String(contentsOf: url, encoding: .utf8)
    }

    // MARK: A154528-CO.txt — club rows only

    func testA154528_parsesAllRows() throws {
        let result = try parsePastedTable(try fixture("A154528-CO"))
        XCTAssertEqual(result.parsedRows, 9)
        XCTAssertEqual(result.skippedRows, 0)
    }

    func testA154528_datesAreISO() throws {
        let result = try parsePastedTable(try fixture("A154528-CO"))
        for c in result.classifiers {
            XCTAssertTrue(
                c.date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil,
                "bad date \(c.date)"
            )
        }
    }

    func testA154528_firstDate() throws {
        let result = try parsePastedTable(try fixture("A154528-CO"))
        XCTAssertEqual(result.classifiers.first?.date, "2024-02-18")
    }

    func testA154528_hitFactors() throws {
        let result = try parsePastedTable(try fixture("A154528-CO"))
        let withHF = result.classifiers.filter { $0.hitFactor != nil }
        XCTAssertEqual(withHF.count, 9)
    }

    func testA154528_flags() throws {
        let result = try parsePastedTable(try fixture("A154528-CO"))
        let flags = Set(result.classifiers.map(\.flag))
        XCTAssertTrue(flags.contains(.y))
        XCTAssertTrue(flags.contains(.f))
        XCTAssertTrue(flags.contains(.e))
    }

    // MARK: A86278-Limited.txt — S/M flags + major match

    func testA86278_majorMatch() throws {
        let result = try parsePastedTable(try fixture("A86278-Limited"))
        let major = result.classifiers.filter { $0.source == .majorMatch }
        XCTAssertEqual(major.count, 1)
        XCTAssertNil(major.first?.hitFactor)
        XCTAssertEqual(major.first?.classifierCode, "MAJOR")
    }

    func testA86278_flags_S_and_M() throws {
        let result = try parsePastedTable(try fixture("A86278-Limited"))
        let flags = Set(result.classifiers.map(\.flag))
        XCTAssertTrue(flags.contains(.s))
        XCTAssertTrue(flags.contains(.m))
    }

    func testA86278_totalRows() throws {
        let result = try parsePastedTable(try fixture("A86278-Limited"))
        XCTAssertEqual(result.parsedRows, 13)
    }

    // MARK: Edge cases

    func testEmptyInputThrows() {
        XCTAssertThrowsError(try parsePastedTable("")) { error in
            XCTAssertEqual(error as? ParsePasteError, .noRowsParsed)
        }
    }

    func testHeaderOnlyThrows() {
        XCTAssertThrowsError(
            try parsePastedTable("Date\tClassifier\tClassifier Name\tHit Factor\t%\tFlag\tClub")
        ) { error in
            XCTAssertEqual(error as? ParsePasteError, .noRowsParsed)
        }
    }

    func testSkipsBlankLines() throws {
        let input = [
            "Date\tClassifier\tClassifier Name\tHit Factor\t%\tFlag\tClub",
            "",
            "3/15/2024\t99-11\tSmoke and Hope\t8.1234\t78.54\tY\tPalmetto Gun Club",
            "",
        ].joined(separator: "\n")
        let result = try parsePastedTable(input)
        XCTAssertEqual(result.parsedRows, 1)
    }

    func testSkipsBadDatesContinues() throws {
        let input = [
            "bad-date\t99-11\tName\t8.0\t70.0\tY\tClub",
            "3/15/2024\t99-12\tName\t8.0\t70.0\tY\tClub",
        ].joined(separator: "\n")
        let result = try parsePastedTable(input)
        XCTAssertEqual(result.parsedRows, 1)
        XCTAssertGreaterThan(result.skippedRows, 0)
    }

    func testMixedFlagsIncludingEmpty() throws {
        let input = [
            "1/1/2024\t99-11\tTest\t8.0\t75.0\t\tClub A",
            "2/1/2024\t99-12\tTest2\t7.5\t70.0\tY\tClub B",
        ].joined(separator: "\n")
        let result = try parsePastedTable(input)
        let flags = result.classifiers.map(\.flag)
        XCTAssertTrue(flags.contains(.none))
        XCTAssertTrue(flags.contains(.y))
    }

    // MARK: new-format-CO.txt — 8-column USPSA 2025+ format

    func testNewFormat_parsesAllRows() throws {
        let result = try parsePastedTable(try fixture("new-format-CO"))
        XCTAssertEqual(result.parsedRows, 10)
        XCTAssertEqual(result.skippedRows, 0)
    }

    func testNewFormat_expandsTwoDigitYears() throws {
        let result = try parsePastedTable(try fixture("new-format-CO"))
        for c in result.classifiers {
            XCTAssertTrue(c.date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil)
        }
        XCTAssertEqual(result.classifiers.first?.date, "2026-03-15")
    }

    func testNewFormat_majorMatch() throws {
        let result = try parsePastedTable(try fixture("new-format-CO"))
        let major = result.classifiers.filter { $0.source == .majorMatch }
        XCTAssertEqual(major.count, 1)
        XCTAssertEqual(major.first?.classifierCode, "MAJOR")
        XCTAssertNil(major.first?.hitFactor)
        XCTAssertTrue(major.first?.matchName?.contains("Championship") ?? false)
    }

    func testNewFormat_hitFactorsForClubRows() throws {
        let result = try parsePastedTable(try fixture("new-format-CO"))
        let club = result.classifiers.filter { $0.source == .club }
        XCTAssertTrue(club.allSatisfy { $0.hitFactor != nil })
    }

    func testNewFormat_flags() throws {
        let result = try parsePastedTable(try fixture("new-format-CO"))
        let flags = Set(result.classifiers.map(\.flag))
        XCTAssertTrue(flags.contains(.y))
        XCTAssertTrue(flags.contains(.f))
        XCTAssertTrue(flags.contains(.e))
    }

    func testNewFormat_skipsHeader() throws {
        let result = try parsePastedTable(try fixture("new-format-CO"))
        for c in result.classifiers {
            XCTAssertNotEqual(c.classifierCode, "Number")
        }
    }
}
