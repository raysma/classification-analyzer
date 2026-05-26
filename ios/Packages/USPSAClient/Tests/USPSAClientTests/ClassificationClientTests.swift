import XCTest
@testable import USPSAClient
import USPSADomain

final class ClassificationClientTests: XCTestCase {
    private let baseURL = URL(string: "https://example.com")!

    override func tearDown() {
        MockURLProtocol.responder = nil
        super.tearDown()
    }

    private func client() -> ClassificationClient {
        ClassificationClient(baseURL: baseURL, session: MockURLProtocol.session())
    }

    func testHappyPathDecodes() async throws {
        let json = """
        {
            "memberNumber": "A12345",
            "name": "Jane Shooter",
            "membershipType": "Annual",
            "currentClasses": {
                "CarryOptics": { "letter": "B", "percent": 65.5, "highPercent": 70.0 }
            },
            "classifiers": {
                "CarryOptics": [
                    { "date": "2024-05-01", "classifierCode": "99-11", "percent": 75.0, "flag": "Y", "source": "club" }
                ]
            },
            "fetchedAt": "2025-01-01T00:00:00Z",
            "source": "fetch",
            "warnings": ["minor parse warning"]
        }
        """.data(using: .utf8)!

        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 200), json)
        }

        let response = try await client().fetch(member: "A12345")
        XCTAssertEqual(response.record.memberNumber, "A12345")
        XCTAssertEqual(response.record.name, "Jane Shooter")
        XCTAssertEqual(response.record.currentClasses[.carryOptics]?.letter, .b)
        XCTAssertEqual(response.record.classifiers[.carryOptics]?.count, 1)
        XCTAssertEqual(response.warnings, ["minor parse warning"])
    }

    func testMemberNotFoundMapsCleanly() async {
        let body = #"{"error":"member_not_found"}"#.data(using: .utf8)!
        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 404), body)
        }
        await assertError(expected: .memberNotFound, member: "Z999999")
    }

    func testRecordNotViewableMapsCleanly() async {
        let body = #"{"error":"record_not_viewable"}"#.data(using: .utf8)!
        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 404), body)
        }
        await assertError(expected: .recordNotViewable, member: "A155617")
    }

    func testRateLimitedMapsCleanly() async {
        let body = #"{"error":"rate_limited"}"#.data(using: .utf8)!
        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 429), body)
        }
        await assertError(expected: .rateLimited, member: "A12345")
    }

    func testParseFailedMapsCleanly() async {
        let body = #"{"error":"parse_failed"}"#.data(using: .utf8)!
        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 502), body)
        }
        await assertError(expected: .parseFailed, member: "A12345")
    }

    func testUpstreamTimeoutMapsCleanly() async {
        let body = #"{"error":"upstream_timeout"}"#.data(using: .utf8)!
        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 504), body)
        }
        await assertError(expected: .upstreamTimeout, member: "A12345")
    }

    func testFetchFailedCarriesStatus() async {
        let body = #"{"error":"fetch_failed"}"#.data(using: .utf8)!
        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 502), body)
        }
        do {
            _ = try await client().fetch(member: "A12345")
            XCTFail("expected error")
        } catch let e as ClassificationError {
            XCTAssertEqual(e, .fetchFailed(status: 502))
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testUnknownErrorPreservesCode() async {
        let body = #"{"error":"something_new"}"#.data(using: .utf8)!
        MockURLProtocol.responder = { req in
            (MockURLProtocol.httpResponse(for: req.url!, status: 500), body)
        }
        do {
            _ = try await client().fetch(member: "A12345")
            XCTFail("expected error")
        } catch let e as ClassificationError {
            XCTAssertEqual(e, .unknown(code: "something_new", status: 500))
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testRequestTargetsExpectedURL() async throws {
        let json = """
        {"memberNumber":"A12345","name":"x","membershipType":"Annual","currentClasses":{},"classifiers":{},"fetchedAt":"2025-01-01","source":"fetch","warnings":[]}
        """.data(using: .utf8)!
        let capturedURL = URLBox()
        MockURLProtocol.responder = { req in
            capturedURL.value = req.url
            return (MockURLProtocol.httpResponse(for: req.url!, status: 200), json)
        }
        _ = try await client().fetch(member: "A12345")
        XCTAssertEqual(capturedURL.value?.path, "/api/classification")
        XCTAssertEqual(capturedURL.value?.query, "member=A12345")
    }

    private func assertError(
        expected: ClassificationError,
        member: String,
        file: StaticString = #file,
        line: UInt = #line
    ) async {
        do {
            _ = try await client().fetch(member: member)
            XCTFail("expected error", file: file, line: line)
        } catch let e as ClassificationError {
            XCTAssertEqual(e, expected, file: file, line: line)
        } catch {
            XCTFail("wrong error type: \(error)", file: file, line: line)
        }
    }
}

private final class URLBox: @unchecked Sendable {
    var value: URL?
}
