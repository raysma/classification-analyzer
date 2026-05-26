import Foundation

public struct ClassInfo: Codable, Sendable, Hashable {
    public let letter: ClassLetter
    public let percent: Double
    public let highPercent: Double

    public init(letter: ClassLetter, percent: Double, highPercent: Double) {
        self.letter = letter
        self.percent = percent
        self.highPercent = highPercent
    }
}
