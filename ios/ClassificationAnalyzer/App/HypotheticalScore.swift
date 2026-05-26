import Foundation

// A hypothetical score in the What-If scenario. Form-entered scores
// only carry id + percent; Calculator-sent scores additionally carry
// today's date and the real classifier code so MRO and date ordering
// behave the way USPSA would actually score a reshoot.
struct HypotheticalScore: Codable, Sendable, Identifiable, Hashable {
    let id: UUID
    let percent: Double
    var date: String?            // YYYY-MM-DD, only set when from Calculator
    var classifierCode: String?  // real classifier code, only set when from Calculator

    init(
        id: UUID,
        percent: Double,
        date: String? = nil,
        classifierCode: String? = nil
    ) {
        self.id = id
        self.percent = percent
        self.date = date
        self.classifierCode = classifierCode
    }
}
