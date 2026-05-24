import Foundation
import USPSADomain

public actor ClassificationClient {
    private let baseURL: URL
    private let session: URLSession
    private var inflight: [String: Task<ClassificationResponse, Error>] = [:]

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func fetch(member: String) async throws -> ClassificationResponse {
        if let existing = inflight[member] {
            return try await existing.value
        }
        let task = Task<ClassificationResponse, Error> { [self] in
            try await performFetch(member: member)
        }
        inflight[member] = task
        defer { inflight[member] = nil }
        return try await task.value
    }

    private func performFetch(member: String) async throws -> ClassificationResponse {
        let endpoint = baseURL.appending(path: "api/classification")
        guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            throw ClassificationError.badURL
        }
        components.queryItems = [URLQueryItem(name: "member", value: member)]
        guard let url = components.url else { throw ClassificationError.badURL }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch let e as URLError where e.code == .timedOut {
            throw ClassificationError.upstreamTimeout
        } catch {
            throw ClassificationError.transport
        }

        guard let http = response as? HTTPURLResponse else {
            throw ClassificationError.unknown(code: nil, status: 0)
        }

        if !(200..<300).contains(http.statusCode) {
            let code = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw ClassificationError.map(code: code, status: http.statusCode)
        }

        do {
            return try JSONDecoder().decode(ClassificationResponse.self, from: data)
        } catch {
            throw ClassificationError.decodeFailed
        }
    }

    private struct ErrorBody: Decodable {
        let error: String?
    }
}
