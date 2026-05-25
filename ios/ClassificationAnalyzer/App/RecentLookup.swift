import Foundation

struct RecentLookup: Codable, Sendable, Hashable, Identifiable {
    let memberNumber: String
    let name: String
    let lastLookedUpAt: Date
    var id: String { memberNumber }
}
