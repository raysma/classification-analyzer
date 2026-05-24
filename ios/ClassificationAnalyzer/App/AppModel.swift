import Foundation
import Observation
import USPSAClient
import USPSADomain

@MainActor
@Observable
final class AppModel {
    var memberNumber: String = ""
    var selectedDivision: Division?
    var fetchedRecord: ShooterRecord?
    var warnings: [String] = []
    var isLoading: Bool = false
    var lastError: ClassificationError?

    private let client: ClassificationClient

    init() {
        let urlString = "https://www.rmshooting.com"
        guard let url = URL(string: urlString) else {
            fatalError("Bad API base URL: \(urlString)")
        }
        self.client = ClassificationClient(baseURL: url)
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

            let currentIsValid = selectedDivision.flatMap { response.record.classifiers[$0] } != nil
            if !currentIsValid {
                selectedDivision = response.record.classifiers.keys
                    .sorted { $0.rawValue < $1.rawValue }
                    .first
            }
        } catch let error as ClassificationError {
            lastError = error
        } catch {
            lastError = .unknown(code: nil, status: 0)
        }
    }
}
