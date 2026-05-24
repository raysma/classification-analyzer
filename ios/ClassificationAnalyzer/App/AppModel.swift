import Foundation
import Observation
import USPSAClient
import USPSADomain
import USPSARules

private let selectedDivisionDefaultsKey = "selectedDivision"

private let canonicalDivisionOrder: [Division] = [
    .open, .limited, .limited10, .production, .revolver,
    .singleStack, .carryOptics, .limitedOptics, .pcc,
]

@MainActor
@Observable
final class AppModel {
    var memberNumber: String = ""
    var selectedDivision: Division? {
        didSet {
            if oldValue != selectedDivision {
                hypotheticalScores = []
            }
            if let raw = selectedDivision?.rawValue {
                UserDefaults.standard.set(raw, forKey: selectedDivisionDefaultsKey)
            } else {
                UserDefaults.standard.removeObject(forKey: selectedDivisionDefaultsKey)
            }
        }
    }
    var fetchedRecord: ShooterRecord?
    var pastedRecord: ShooterRecord?
    var warnings: [String] = []
    var isLoading: Bool = false
    var lastError: ClassificationError?
    var hypotheticalScores: [HypotheticalScore] = []

    private let client: ClassificationClient

    init() {
        let urlString = "https://classification.rmshooting.com"
        guard let url = URL(string: urlString) else {
            fatalError("Bad API base URL: \(urlString)")
        }
        self.client = ClassificationClient(baseURL: url)

        if let raw = UserDefaults.standard.string(forKey: selectedDivisionDefaultsKey),
           let div = Division(rawValue: raw) {
            self.selectedDivision = div
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
