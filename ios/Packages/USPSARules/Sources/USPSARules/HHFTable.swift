// HHF (High Hit Factor) lookup + active-classifier listing.
//
// Source data (committed verbatim under Resources/):
//   - uspsa-hhfs.json        — keyed by division shortcode → classifier → hhf
//   - uspsa-classifiers.json — names for every classifier code USPSA has published
//   - uspsa-divisions.json   — shortcode ↔ long-name mapping (informational)
//
// All three files are mirrored from
// https://github.com/CodeHowlerMonkey/hitfactor.info/tree/main/data
// and from the web app's src/data/ directory. To refresh, overwrite the
// files in place and re-run the test suite — no schema munging needed.
//
// A classifier is "active" iff it appears in uspsa-hhfs.json — the HHF
// dataset is the source of truth. classifiers.json contains historical
// codes that no longer have a published HHF; those are deliberately
// filtered out.

import Foundation
import USPSADomain

public struct ActiveClassifier: Sendable, Hashable, Identifiable {
    public let code: String
    public let name: String
    public var id: String { code }

    public init(code: String, name: String) {
        self.code = code
        self.name = name
    }
}

public enum HHFTable {
    public static func hhf(code: String, division: Division) -> Double? {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return store.byCode[trimmed]?[division]
    }

    public static func activeClassifiers() -> [ActiveClassifier] {
        store.active
    }

    // Division → shortcode used as JSON keys in uspsa-hhfs.json. Matches
    // DIVISION_TO_SHORTCODE in src/lib/hhf.ts on the web.
    private static let shortcode: [Division: String] = [
        .open: "opn",
        .limited: "ltd",
        .limited10: "l10",
        .production: "prod",
        .revolver: "rev",
        .singleStack: "ss",
        .carryOptics: "co",
        .limitedOptics: "lo",
        .pcc: "pcc",
    ]

    private struct Store: Sendable {
        let byCode: [String: [Division: Double]]
        let active: [ActiveClassifier]
    }

    private static let store: Store = build()

    private static func build() -> Store {
        let hhfRaw = loadJSON(name: "uspsa-hhfs") as? [String: Any] ?? [:]
        let namesByCode = parseClassifierNames()

        var byCode: [String: [Division: Double]] = [:]
        for (division, code) in shortcode {
            guard let perCode = hhfRaw[code] as? [String: Any] else { continue }
            for (rawCode, rawHHF) in perCode {
                let trimmed = rawCode.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { continue }
                guard let hhf = rawHHF as? Double, hhf.isFinite else { continue }
                byCode[trimmed, default: [:]][division] = hhf
            }
        }

        let active = byCode.keys
            .sorted()
            .map { code in ActiveClassifier(code: code, name: namesByCode[code] ?? code) }

        return Store(byCode: byCode, active: active)
    }

    private static func parseClassifierNames() -> [String: String] {
        guard let raw = loadJSON(name: "uspsa-classifiers") as? [String: Any],
              let entries = raw["classifiers"] as? [[String: Any]]
        else { return [:] }
        var names: [String: String] = [:]
        for entry in entries {
            let code = (entry["classifier"] as? String ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let name = (entry["name"] as? String ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !code.isEmpty, !name.isEmpty, names[code] == nil else { continue }
            names[code] = name
        }
        return names
    }

    private static func loadJSON(name: String) -> Any? {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url)
        else { return nil }
        return try? JSONSerialization.jsonObject(with: data, options: [])
    }
}
