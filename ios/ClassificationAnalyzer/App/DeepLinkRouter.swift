import Foundation
import USPSADomain

@MainActor
enum DeepLinkRouter {
    static func handle(_ url: URL, into model: AppModel) {
        guard url.scheme == "classificationanalyzer" else { return }
        guard url.host() == "lookup" else { return }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return
        }
        let items = components.queryItems ?? []

        var triggerLookup = false
        if let m = items.first(where: { $0.name == "m" })?.value, !m.isEmpty {
            model.memberNumber = m
            triggerLookup = true
        }
        if let raw = items.first(where: { $0.name == "div" })?.value,
           let division = Division(rawValue: raw) {
            model.selectedDivision = division
        }

        if triggerLookup {
            Task { await model.lookup() }
        }
    }
}
