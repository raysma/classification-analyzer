import Foundation

public struct ClassificationSnapshot: Codable, Sendable, Hashable {
    public let date: String
    public let percent: Double
    public let classLetter: ClassLetter

    public init(date: String, percent: Double, classLetter: ClassLetter) {
        self.date = date
        self.percent = percent
        self.classLetter = classLetter
    }
}
