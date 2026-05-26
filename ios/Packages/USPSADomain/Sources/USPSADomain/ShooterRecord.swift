import Foundation

public struct ShooterRecord: Codable, Sendable, Hashable {
    public let memberNumber: String
    public let name: String
    public let membershipType: MembershipType
    public let currentClasses: [Division: ClassInfo]
    public let classifiers: [Division: [Classifier]]
    public let fetchedAt: String
    public let source: RecordSource

    public init(
        memberNumber: String,
        name: String,
        membershipType: MembershipType,
        currentClasses: [Division: ClassInfo],
        classifiers: [Division: [Classifier]],
        fetchedAt: String,
        source: RecordSource
    ) {
        self.memberNumber = memberNumber
        self.name = name
        self.membershipType = membershipType
        self.currentClasses = currentClasses
        self.classifiers = classifiers
        self.fetchedAt = fetchedAt
        self.source = source
    }

    private enum CodingKeys: String, CodingKey {
        case memberNumber, name, membershipType, currentClasses, classifiers, fetchedAt, source
    }

    // Swift's default `Codable` for `[Enum: V]` encodes as an unkeyed array
    // when the key isn't `String` or `Int`. The server emits a JSON object
    // keyed by the Division raw value, so we bridge via `[String: V]`.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        memberNumber = try c.decode(String.self, forKey: .memberNumber)
        name = try c.decode(String.self, forKey: .name)
        membershipType = try c.decode(MembershipType.self, forKey: .membershipType)
        fetchedAt = try c.decode(String.self, forKey: .fetchedAt)
        source = try c.decode(RecordSource.self, forKey: .source)

        let rawCurrent = try c.decode([String: ClassInfo].self, forKey: .currentClasses)
        currentClasses = Self.bridge(rawCurrent)

        let rawClassifiers = try c.decode([String: [Classifier]].self, forKey: .classifiers)
        classifiers = Self.bridge(rawClassifiers)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(memberNumber, forKey: .memberNumber)
        try c.encode(name, forKey: .name)
        try c.encode(membershipType, forKey: .membershipType)
        try c.encode(fetchedAt, forKey: .fetchedAt)
        try c.encode(source, forKey: .source)

        let stringCurrent = Dictionary(
            uniqueKeysWithValues: currentClasses.map { ($0.key.rawValue, $0.value) }
        )
        try c.encode(stringCurrent, forKey: .currentClasses)

        let stringClassifiers = Dictionary(
            uniqueKeysWithValues: classifiers.map { ($0.key.rawValue, $0.value) }
        )
        try c.encode(stringClassifiers, forKey: .classifiers)
    }

    private static func bridge<V>(_ raw: [String: V]) -> [Division: V] {
        var out: [Division: V] = [:]
        out.reserveCapacity(raw.count)
        for (k, v) in raw {
            if let div = Division(rawValue: k) {
                out[div] = v
            }
        }
        return out
    }
}
