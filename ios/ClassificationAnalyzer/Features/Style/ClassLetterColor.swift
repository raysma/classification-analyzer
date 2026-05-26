import SwiftUI
import USPSADomain

// App-wide class-letter palette. Used by SummaryCard's letter badge,
// ChartCanvas's point marks, and CalculatorView's result pill — keeps
// the GM/M/A/B/C/D/U colors in lockstep across every surface.
extension ClassLetter {
    var fillColor: Color {
        switch self {
        case .gm: return .yellow
        case .m: return .purple
        case .a: return .blue
        case .b: return .green
        case .c: return .orange
        case .d: return .red
        case .u: return .gray
        }
    }

    // Text/icon color when overlaid on `fillColor`. Yellow needs a dark
    // brown for legibility; gray needs a darker gray; the rest get white.
    var foregroundColor: Color {
        switch self {
        case .gm: return Color(red: 0.4, green: 0.3, blue: 0.0)
        case .u: return Color(white: 0.3)
        default: return .white
        }
    }
}
