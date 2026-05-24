import Foundation

public enum Division: String, Codable, CaseIterable, Sendable, Hashable {
    case open = "Open"
    case limited = "Limited"
    case limited10 = "Limited10"
    case production = "Production"
    case revolver = "Revolver"
    case singleStack = "SingleStack"
    case carryOptics = "CarryOptics"
    case limitedOptics = "LimitedOptics"
    case pcc = "PCC"

    public var displayName: String {
        switch self {
        case .open: return "Open"
        case .limited: return "Limited"
        case .limited10: return "Limited 10"
        case .production: return "Production"
        case .revolver: return "Revolver"
        case .singleStack: return "Single Stack"
        case .carryOptics: return "Carry Optics"
        case .limitedOptics: return "Limited Optics"
        case .pcc: return "PCC"
        }
    }
}
