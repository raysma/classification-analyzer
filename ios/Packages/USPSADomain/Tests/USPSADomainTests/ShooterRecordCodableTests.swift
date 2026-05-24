import XCTest
@testable import USPSADomain

final class ShooterRecordCodableTests: XCTestCase {
    private static let sampleJSON = """
    {
        "memberNumber": "A12345",
        "name": "Jane Shooter",
        "membershipType": "Annual",
        "currentClasses": {
            "CarryOptics": { "letter": "B", "percent": 65.5, "highPercent": 70.0 },
            "Open": { "letter": "C", "percent": 52.3, "highPercent": 55.0 }
        },
        "classifiers": {
            "CarryOptics": [
                { "date": "2024-05-01", "classifierCode": "99-11", "percent": 75.0, "flag": "Y", "source": "club" },
                { "date": "2024-06-15", "classifierCode": "06-03", "classifierName": "Sample", "hitFactor": 5.8, "percent": 68.2, "flag": "", "source": "club" }
            ]
        },
        "fetchedAt": "2025-01-01T00:00:00Z",
        "source": "fetch"
    }
    """

    func testDecode() throws {
        let data = Self.sampleJSON.data(using: .utf8)!
        let record = try JSONDecoder().decode(ShooterRecord.self, from: data)

        XCTAssertEqual(record.memberNumber, "A12345")
        XCTAssertEqual(record.name, "Jane Shooter")
        XCTAssertEqual(record.membershipType, .annual)
        XCTAssertEqual(record.source, .fetch)
        XCTAssertEqual(record.currentClasses[.carryOptics]?.letter, .b)
        XCTAssertEqual(record.currentClasses[.carryOptics]?.percent, 65.5)
        XCTAssertEqual(record.currentClasses[.open]?.letter, .c)
        XCTAssertEqual(record.classifiers[.carryOptics]?.count, 2)
        XCTAssertEqual(record.classifiers[.carryOptics]?.first?.classifierCode, "99-11")
        XCTAssertEqual(record.classifiers[.carryOptics]?.first?.flag, .y)
        XCTAssertEqual(record.classifiers[.carryOptics]?[1].flag, .none)
        XCTAssertEqual(record.classifiers[.carryOptics]?[1].hitFactor, 5.8)
    }

    func testRoundTrip() throws {
        let data = Self.sampleJSON.data(using: .utf8)!
        let record = try JSONDecoder().decode(ShooterRecord.self, from: data)
        let encoded = try JSONEncoder().encode(record)
        let redecoded = try JSONDecoder().decode(ShooterRecord.self, from: encoded)
        XCTAssertEqual(record, redecoded)
    }

    func testRetiredFlagDecodes() throws {
        let json = """
        { "date": "2020-01-01", "classifierCode": "99-11", "percent": 60.0, "flag": "B", "source": "club" }
        """.data(using: .utf8)!
        let classifier = try JSONDecoder().decode(Classifier.self, from: json)
        XCTAssertEqual(classifier.flag, .b)
    }

    func testMajorMatchSource() throws {
        let json = """
        { "date": "2024-03-01", "classifierCode": "MM", "percent": 92.5, "flag": "Y", "source": "majorMatch", "matchName": "Area 6" }
        """.data(using: .utf8)!
        let classifier = try JSONDecoder().decode(Classifier.self, from: json)
        XCTAssertEqual(classifier.source, .majorMatch)
        XCTAssertEqual(classifier.matchName, "Area 6")
    }
}
