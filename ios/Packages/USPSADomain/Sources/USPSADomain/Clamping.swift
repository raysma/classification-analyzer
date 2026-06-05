import Foundation

extension Comparable {
    /// Constrain a value to a closed range. Used to defensively bound numeric
    /// fields decoded from an untrusted response.
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
