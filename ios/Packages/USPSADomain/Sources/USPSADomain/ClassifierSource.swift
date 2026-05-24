import Foundation

public enum ClassifierSource: String, Codable, CaseIterable, Sendable, Hashable {
    case club
    case majorMatch
}

public enum RecordSource: String, Codable, CaseIterable, Sendable, Hashable {
    case fetch
    case paste
}
