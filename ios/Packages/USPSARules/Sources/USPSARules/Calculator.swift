// Hit-factor → percent/letter calculator. Mirrors src/lib/calculator.ts.
import Foundation
import USPSADomain

public struct ClassificationResult: Sendable, Equatable {
    public let pct: Double
    public let letter: ClassLetter
    public let hhf: Double

    public init(pct: Double, letter: ClassLetter, hhf: Double) {
        self.pct = pct
        self.letter = letter
        self.hhf = hhf
    }
}

public enum Calculator {
    // USPSA caps individual classifier results at 110% for both per-stage
    // rating and the rolling-average computation. Real and load-bearing.
    public static let pctCap: Double = 110

    public static func classify(
        hitFactor: Double, code: String, division: Division
    ) -> ClassificationResult? {
        guard hitFactor.isFinite, hitFactor > 0 else { return nil }
        guard let hhf = HHFTable.hhf(code: code, division: division), hhf > 0 else { return nil }
        let raw = (hitFactor / hhf) * 100
        let pct = min(pctCap, raw)
        return ClassificationResult(pct: pct, letter: classFor(pct), hhf: hhf)
    }
}
