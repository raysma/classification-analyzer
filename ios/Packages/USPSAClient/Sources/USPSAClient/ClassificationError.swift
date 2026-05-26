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
            return "That doesn't look like a USPSA member number. Examples: A12345, L4898, TY123."
        case .rateLimited:
            return "Too many lookups in a short window. Wait a minute and try again."
        case .scrapingNotConfigured, .scrapingAuthFailed:
            return "USPSA is unreachable right now. Try again in a few minutes, or paste your classifier data manually."
        case .memberNotFound:
            return "No USPSA record found for that member number. Double-check the spelling."
        case .recordNotViewable:
            return "That record is private. Contact USPSA support to make it public, or paste your classifier data manually."
        case .upstreamTimeout:
            return "USPSA took too long to respond. Try again in a moment."
        case .fetchFailed(let status):
            if let status {
                return "Couldn't reach USPSA (status \(status)). Try again or paste your data manually."
            }
            return "Couldn't reach USPSA. Try again or paste your data manually."
        case .parseFailed:
            return "USPSA returned an unexpected page. Try again or paste your classifier data manually."
        case .validationFailed, .decodeFailed:
            return "USPSA's response format may have changed. Try again or paste your classifier data manually."
        case .methodNotAllowed:
            return "Server error. Please try again."
        case .transport:
            return "Network error. Check your connection and try again."
        case .badURL:
            return "Something went wrong building the request."
        case .unknown(_, let status):
            return "Unexpected response from USPSA (status \(status)). Try again or paste your data manually."
        }
    }
}
