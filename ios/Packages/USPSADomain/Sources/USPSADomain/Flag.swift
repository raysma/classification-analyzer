import Foundation

public enum Flag: String, Codable, CaseIterable, Sendable, Hashable {
    case none = ""
    case s = "S"
    case m = "M"
    case e = "E"
    case f = "F"
    case a = "A"
    case i = "I"
    case x = "X"
    case y = "Y"
    case p = "P"
    case q = "Q"
    case n = "N"
    case b = "B"
    case c = "C"
    case d = "D"
    case g = "G"
}
