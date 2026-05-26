import Foundation
import USPSADomain

// Inserts spaces between camelCase and between letters/digits.
// "CarryOptics" -> "Carry Optics", "Limited10" -> "Limited 10".
public func formatDivision(_ raw: String) -> String {
    var out = ""
    out.reserveCapacity(raw.count + 2)
    let chars = Array(raw)
    for i in chars.indices {
        let c = chars[i]
        if i > 0 {
            let prev = chars[i - 1]
            if prev.isLowercase && c.isUppercase {
                out.append(" ")
            } else if prev.isLetter && c.isNumber {
                out.append(" ")
            }
        }
        out.append(c)
    }
    return out
}

public extension Division {
    var displayNameFormatted: String { formatDivision(rawValue) }
}
