// Paste text parser. Ported from src/lib/textParser.ts.
import Foundation
import USPSADomain

public struct ParsedPasteResult: Sendable, Hashable {
    public let classifiers: [Classifier]
    public let parsedRows: Int
    public let skippedRows: Int
    public let warnings: [String]

    public init(classifiers: [Classifier], parsedRows: Int, skippedRows: Int, warnings: [String]) {
        self.classifiers = classifiers
        self.parsedRows = parsedRows
        self.skippedRows = skippedRows
        self.warnings = warnings
    }
}

public enum ParsePasteError: Error, Sendable, Hashable {
    case noRowsParsed
}

private let validFlagRawValues: Set<String> = Set(Flag.allCases.map(\.rawValue))

// New 8-column USPSA 2025+ format:
// Date  Number  Club  F  Percent  HF  Entered  Source
private let newRowRegex = #/^(\d{1,2}\/\d{1,2}\/\d{2,4})\t([^\t]*)\t([^\t]*)\t([A-Z]?)\t([\d.]+)\t([^\t]*)\t[^\t]*\t([^\t]+)$/#

// Old 7-column pre-2025 format club row:
// Date  Code  Name  HF  %  Flag  Club
private let oldClubRowRegex = #/^(\d{1,2}\/\d{1,2}\/\d{2,4})\t([^\t]+)\t([^\t]*)\t([\d.]*)\t([\d.]+)\t([A-Z]?)\t(.*)$/#

// Old major-match row (pre-2025): HF is empty, second col is literal "Major Match".
private let oldMajorRowRegex = #/(?i)^(\d{1,2}\/\d{1,2}\/\d{2,4})\tMajor Match\t([^\t]*)\t\t([\d.]+)\t([A-Z]?)\t(.*)$/#

// Date header on either format starts with "date\t" (case-insensitive).
private let headerRegex = #/(?i)^date\t/#

// New-format source column may say "Major Match" anywhere in it.
private let newFormatMajorRegex = #/(?i)major\s*match/#

private let dateRegex = #/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/#

public func parsePastedTable(_ input: String) throws -> ParsedPasteResult {
    var classifiers: [Classifier] = []
    var warnings: [String] = []
    var parsedRows = 0
    var skippedRows = 0

    let lines = input
        .split(omittingEmptySubsequences: false, whereSeparator: { $0 == "\n" })
        .map { sub -> String in
            sub.hasSuffix("\r") ? String(sub.dropLast()) : String(sub)
        }

    for line in lines {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { continue }
        if trimmed.firstMatch(of: headerRegex) != nil { continue }

        // --- New 8-column format ---
        if let match = line.wholeMatch(of: newRowRegex) {
            let (_, dateRaw, codeRaw, clubRaw, flagRaw, percentRaw, hfRaw, sourceRaw) = match.output

            guard let date = parseDate(String(dateRaw)) else {
                warnings.append("Skipped row: bad date \"\(dateRaw)\"")
                skippedRows += 1
                continue
            }
            guard let percent = Double(percentRaw) else {
                warnings.append("Skipped row: bad percent \"\(percentRaw)\"")
                skippedRows += 1
                continue
            }
            let flag = parseFlag(String(flagRaw))
            let isMajor = String(sourceRaw).firstMatch(of: newFormatMajorRegex) != nil

            if isMajor {
                let matchName = String(clubRaw).trimmingCharacters(in: .whitespacesAndNewlines)
                classifiers.append(Classifier(
                    date: date,
                    classifierCode: "MAJOR",
                    classifierName: nil,
                    hitFactor: nil,
                    percent: percent,
                    flag: flag,
                    source: .majorMatch,
                    matchName: matchName.isEmpty ? nil : matchName
                ))
            } else {
                let code = String(codeRaw).trimmingCharacters(in: .whitespacesAndNewlines)
                let hf: Double? = {
                    guard let v = Double(hfRaw), v > 0 else { return nil }
                    return v
                }()
                classifiers.append(Classifier(
                    date: date,
                    classifierCode: code,
                    classifierName: nil,
                    hitFactor: hf,
                    percent: percent,
                    flag: flag,
                    source: .club,
                    matchName: nil
                ))
            }
            parsedRows += 1
            continue
        }

        // --- Old format: major match row ---
        if let match = line.wholeMatch(of: oldMajorRowRegex) {
            let (_, dateRaw, matchNameRaw, percentRaw, flagRaw, sourceRaw) = match.output

            guard let date = parseDate(String(dateRaw)) else {
                warnings.append("Skipped major match row: bad date \"\(dateRaw)\"")
                skippedRows += 1
                continue
            }
            guard let percent = Double(percentRaw) else {
                warnings.append("Skipped major match row: bad percent \"\(percentRaw)\"")
                skippedRows += 1
                continue
            }
            let flag = parseFlag(String(flagRaw))
            let name = String(matchNameRaw).trimmingCharacters(in: .whitespacesAndNewlines)
            let mn = String(sourceRaw).trimmingCharacters(in: .whitespacesAndNewlines)

            classifiers.append(Classifier(
                date: date,
                classifierCode: "MAJOR",
                classifierName: name.isEmpty ? nil : name,
                hitFactor: nil,
                percent: percent,
                flag: flag,
                source: .majorMatch,
                matchName: mn.isEmpty ? nil : mn
            ))
            parsedRows += 1
            continue
        }

        // --- Old format: club row ---
        if let match = line.wholeMatch(of: oldClubRowRegex) {
            let (_, dateRaw, codeRaw, nameRaw, hfRaw, percentRaw, flagRaw, _) = match.output

            guard let date = parseDate(String(dateRaw)) else {
                warnings.append("Skipped row: bad date \"\(dateRaw)\"")
                skippedRows += 1
                continue
            }
            guard let percent = Double(percentRaw) else {
                warnings.append("Skipped row: bad percent \"\(percentRaw)\"")
                skippedRows += 1
                continue
            }
            let flag = parseFlag(String(flagRaw))
            let name = String(nameRaw).trimmingCharacters(in: .whitespacesAndNewlines)
            let hf: Double? = {
                guard let v = Double(hfRaw), v > 0 else { return nil }
                return v
            }()
            let code = String(codeRaw).trimmingCharacters(in: .whitespacesAndNewlines)

            classifiers.append(Classifier(
                date: date,
                classifierCode: code,
                classifierName: name.isEmpty ? nil : name,
                hitFactor: hf,
                percent: percent,
                flag: flag,
                source: .club,
                matchName: nil
            ))
            parsedRows += 1
            continue
        }

        // Unrecognized line
        skippedRows += 1
        if trimmed.count > 5 {
            let snippet = trimmed.prefix(60)
            warnings.append("Skipped unrecognized row: \"\(snippet)\"")
        }
    }

    if parsedRows == 0 {
        throw ParsePasteError.noRowsParsed
    }

    return ParsedPasteResult(
        classifiers: classifiers,
        parsedRows: parsedRows,
        skippedRows: skippedRows,
        warnings: warnings
    )
}

private func parseDate(_ raw: String) -> String? {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let match = trimmed.wholeMatch(of: dateRegex) else { return nil }
    let m = String(match.output.1)
    let d = String(match.output.2)
    let yRaw = String(match.output.3)

    let y: String
    if yRaw.count == 2 {
        let yi = Int(yRaw) ?? 0
        y = yi < 50 ? "20\(yRaw)" : "19\(yRaw)"
    } else {
        y = yRaw
    }

    let mPad = m.count == 1 ? "0\(m)" : m
    let dPad = d.count == 1 ? "0\(d)" : d
    return "\(y)-\(mPad)-\(dPad)"
}

private func parseFlag(_ raw: String) -> Flag {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if validFlagRawValues.contains(trimmed), let flag = Flag(rawValue: trimmed) {
        return flag
    }
    return .none
}
