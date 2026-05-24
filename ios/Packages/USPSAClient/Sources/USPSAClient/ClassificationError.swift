import Foundation

public enum ClassificationError: Error, Sendable, Equatable {
    case invalidMemberNumber
    case rateLimited
    case scrapingNotConfigured
    case scrapingAuthFailed
    case memberNotFound
    case recordNotViewable
    case upstreamTimeout
    case fetchFailed(status: Int?)
    case parseFailed
    case validationFailed
    case methodNotAllowed
    case decodeFailed
    case transport
    case badURL
    case unknown(code: String?, status: Int)

    static func map(code: String?, status: Int) -> ClassificationError {
        switch code {
        case "invalid_member_number": return .invalidMemberNumber
        case "rate_limited": return .rateLimited
        case "scraping_not_configured": return .scrapingNotConfigured
        case "scraping_auth_failed": return .scrapingAuthFailed
        case "member_not_found": return .memberNotFound
        case "record_not_viewable": return .recordNotViewable
        case "upstream_timeout": return .upstreamTimeout
        case "fetch_failed": return .fetchFailed(status: status)
        case "parse_failed": return .parseFailed
        case "validation_failed": return .validationFailed
        case "method_not_allowed": return .methodNotAllowed
        default: return .unknown(code: code, status: status)
        }
    }
}

extension ClassificationError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .invalidMemberNumber:
            return "Member number format isn't recognized."
        case .rateLimited:
            return "Too many lookups in a short window. Try again in a minute."
        case .scrapingNotConfigured, .scrapingAuthFailed:
            return "Backend can't reach USPSA right now."
        case .memberNotFound:
            return "No USPSA record found for that member number."
        case .recordNotViewable:
            return "That record is private and can't be viewed."
        case .upstreamTimeout:
            return "USPSA took too long to respond. Try again."
        case .fetchFailed(let status):
            if let status { return "Fetch failed (status \(status))." }
            return "Fetch failed."
        case .parseFailed:
            return "Could not parse the USPSA page."
        case .validationFailed, .decodeFailed:
            return "Got an unexpected response shape."
        case .methodNotAllowed:
            return "Backend rejected the request."
        case .transport:
            return "Network error. Check your connection."
        case .badURL:
            return "Bad request URL."
        case .unknown(_, let status):
            return "Unexpected response (status \(status))."
        }
    }
}
