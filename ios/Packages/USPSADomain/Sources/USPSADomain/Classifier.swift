import Foundation

public struct Classifier: Codable, Sendable, Hashable {
    public let date: String
    public let classifierCode: String
    public let classifierName: String?
    public let hitFactor: Double?
    public let percent: Double
    public let flag: Flag
    public let source: ClassifierSource
    public let matchName: String?

    public init(
        date: String,
        classifierCode: String,
        classifierName: String? = nil,
        hitFactor: Double? = nil,
        percent: Double,
        flag: Flag,
        source: ClassifierSource,
        matchName: String? = nil
    ) {
        self.date = date
        self.classifierCode = classifierCode
        self.classifierName = classifierName
        self.hitFactor = hitFactor
        self.percent = percent
        self.flag = flag
        self.source = source
        self.matchName = matchName
    }
}
