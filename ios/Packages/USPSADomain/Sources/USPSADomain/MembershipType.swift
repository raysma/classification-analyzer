import Foundation

public enum MembershipType: String, Codable, CaseIterable, Sendable, Hashable {
    case annual = "Annual"
    case threeYear = "ThreeYear"
    case fiveYear = "FiveYear"
    case lifetime = "Lifetime"
    case unknown = "Unknown"
}
