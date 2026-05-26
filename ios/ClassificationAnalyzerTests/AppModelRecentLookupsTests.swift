import XCTest
@testable import ClassificationAnalyzer
import USPSADomain

@MainActor
final class AppModelRecentLookupsTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUp() async throws {
        try await super.setUp()
        // Fresh, isolated UserDefaults per test so persistence cases don't
        // bleed across runs or pollute UserDefaults.standard.
        suiteName = "AppModelRecentLookupsTests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() async throws {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        try await super.tearDown()
    }

    // MARK: helpers

    private func makeRecord(
        memberNumber: String,
        name: String,
        source: RecordSource = .fetch
    ) -> ShooterRecord {
        ShooterRecord(
            memberNumber: memberNumber,
            name: name,
            membershipType: .annual,
            currentClasses: [:],
            classifiers: [:],
            fetchedAt: "2026-05-25T00:00:00Z",
            source: source
        )
    }

    // MARK: tests

    func testAddRecentPrependsAndUppercases() {
        let model = AppModel(defaults: defaults)
        model.addRecent(from: makeRecord(memberNumber: "a12345", name: "Alice"))

        XCTAssertEqual(model.recentLookups.count, 1)
        XCTAssertEqual(model.recentLookups.first?.memberNumber, "A12345")
        XCTAssertEqual(model.recentLookups.first?.name, "Alice")
    }

    func testReLookupDedupsAndMovesToTop() {
        let model = AppModel(defaults: defaults)
        model.addRecent(from: makeRecord(memberNumber: "A12345", name: "Alice"))
        model.addRecent(from: makeRecord(memberNumber: "B98765", name: "Bob"))

        // Re-lookup of A12345 (lowercase variant to confirm case-insensitive dedup)
        // with an updated name should move it to the top and refresh metadata.
        model.addRecent(from: makeRecord(memberNumber: "a12345", name: "Alice Updated"))

        XCTAssertEqual(model.recentLookups.count, 2)
        XCTAssertEqual(model.recentLookups[0].memberNumber, "A12345")
        XCTAssertEqual(model.recentLookups[0].name, "Alice Updated")
        XCTAssertEqual(model.recentLookups[1].memberNumber, "B98765")
    }

    func testCapEvictsOldest() {
        let model = AppModel(defaults: defaults)
        for i in 1...11 {
            model.addRecent(from: makeRecord(memberNumber: "A\(i)", name: "Shooter \(i)"))
        }

        XCTAssertEqual(model.recentLookups.count, AppModel.recentLookupsCap)
        // Newest is A11 (last added); oldest surviving is A2 (A1 evicted).
        XCTAssertEqual(model.recentLookups.first?.memberNumber, "A11")
        XCTAssertEqual(model.recentLookups.last?.memberNumber, "A2")
        XCTAssertFalse(model.recentLookups.contains { $0.memberNumber == "A1" })
    }

    func testRemoveRecentIsCaseInsensitiveAndIdempotent() {
        let model = AppModel(defaults: defaults)
        model.addRecent(from: makeRecord(memberNumber: "A12345", name: "Alice"))
        model.addRecent(from: makeRecord(memberNumber: "B98765", name: "Bob"))

        model.removeRecent(memberNumber: "a12345")  // lowercase

        XCTAssertEqual(model.recentLookups.count, 1)
        XCTAssertEqual(model.recentLookups.first?.memberNumber, "B98765")

        // No-op on a key that's no longer present.
        model.removeRecent(memberNumber: "A12345")
        XCTAssertEqual(model.recentLookups.count, 1)
    }

    func testPasteRecordsAreSkipped() {
        let model = AppModel(defaults: defaults)
        model.addRecent(from: makeRecord(memberNumber: "A12345", name: "Alice", source: .paste))

        XCTAssertTrue(model.recentLookups.isEmpty)
    }

    func testPersistenceRoundTrip() {
        let model = AppModel(defaults: defaults)
        model.addRecent(from: makeRecord(memberNumber: "A12345", name: "Alice"))
        model.addRecent(from: makeRecord(memberNumber: "B98765", name: "Bob"))

        // Allocate a fresh AppModel against the same defaults. Should restore
        // both entries in the same order.
        let restored = AppModel(defaults: defaults)

        XCTAssertEqual(restored.recentLookups.count, 2)
        XCTAssertEqual(restored.recentLookups.map(\.memberNumber), ["B98765", "A12345"])
        XCTAssertEqual(restored.recentLookups.map(\.name), ["Bob", "Alice"])
    }
}
