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

extension ClassInfo {
    /// Defensive clamp of numeric fields after decoding a proxy response.
    func sanitized() -> ClassInfo {
        ClassInfo(
            letter: letter,
            percent: percent.clamped(to: 0...200),
            highPercent: highPercent.clamped(to: 0...200)
        )
    }
}
