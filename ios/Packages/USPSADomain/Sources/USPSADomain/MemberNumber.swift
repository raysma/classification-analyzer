import Foundation

/// Validates a USPSA member number against the format the proxy accepts
/// (1–3 letters followed by digits, e.g. `A12345`, `TY1`, `L4898`). Used to
/// reject untrusted input — notably deep-link parameters — before it can
/// trigger a network lookup.
public enum MemberNumber {
    public static func isValid(_ raw: String) -> Bool {
        canonical(raw).range(of: "^[A-Z]{1,3}[0-9]+$", options: .regularExpression) != nil
    }

    public static func canonical(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }
}
