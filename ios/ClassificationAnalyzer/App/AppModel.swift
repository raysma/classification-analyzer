import Foundation
import Observation
import USPSAClient
import USPSADomain
import USPSARules

private let selectedDivisionDefaultsKey = "selectedDivision"
private let recentLookupsDefaultsKey = "recentLookups"

private let canonicalDivisionOrder: [Division] = [
    .open, .limited, .limited10, .production, .revolver,
    .singleStack, .carryOptics, .limitedOptics, .pcc,
]

@MainActor
@Observable
final class AppModel {
    static let recentLookupsCap = 10

    var memberNumber: String = ""
    var selectedDivision: Division? {
        didSet {
            if oldValue != selectedDivision {
                hypotheticalScores = []
            }
            if let raw = selectedDivision?.rawValue {
                defaults.set(raw, forKey: selectedDivisionDefaultsKey)
            } else {
                defaults.removeObject(forKey: selectedDivisionDefaultsKey)
            }
        }
    }
    var fetchedRecord: ShooterRecord?
    var pastedRecord: ShooterRecord?
    var warnings: [String] = []
    var isLoading: Bool = false
    var lastError: ClassificationError?
    var hypotheticalScores: [HypotheticalScore] = []
    var recentLookups: [RecentLookup] = [] {
        didSet {
            if let data = try? JSONEncoder().encode(recentLookups) {
                defaults.set(data, forKey: recentLookupsDefaultsKey)
            }
        }
    }

    private let client: ClassificationClient
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        let urlString = "https://classification.rmshooting.com"
        guard let url = URL(string: urlString) else {
            fatalError("Bad API base URL: \(urlString)")
        }
        self.client = ClassificationClient(baseURL: url)
        self.defaults = defaults

        if let raw = defaults.string(forKey: selectedDivisionDefaultsKey),
           let div = Division(rawValue: raw) {
            self.selectedDivision = div
        }

        if let data = defaults.data(forKey: recentLookupsDefaultsKey),
           let decoded = try? JSONDecoder().decode([RecentLookup].self, from: data) {
            self.recentLookups = decoded
        }
    }

    // The record currently displayed: fetched takes priority over pasted.
    var effectiveRecord: ShooterRecord? {
        fetchedRecord ?? pastedRecord
    }

    func lookup() async {
        let cleaned = memberNumber
            .uppercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return }

        isLoading = true
        lastError = nil
        defer { isLoading = false }

        do {
            let response = try await client.fetch(member: cleaned)
            fetchedRecord = response.record
            warnings = response.warnings
            reconcileSelectedDivision()
            addRecent(from: response.record)
        } catch let error as ClassificationError {
            lastError = error
        } catch {
            lastError = .unknown(code: nil, status: 0)
        }
    }

    func applyPaste(classifiers: [Classifier], division: Division, warnings: [String]) {
        let now = ISO8601DateFormatter().string(from: Date())
        let base = pastedRecord ?? ShooterRecord(
            memberNumber: "",
            name: "Pasted record",
            membershipType: .unknown,
            currentClasses: [:],
            classifiers: [:],
            fetchedAt: now,
            source: .paste
        )
        var updatedClassifiers = base.classifiers
        updatedClassifiers[division] = classifiers
        pastedRecord = ShooterRecord(
            memberNumber: base.memberNumber,
            name: base.name,
            membershipType: base.membershipType,
            currentClasses: base.currentClasses,
            classifiers: updatedClassifiers,
            fetchedAt: now,
            source: .paste
        )
        if !warnings.isEmpty {
            self.warnings = warnings
        }
        reconcileSelectedDivision()
    }

    func clearPastedRecord() {
        pastedRecord = nil
        reconcileSelectedDivision()
    }

    private func reconcileSelectedDivision() {
        let available = availableDivisions
        let currentIsValid = selectedDivision.map { available.contains($0) } ?? false
        if !currentIsValid {
            selectedDivision = available.first
        }
    }

    // MARK: Derived state for the active division

    var availableDivisions: [Division] {
        guard let record = effectiveRecord else { return [] }
        let withScores = record.classifiers.keys
        return canonicalDivisionOrder.filter { withScores.contains($0) }
    }

    var activeClassifiers: [Classifier] {
        guard let record = effectiveRecord, let div = selectedDivision else { return [] }
        return record.classifiers[div] ?? []
    }

    var officialClass: ClassInfo? {
        guard let record = effectiveRecord, let div = selectedDivision else { return nil }
        return record.currentClasses[div]
    }

    var projectedPercent: Double? {
        getCurrentWindow(activeClassifiers).classificationScore()
    }

    var windowSize: Int {
        getCurrentWindow(activeClassifiers).scores.count
    }

    var allTimeHighPercent: Double? {
        if let high = officialClass?.highPercent, high > 0 {
            return high
        }
        let history = getClassificationHistory(activeClassifiers)
        return history.map(\.percent).max()
    }

    var crossDivisionFloor: ClassLetter? {
        guard let record = effectiveRecord, let div = selectedDivision else { return nil }
        return crossDivisionFloorClass(
            classifiersByDivision: record.classifiers,
            scopedDivision: div
        )
    }

    var classificationHistory: [ClassificationSnapshot] {
        getClassificationHistory(activeClassifiers)
    }

    // MARK: Recent lookups
    //
    // Mirrors the web's `addRecentLookup` / `removeRecentLookup` semantics:
    // fetch-only, dedup case-insensitively by member number, newest first,
    // capped at 10. Persisted to UserDefaults via the property's didSet.

    func addRecent(from record: ShooterRecord) {
        guard record.source == .fetch else { return }
        let key = record.memberNumber.uppercased()
        var next = recentLookups.filter { $0.memberNumber.uppercased() != key }
        next.insert(
            RecentLookup(memberNumber: key, name: record.name, lastLookedUpAt: Date()),
            at: 0
        )
        recentLookups = Array(next.prefix(Self.recentLookupsCap))
    }

    func removeRecent(memberNumber: String) {
        let key = memberNumber.uppercased()
        recentLookups.removeAll { $0.memberNumber.uppercased() == key }
    }

    // MARK: What-if scenario

    func addHypothetical(percent: Double) {
        guard hypotheticalScores.count < 8 else { return }
        hypotheticalScores.append(HypotheticalScore(id: UUID(), percent: percent))
    }

    func removeHypothetical(id: UUID) {
        hypotheticalScores.removeAll { $0.id == id }
    }

    func resetScenario() {
        hypotheticalScores = []
    }

    func buildScenarioScores(windowScores: [Classifier]) -> [Classifier] {
        let synthetic = hypotheticalScores.enumerated().map { i, h in
            let mm = String(format: "%02d", i + 1)
            return Classifier(
                date: "9999-\(mm)-01",
                classifierCode: "hypo-\(h.id.uuidString)",
                classifierName: nil,
                hitFactor: nil,
                percent: h.percent,
                flag: .y,
                source: .club,
                matchName: nil
            )
        }
        return windowScores + synthetic
    }
}

struct HypotheticalScore: Identifiable, Hashable, Sendable {
    let id: UUID
    let percent: Double
}
