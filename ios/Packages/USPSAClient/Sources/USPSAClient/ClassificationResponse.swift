import Foundation
import USPSADomain

public struct ClassificationResponse: Decodable, Sendable, Hashable {
    public let record: ShooterRecord
    public let warnings: [String]

    public init(record: ShooterRecord, warnings: [String]) {
        self.record = record
        self.warnings = warnings
    }

    private enum WarningsKey: String, CodingKey { case warnings }

    public init(from decoder: Decoder) throws {
        // The server response spreads ShooterRecord fields and adds `warnings`
        // at the top level. Decode ShooterRecord from the same decoder and
        // pluck `warnings` separately.
        record = try ShooterRecord(from: decoder)
        let c = try decoder.container(keyedBy: WarningsKey.self)
        warnings = try c.decodeIfPresent([String].self, forKey: .warnings) ?? []
    }
}
